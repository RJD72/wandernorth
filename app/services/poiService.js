/**
 * services/poiService.js
 *
 * Fetches real POIs near sampled route points using the active POI provider.
 *
 * Current strategy:
 * 1. route.jsx samples a few points along the route.
 * 2. This service searches near each sample point.
 * 3. Results are normalized into one simple app-friendly shape.
 * 4. Duplicate places are removed.
 * 5. The final list is returned to route.jsx.
 */

import { logger } from "../utils/logger";
import { activePoiProviders, primaryPoiProvider } from "./poiProviders";
import { getDistanceMeters } from "../utils/routeDistance";
import { API_LIMITS } from "../config/apiLimits";

const CROSS_PROVIDER_DUPLICATE_DISTANCE_METERS = 75;
let lastPoiSearchMetadata = null;

export function getLastPoiSearchMetadata() {
  return lastPoiSearchMetadata ? { ...lastPoiSearchMetadata } : null;
}

export async function runWithConcurrency(
  tasks,
  limit = API_LIMITS.poiMaximumConcurrency,
) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex;
      nextIndex += 1;
      try {
        results[taskIndex] = {
          status: "fulfilled",
          value: await tasks[taskIndex](),
        };
      } catch (reason) {
        results[taskIndex] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.min(Math.max(1, limit), tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function normalizeSelectedPoiTypes(selectedPoiTypes = []) {
  return primaryPoiProvider.normalizeSelectedPoiTypes(selectedPoiTypes);
}

/**
 * Removes duplicate places by Google place id.
 *
 * Why duplicates happen:
 * Multiple route sample points can overlap geographically. The same business
 * can therefore appear in several Nearby Search responses.
 *
 * Dedupe policy:
 * - Prefer provider-aware ids, fallback to googlePlaceId, then id.
 * - Drop records that have no stable id.
 * - Keep the first occurrence and skip subsequent duplicates.
 *
 * @param {object[]} pois
 * @returns {object[]} De-duplicated POI list
 */
function dedupePois(pois = []) {
  const seen = new Set();

  return pois.filter((poi) => {
    const key =
      poi.provider && poi.providerPlaceId
        ? `${poi.provider}:${poi.providerPlaceId}`
        : poi.googlePlaceId || poi.id;

    if (!key) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function normalizePoiName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function arePoiNamesVerySimilar(firstName, secondName) {
  const normalizedFirstName = normalizePoiName(firstName);
  const normalizedSecondName = normalizePoiName(secondName);

  if (!normalizedFirstName || !normalizedSecondName) {
    return false;
  }

  if (normalizedFirstName === normalizedSecondName) {
    return true;
  }

  if (normalizedFirstName.length < 6 || normalizedSecondName.length < 6) {
    return false;
  }

  return (
    normalizedFirstName.includes(normalizedSecondName) ||
    normalizedSecondName.includes(normalizedFirstName)
  );
}

function arePoiCoordinatesClose(firstPoi, secondPoi) {
  const distanceMeters = getDistanceMeters(
    {
      latitude: firstPoi?.latitude,
      longitude: firstPoi?.longitude,
    },
    {
      latitude: secondPoi?.latitude,
      longitude: secondPoi?.longitude,
    },
  );

  return (
    Number.isFinite(distanceMeters) &&
    distanceMeters <= CROSS_PROVIDER_DUPLICATE_DISTANCE_METERS
  );
}

function isLikelySamePlaceAcrossProviders(firstPoi, secondPoi) {
  if (!firstPoi || !secondPoi) {
    return false;
  }

  if (firstPoi.provider === secondPoi.provider) {
    return false;
  }

  return (
    arePoiNamesVerySimilar(firstPoi.name, secondPoi.name) &&
    arePoiCoordinatesClose(firstPoi, secondPoi)
  );
}

function preferGooglePoi(firstPoi, secondPoi) {
  if (firstPoi?.provider === "google") {
    return firstPoi;
  }

  if (secondPoi?.provider === "google") {
    return secondPoi;
  }

  return firstPoi;
}

function dedupeLikelySamePlacesAcrossProviders(pois = []) {
  return pois.reduce((dedupedPois, poi) => {
    const duplicateIndex = dedupedPois.findIndex((existingPoi) => {
      return isLikelySamePlaceAcrossProviders(existingPoi, poi);
    });

    if (duplicateIndex === -1) {
      dedupedPois.push(poi);
      return dedupedPois;
    }

    dedupedPois[duplicateIndex] = preferGooglePoi(
      dedupedPois[duplicateIndex],
      poi,
    );
    return dedupedPois;
  }, []);
}

function getProviderResultCounts(pois = []) {
  const counts = pois.reduce((currentCounts, poi) => {
    const provider = poi.provider || "unknown";

    return {
      ...currentCounts,
      [provider]: (currentCounts[provider] || 0) + 1,
    };
  }, {});

  return {
    google: counts.google || 0,
    tomtom: counts.tomtom || 0,
    ...counts,
  };
}

/**
 * Picks evenly spaced route points from the full route.
 *
 * Why this exists:
 * routePoints.slice(0, 3) only searches the beginning of the route.
 * For Wander North, we need candidates from early, middle, and late route areas.
 *
 * @param {Array<{ latitude: number, longitude: number }>} routePoints
 * @param {number} maxPoints
 * @returns {Array<{ latitude: number, longitude: number }>}
 */
function getEvenlySpacedRoutePoints(routePoints = [], maxPoints = 3) {
  if (!Array.isArray(routePoints) || routePoints.length === 0) {
    return [];
  }

  if (routePoints.length <= maxPoints) {
    return routePoints;
  }

  if (maxPoints <= 1) {
    return [routePoints[0]];
  }

  const lastIndex = routePoints.length - 1;
  const step = lastIndex / (maxPoints - 1);

  return Array.from({ length: maxPoints }, (_, index) => {
    const routePointIndex = Math.round(index * step);
    return routePoints[routePointIndex];
  });
}

/**
 * Main function used by route.jsx.
 *
 * End-to-end flow:
 * 1. Validate route points and resolve provider types.
 * 2. Apply temporary call caps to control API cost/latency during iteration.
 * 3. Build a request matrix of (point x type).
 * 4. Execute all requests concurrently with Promise.allSettled so one failing
 *    request does not fail the whole batch.
 * 5. Flatten successful results, de-duplicate, and return the candidate pool.
 *
 * About numStops:
 * - Coerced with Number(...) to accept numeric strings from UI controls.
 * - Falls back to 3 when coercion yields a falsey value.
 *
 * @param {object} args
 * @param {Array<{ latitude: number, longitude: number }>} args.routePoints
 * @param {string[]} args.selectedPoiTypes
 * @param {number|string} args.numStops
 * @returns {Promise<object[]>}
 */
export async function fetchPoisNearRoutePoints({
  routePoints = [],
  selectedPoiTypes = [],
  numStops = 3,
}) {
  if (!Array.isArray(routePoints) || routePoints.length === 0) {
    return [];
  }

  /**
   * Convert numStops into a safe number.
   *
   * Important:
   * Number(numStops) || 3 is a bug because 0 || 3 becomes 3.
   * If the user chooses 0 stops, we want to respect that and return no POIs.
   */
  const parsedNumStops = Number(numStops);

  const safeNumStops = Number.isFinite(parsedNumStops)
    ? Math.max(0, parsedNumStops)
    : 3;

  // If the user chose zero stops, do not make any POI API calls.
  // This saves quota and avoids returning stops the user did not ask for.
  if (safeNumStops === 0) {
    return [];
  }

  const pointsToSearch = getEvenlySpacedRoutePoints(
    routePoints,
    API_LIMITS.poiMaximumRoutePoints,
  );

  const firstWaveTasks = [];
  const fallbackWaveTasks = [];
  const searchedTypesByProvider = {};
  const fallbackTypesByProvider = {};

  for (const provider of activePoiProviders) {
    const providerTypes = provider.getProviderPoiTypes(selectedPoiTypes);

    if (providerTypes.length === 0) {
      logger.log("[poiService] No valid POI types found for provider:", {
        provider: provider.id,
        selectedPoiTypes,
      });
      continue;
    }

    const prioritizedProviderTypes =
      provider.prioritizeProviderPoiTypesForSearch(
        providerTypes,
        selectedPoiTypes,
      );
    const firstWaveTypes = prioritizedProviderTypes.slice(
      0,
      API_LIMITS.poiFirstWaveTypesPerProvider,
    );
    const fallbackTypes = prioritizedProviderTypes.slice(
      API_LIMITS.poiFirstWaveTypesPerProvider,
      API_LIMITS.poiFirstWaveTypesPerProvider +
        API_LIMITS.poiFallbackTypesPerProvider,
    );
    searchedTypesByProvider[provider.id] = [...firstWaveTypes];
    fallbackTypesByProvider[provider.id] = [...fallbackTypes];

    logger.log("[poiService] Provider search:", {
      provider: provider.id,
      incomingRoutePointCount: routePoints.length,
      searchedRoutePointCount: pointsToSearch.length,
      typesToSearch: firstWaveTypes,
      requestCount: pointsToSearch.length * firstWaveTypes.length,
    });

    for (const point of pointsToSearch) {
      for (const providerType of firstWaveTypes) {
        firstWaveTasks.push(() =>
          provider.fetchPoisForRoutePointAndType({
            point,
            providerType,
            radiusMeters: provider.getSearchRadiusForType(providerType),
            maxResultCount: 5,
          }),
        );
      }
    }

    for (const point of pointsToSearch.slice(0, 3)) {
      for (const providerType of fallbackTypes) {
        fallbackWaveTasks.push(() =>
          provider.fetchPoisForRoutePointAndType({
            point,
            providerType,
            radiusMeters: provider.getSearchRadiusForType(providerType),
            maxResultCount: 5,
          }),
        );
      }
    }
  }

  const firstWaveResults = await runWithConcurrency(firstWaveTasks);
  const firstWavePois = firstWaveResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const firstWaveCandidateCount = dedupeLikelySamePlacesAcrossProviders(
    dedupePois(firstWavePois),
  ).length;
  const browseBuffer = 2;
  const shouldRunFallback =
    fallbackWaveTasks.length > 0 &&
    firstWaveCandidateCount < safeNumStops + browseBuffer;
  const fallbackWaveResults = shouldRunFallback
    ? await runWithConcurrency(fallbackWaveTasks)
    : [];
  if (shouldRunFallback) {
    Object.entries(fallbackTypesByProvider).forEach(
      ([providerId, fallbackTypes]) => {
        searchedTypesByProvider[providerId].push(...fallbackTypes);
      },
    );
  }
  const settledResults = [...firstWaveResults, ...fallbackWaveResults];

  if (
    settledResults.length > 0 &&
    !settledResults.some((result) => result.status === "fulfilled")
  ) {
    throw new Error("All POI providers are temporarily unavailable.");
  }

  // Keep successful batches; log and ignore failures to preserve resilience.
  const allPois = settledResults.flatMap((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    logger.log("[poiService] One POI request failed:", result.reason);
    return [];
  });

  const providerIdDedupedPois = dedupePois(allPois);
  const crossProviderDedupedPois = dedupeLikelySamePlacesAcrossProviders(
    providerIdDedupedPois,
  );

  lastPoiSearchMetadata = {
    routePointCount: pointsToSearch.length,
    searchedTypesByProvider,
    firstWaveRequestCount: firstWaveTasks.length,
    fallbackWaveRequestCount: fallbackWaveResults.length,
    fallbackUsed: shouldRunFallback,
    failedRequestCount: settledResults.filter(
      (result) => result.status === "rejected",
    ).length,
    partial: settledResults.some((result) => result.status === "rejected"),
  };

  logger.log("[poiService] Provider result counts:", {
    ...getProviderResultCounts(allPois),
    totalBeforeDedupe: allPois.length,
    totalAfterProviderIdDedupe: providerIdDedupedPois.length,
    totalAfterCrossProviderDedupe: crossProviderDedupedPois.length,
    searchMetadata: lastPoiSearchMetadata,
  });

  /**
   * Return the full candidate pool.
   *
   * Important:
   * Do NOT slice to safeNumStops here anymore.
   *
   * poiService's job is to fetch possible stops.
   * poiScoring.js decides which stops are actually worth showing.
   */
  return crossProviderDedupedPois;
}
