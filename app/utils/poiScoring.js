/**
 * utils/poiScoring.js
 *
 * Responsible for ranking and distributing POIs along a route.
 *
 * Mental model:
 * - poiService fetches possible stops.
 * - routeDistance attaches route-position data.
 * - this file decides which stops are actually worth showing.
 *
 * The goal is not perfection.
 * The goal is to avoid bad first-N behavior:
 *   - stops clustered in one town
 *   - low-quality places winning by accident
 *   - POIs far away from the route
 */

import { MAX_DISTANCE_FROM_ROUTE_METERS } from "./poiDistancePolicy";

/**Converts any value into a safe infinite number
 *
 * @param {unknown} value - The value to convert.
 * @param {number} fallback - The value to return if the conversion fails.
 * @returns {number} - The converted number or the fallback value.
 */

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

/**
 * Clamps a number between a minimum and maximum value.
 *
 * @param {number} value - The number to clamp.
 * @param {number} min - The minimum value to clamp to.
 * @param {number} max - The maximum value to clamp to.
 * @returns {number} - The clamped number.
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Returns a stable POI id
 *
 * This is used so we can avoid selecting the same POI multiple times if the user changes the route slightly.
 *
 * @param {object} poi - The POI object.
 * @returns {string|null} - The stable POI id.
 */
function getPoiId(poi) {
  if (!poi) return null;

  return (
    poi.googlePlaceId ??
    poi.placeId ??
    poi.place_id ??
    poi.id ??
    poi.fsq_id ??
    poi.properties?.googlePlaceId ??
    poi.properties?.placeId ??
    poi.properties?.place_id ??
    poi.properties?.id ??
    poi.name ??
    null
  );
}

/**
 * Gets the best available route-position for a POI.
 *
 * Expected ideal value:
 * - routeProgress: number from 0 to 1
 *
 * Fallback:
 * - closestRouteIndex: number based on the closest point in the route polyline
 *
 * @param {object} poi - The POI object.
 * @returns {number|null} - The best available route-position for the POI.
 */
function getRawRouteProgress(poi) {
  if (!poi) return null;

  if (Number.isFinite(poi.routeProgress)) {
    return poi.routeProgress;
  }

  if (Number.isFinite(poi.closestRouteIndex)) {
    return poi.closestRouteIndex;
  }

  return null;
}

/**
 * Scores a POI based on how close it is to the route
 *
 * Closer is better
 *
 * @param {object} poi - The POI object.
 * @param {number} maxDistanceFromRouteMeters - The maximum distance from the route in meters.
 * @returns {number} - 0 - 50 - The score for the POI based on its distance to the route.
 */
function getDistanceScore(poi, maxDistanceFromRouteMeters) {
  const distanceMeters = toFiniteNumber(
    poi.closestRouteDistanceMeters,
    maxDistanceFromRouteMeters,
  );

  const safeDistance = clamp(distanceMeters, 0, maxDistanceFromRouteMeters);

  /**
   * 0m away      -> 50 points
   * max distance -> 0 points
   */
  return 50 * (1 - safeDistance / maxDistanceFromRouteMeters);
}

/**
 * Scores a POI based on its rating
 *
 * Rating is useful, but it should not dominate everything.
 * a 4.9-star place 3 km off route may still be less useful than a 4.4-star
 * place 200m off route.
 *
 * @param {object} poi - The POI object.
 * @returns {number} - 0 - 35 - The score for the POI based on its rating.
 */
function getRatingScore(poi) {
  const rating = Number(poi.rating);

  if (!Number.isFinite(rating)) {
    /**
     * Neutral score for unrated places
     *
     * We do not want to destroy unrated small businesses automatically.
     * Some good mom-and-pop places have weak Google review data.
     */
    return 17;
  }

  const safeRating = clamp(rating, 0, 5);

  return (safeRating / 5) * 35;
}

/**
 * Scores a POI based on review count
 *
 * Uses logarithmic scaling so huge places do not completely overpower
 * smaller places
 *
 * Examples:
 * - 10 reviews help a little
 * - 100 reviews helps more
 * - 3000 reviews does not become absurdly dominant
 *
 * @param {object} poi - The POI object.
 * @returns {number} - 0 - 15 - The score for the POI based on its review count.
 */
function getReviewCountScore(poi) {
  const reviewCount = Number(poi.userRatingCount);

  if (!Number.isFinite(reviewCount) || reviewCount <= 0) {
    return 0;
  }

  const scaled = Math.log10(reviewCount + 1);

  return clamp(scaled * 5, 0, 15);
}

