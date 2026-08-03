import {
  getGoogleAndroidRestrictionHeaders,
  getGoogleWebServicesApiKey,
} from "../config/providerConfig";
import { getClosestRoutePointInfo } from "../utils/routeDistance";
import { logger } from "../utils/logger";
import { customRouteTextSearchRequestCache } from "./apiRequestCaches";
import { requestExternalApi } from "./externalApiRequest";

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const TEXT_SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType";
const MAX_ROUTE_SEARCH_POINTS = 5;
const ROUTE_SEARCH_RADIUS_METERS = 25000;

function isValidCoordinate(point) {
  return (
    point &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function normalizedText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getNameMatchScore(name, query) {
  const normalizedName = normalizedText(name);
  const normalizedQuery = normalizedText(query);
  if (!normalizedName || !normalizedQuery) return 3;
  if (normalizedName === normalizedQuery) return 0;
  if (
    normalizedName.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedName)
  ) {
    return 1;
  }

  const queryWords = normalizedQuery.split(" ").filter(Boolean);
  return queryWords.every((word) => normalizedName.includes(word)) ? 2 : 3;
}

function normalizeTextSearchPlace(place, routeSearchPointIndex, routeCoords) {
  const title = place?.displayName?.text;
  const latitude = place?.location?.latitude;
  const longitude = place?.location?.longitude;
  if (!place?.id || !title || !isValidCoordinate({ latitude, longitude })) {
    return null;
  }

  const routeInfo = getClosestRoutePointInfo(
    { latitude, longitude },
    routeCoords,
  );

  return {
    place_id: place.id,
    name: title,
    title,
    address: place.formattedAddress || "",
    description: place.formattedAddress
      ? `${title} · ${place.formattedAddress}`
      : title,
    primaryType: place.primaryType ?? null,
    latitude,
    longitude,
    coords: { latitude, longitude },
    routeSearchPointIndex,
    closestRouteDistanceMeters: routeInfo?.closestDistanceMeters ?? null,
    closestRouteIndex: routeInfo?.closestIndex ?? null,
    routeProgress: routeInfo?.routeProgress ?? null,
    routeProgressPercent: routeInfo?.routeProgressPercent ?? null,
    source: "text-search",
  };
}

async function readGoogleError(response) {
  const readableResponse = response?.clone?.() ?? response;

  try {
    const data = await readableResponse.json();
    return {
      googleErrorStatus: data?.error?.status ?? null,
      googleErrorMessage: data?.error?.message ?? null,
    };
  } catch {
    try {
      const message = await readableResponse.text();
      return { googleErrorStatus: null, googleErrorMessage: message || null };
    } catch {
      return { googleErrorStatus: null, googleErrorMessage: null };
    }
  }
}

async function searchNearRoutePoint({
  inputText,
  point,
  routeSearchPointIndex,
  routeCoords,
  signal,
  log,
}) {
  let loggedHttpFailure = false;
  const apiKey = getGoogleWebServicesApiKey();

  function sanitizeMessage(message) {
    return typeof message === "string"
      ? message.replaceAll(apiKey, "[redacted]")
      : message;
  }

  try {
    const response = await requestExternalApi({
      provider: "google",
      operation: "places-text-search-custom-route",
      url: TEXT_SEARCH_URL,
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK,
          ...getGoogleAndroidRestrictionHeaders(),
        },
        body: JSON.stringify({
          textQuery: inputText,
          locationBias: {
            circle: {
              center: {
                latitude: point.latitude,
                longitude: point.longitude,
              },
              radius: ROUTE_SEARCH_RADIUS_METERS,
            },
          },
          rankPreference: "DISTANCE",
          regionCode: "CA",
          pageSize: 5,
        }),
      },
      signal,
      retryTransient: true,
      onNonOkResponse: async (response) => {
        loggedHttpFailure = true;
        const googleError = await readGoogleError(response);
        log.warn("[AutocompleteInput] Custom route Text Search failed.", {
          httpStatus: response.status,
          googleErrorStatus: googleError.googleErrorStatus,
          googleErrorMessage: sanitizeMessage(googleError.googleErrorMessage),
          routeSearchPointIndex,
          sampleLatitude: point.latitude,
          sampleLongitude: point.longitude,
        });
      },
    });
    const data = await response.json();

    return (data.places ?? [])
      .map((place) =>
        normalizeTextSearchPlace(place, routeSearchPointIndex, routeCoords),
      )
      .filter(Boolean);
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    if (!loggedHttpFailure) {
      log.warn("[AutocompleteInput] Custom route Text Search failed.", {
        httpStatus: error?.status ?? null,
        googleErrorStatus: null,
        googleErrorMessage:
          sanitizeMessage(error?.message) ?? "Request failed.",
        routeSearchPointIndex,
        sampleLatitude: point.latitude,
        sampleLongitude: point.longitude,
      });
    }
    throw error;
  }
}