const COMMON_CHAIN_NAME_PATTERNS = [
  /^tim hortons\b/i,
  /^mcdonald(?:'|’)?s\b/i,
  /^a\s*&\s*w\b/i,
  /^popeyes\b/i,
  /^subway\b/i,
  /^burger king\b/i,
  /^wendy(?:'|’)?s\b/i,
  /^starbucks\b/i,
  /^pizzaville\b/i,
  /^mary brown(?:'|’)?s\b/i,
  /^harvey(?:'|’)?s\b/i,
  /^kfc\b/i,
  /^domino(?:'|’)?s\b/i,
  /^pizza hut\b/i,
  /^dairy queen\b/i,
  /^little caesars\b/i,
  /^pizza pizza\b/i,
  /^papa john(?:'|’)?s\b/i,
];

const COMMON_CHAIN_SCORE_PENALTY = 12;

function isLikelyChainPoi(poi) {
  const name = String(
    poi?.name ?? poi?.title ?? poi?.displayName?.text ?? "",
  ).trim();

  return COMMON_CHAIN_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Calculates one total POI score based on distance, rating, and review count
 *
 * Current score breakdown:
 * - 50% route convenience
 * - 35% rating quality
 * - 15% confidence from review count
 *
 * @param {object} poi - The POI object.
 * @param {object} options - The scoring options.
 * @param {number} options.maxDistanceFromRouteMeters - The maximum distance from the route in meters.
 * @returns {number} - The total score for the POI.
 */
export function scorePoi(
  poi,
  { maxDistanceFromRouteMeters = MAX_DISTANCE_FROM_ROUTE_METERS } = {},
) {
  const distanceScore = getDistanceScore(poi, maxDistanceFromRouteMeters);
  const ratingScore = getRatingScore(poi);
  const reviewCountScore = getReviewCountScore(poi);
  const chainPenalty = isLikelyChainPoi(poi) ? COMMON_CHAIN_SCORE_PENALTY : 0;

  const totalScore = Math.max(
    0,
    distanceScore + ratingScore + reviewCountScore - chainPenalty,
  );

  return Math.round(totalScore * 10) / 10; // Round to 1 decimal place for easier debugging and display
}

/**
 * Normalizes progress values across the current candidate set.
 *
 * Why this exists:
 * - routeProgress may already be 0 -> 1
 * - closestRouteIndex may be 0 -> route length in points
 *
 * This function converts whatever we have into a consistent 0 -> 1 scale.
 *
 * @param {object[]} poi - The POI object.q
 * @returns { object[]} - The POI object with normalized routeProgress.
 */
function attachNormalizedProgress(pois) {
  const rawProgressValues = pois
    .map(getRawRouteProgress)
    .filter((value) => Number.isFinite(value));

  if (rawProgressValues.length === 0) {
    return pois.map((poi, index) => ({
      ...poi,
      normalizedRouteProgress: 0,
      originalCandidateIndex: index,
    }));
  }

  const minProgress = Math.min(...rawProgressValues);
  const maxProgress = Math.max(...rawProgressValues);
  const progressRange = maxProgress - minProgress;

  return pois.map((poi, index) => {
    const rawProgress = getRawRouteProgress(poi);

    let normalizedRouteProgress = 0;

    if (Number.isFinite(rawProgress) && progressRange > 0) {
      normalizedRouteProgress = (rawProgress - minProgress) / progressRange;
    }

    /**
     * If routeProgress is already 0 → 1, this still behaves correctly.
     * If closestRouteIndex is used, it gets normalized across the POI set.
     */
    return {
      ...poi,
      normalizedRouteProgress: clamp(normalizedRouteProgress, 0, 1),
      originalCandidateIndex: index,
    };
  });
}

/**
 * Chooses a distributed set of stops.
 *
 * Strategy:
 * 1. Remove unusable POIs.
 * 2. Score each POI.
 * 3. Split the route into buckets.
 * 4. Pick the best POI from each bucket.
 * 5. If some buckets are empty, fill remaining slots with the best leftovers.
 * 6. Sort final selected stops by route progress.
 *
 * @param {object[]} pois
 * @param {number|string} stopLimit
 * @param {object} options
 * @param {number} options.maxDistanceFromRouteMeters
 * @returns {object[]}
 */
export function chooseDistributedStops(
  pois = [],
  stopLimit = 3,
  {
    maxDistanceFromRouteMeters = MAX_DISTANCE_FROM_ROUTE_METERS,
    preferredCategories = [],
  } = {},
) {
  const parsedStopLimit = Number(stopLimit);

  const safeStopLimit = Number.isFinite(parsedStopLimit)
    ? Math.max(0, parsedStopLimit)
    : 3;

  if (safeStopLimit === 0) {
    return [];
  }

  if (!Array.isArray(pois) || pois.length === 0) {
    return [];
  }

  /**
   * Keep only POIs that have usable route distance data.
   *
   * The route.jsx file already filters this, but keeping this guard here makes
   * the utility safer if it is reused later.
   */
  const validPois = pois.filter((poi) => {
    const distanceMeters = Number(poi.closestRouteDistanceMeters);

    return (
      Number.isFinite(distanceMeters) &&
      distanceMeters <= maxDistanceFromRouteMeters
    );
  });

  if (validPois.length === 0) {
    return [];
  }

  /**
   * Add normalized route progress and score to each POI.
   */
  const scoredPois = attachNormalizedProgress(validPois).map((poi) => ({
    ...poi,
    score: scorePoi(poi, { maxDistanceFromRouteMeters }),
  }));

  /**
   * More buckets means better spread.
   * The number of buckets should match the number of stops the user asked for.
   */
  const bucketCount = safeStopLimit;

  const minProgressGap = safeStopLimit > 1 ? 0.18 : 0;

  const buckets = Array.from({ length: bucketCount }, () => []);

  for (const poi of scoredPois) {
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.floor(poi.normalizedRouteProgress * bucketCount),
    );

    buckets[bucketIndex].push(poi);
  }

  const selected = [];
  const selectedIds = new Set();

  const safePreferredCategories = Array.isArray(preferredCategories)
    ? preferredCategories
    : [];

  function hasCategoryAlready(category) {
    return selected.some((stop) => stop.category === category);
  }

  function isTooCloseToSelectedStops(candidate, selectedStops, minProgressGap) {
    return selectedStops.some((selectedStop) => {
      const gap = Math.abs(
        candidate.normalizedRouteProgress -
          selectedStop.normalizedRouteProgress,
      );

      return gap < minProgressGap;
    });
  }

  /**
   * Category pass:
   * If the user selected multiple categories, try to include at least one
   * good stop for each selected category before filling the rest normally.
   */
  for (const category of safePreferredCategories) {
    if (selected.length >= safeStopLimit) break;
    if (hasCategoryAlready(category)) continue;

    const bestCategoryPoi = scoredPois
      .filter((poi) => poi.category === category)
      .sort((a, b) => b.score - a.score)[0];

    if (!bestCategoryPoi) continue;

    const poiId = getPoiId(bestCategoryPoi);

    if (poiId && selectedIds.has(poiId)) continue;

    selected.push(bestCategoryPoi);

    if (poiId) {
      selectedIds.add(poiId);
    }
  }

  /**
   * First pass:
   * Pick the best POI from each bucket.
   */
  for (const bucket of buckets) {
    if (selected.length >= safeStopLimit) break;

    const bestInBucket = [...bucket].sort((a, b) => b.score - a.score)[0];

    if (!bestInBucket) continue;

    const poiId = getPoiId(bestInBucket);

    if (poiId && selectedIds.has(poiId)) continue;

    if (isTooCloseToSelectedStops(bestInBucket, selected, minProgressGap)) {
      continue;
    }

    selected.push(bestInBucket);

    if (poiId) {
      selectedIds.add(poiId);
    }
  }

  /**
   * Second pass:
   * Fill empty slots with the best remaining POIs while still enforcing spacing.
   *
   * This keeps the recommendations spread out when the candidate pool supports it.
   */
  if (selected.length < safeStopLimit) {
    const remainingPois = [...scoredPois].sort((a, b) => b.score - a.score);

    for (const poi of remainingPois) {
      if (selected.length >= safeStopLimit) break;

      const poiId = getPoiId(poi);

      if (poiId && selectedIds.has(poiId)) continue;

      if (isTooCloseToSelectedStops(poi, selected, minProgressGap)) {
        continue;
      }

      selected.push(poi);

      if (poiId) {
        selectedIds.add(poiId);
      }
    }
  }

  /**
   * Third pass:
   * If the candidate pool is too thin, relax spacing and fill the remaining slots.
   *
   * Important:
   * Showing 4 imperfectly distributed stops is better than showing only 2 stops
   * when the user asked for 4.
   */
  if (selected.length < safeStopLimit) {
    const remainingPois = [...scoredPois].sort((a, b) => b.score - a.score);

    for (const poi of remainingPois) {
      if (selected.length >= safeStopLimit) break;

      const poiId = getPoiId(poi);

      if (poiId && selectedIds.has(poiId)) continue;

      selected.push(poi);

      if (poiId) {
        selectedIds.add(poiId);
      }
    }
  }

  /**
   * Final output should be route-ordered.
   *
   * The user should see Stop 1, Stop 2, Stop 3 in travel order,
   * not score order.
   */
  return selected.sort((a, b) => {
    return a.normalizedRouteProgress - b.normalizedRouteProgress;
  });
}