function sortRoutePredictions(predictions, query) {
  return [...predictions].sort((a, b) => {
    const progressDifference =
      (a.routeProgress ?? Number.POSITIVE_INFINITY) -
      (b.routeProgress ?? Number.POSITIVE_INFINITY);
    if (progressDifference !== 0) return progressDifference;

    const distanceDifference =
      (a.closestRouteDistanceMeters ?? Number.POSITIVE_INFINITY) -
      (b.closestRouteDistanceMeters ?? Number.POSITIVE_INFINITY);
    if (distanceDifference !== 0) return distanceDifference;

    const matchDifference =
      getNameMatchScore(a.name, query) - getNameMatchScore(b.name, query);
    if (matchDifference !== 0) return matchDifference;

    return a.routeSearchPointIndex - b.routeSearchPointIndex;
  });
}

export function mergeRouteAndAutocompletePredictions(
  routePredictions = [],
  autocompletePredictions = [],
) {
  const seenPlaceIds = new Set();

  return [...routePredictions, ...autocompletePredictions].filter(
    (prediction) => {
      if (!prediction?.place_id || seenPlaceIds.has(prediction.place_id)) {
        return false;
      }
      seenPlaceIds.add(prediction.place_id);
      return true;
    },
  );
}

export async function fetchRouteTextSearchPredictions({
  inputText,
  searchPoints = [],
  routeCoords = [],
  interactionToken = "",
  signal,
  log = logger,
}) {
  const routeSearchPoints = searchPoints
    .filter(isValidCoordinate)
    .slice(0, MAX_ROUTE_SEARCH_POINTS);
  if (routeSearchPoints.length === 0) return [];

  const normalizedQuery = normalizedText(inputText);
  const routeIdentity = routeSearchPoints
    .map(
      (point) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`,
    )
    .join(";");
  const cacheKey = [interactionToken, normalizedQuery, routeIdentity].join("|");

  return customRouteTextSearchRequestCache.load(cacheKey, async () => {
    const searchResults = await Promise.allSettled(
      routeSearchPoints.map((point, routeSearchPointIndex) =>
        searchNearRoutePoint({
          inputText,
          point,
          routeSearchPointIndex,
          routeCoords,
          signal,
          log,
        }),
      ),
    );

    if (signal?.aborted) {
      const error = new Error("Request cancelled.");
      error.name = "AbortError";
      throw error;
    }

    const successfulResults = searchResults.filter(
      (result) => result.status === "fulfilled",
    );
    const routePredictions = successfulResults.flatMap(
      (result) => result.value,
    );
    const deduplicatedPredictions = mergeRouteAndAutocompletePredictions(
      routePredictions,
      [],
    );
    const summary = {
      query: inputText,
      requestedPointCount: routeSearchPoints.length,
      successfulRequestCount: successfulResults.length,
      failedRequestCount: searchResults.length - successfulResults.length,
      returnedPlaceCount: deduplicatedPredictions.length,
    };
    log.log("[AutocompleteInput] Custom route Text Search summary.", summary);

    if (successfulResults.length === 0) {
      log.warn(
        "[AutocompleteInput] All custom route Text Search requests failed; using ordinary autocomplete fallback.",
      );
    }

    return sortRoutePredictions(deduplicatedPredictions, inputText);
  });
}
