import { logger } from "../../utils/logger";
import { trackExternalRequest } from "../apiUsageTracker";
import {
  getCanonicalPoiCategoryId,
  getPoiCategoryIdForTomTomQuery,
  getTomTomQueriesForPoiCategoryIds,
} from "../../config/poiCategories";

const TOMTOM_POI_SEARCH_BASE_URL = "https://api.tomtom.com/search/2/poiSearch";

const LEGACY_TOMTOM_POI_QUERY_MAP = {
  bar: ["bar"],
  bars: ["bar"],
  lodging: ["hotel"],
  hotel: ["hotel"],
  hotels: ["hotel"],
  motel: ["motel"],
  motels: ["motel"],
};

const DEFAULT_TOMTOM_TYPES = ["cafe", "restaurant", "tourist attraction"];

const RESTAURANT_TOMTOM_QUERIES = new Set([
  "restaurant",
  "breakfast",
  "cafe",
  "caf\u00e9",
  "fast food",
  "pizza",
  "italian",
  "chinese",
  "sushi",
  "mexican",
  "thai",
  "indian",
  "seafood",
  "steak house",
  "vegetarian",
  "organic",
]);

const WIDER_RADIUS_TOMTOM_QUERIES = new Set([
  ...RESTAURANT_TOMTOM_QUERIES,
  "coffee shop",
  "food drinks: bakers",
  "doughnuts",
  "ice cream parlor",
  "bar",
  "hotel",
  "motel",
  "gas station",
  "petrol station",
]);

function getTomTomQueriesForCategoryId(categoryId) {
  const normalizedCategoryId = String(categoryId || "")
    .trim()
    .toLowerCase();
  const configuredQueries = getTomTomQueriesForPoiCategoryIds([
    normalizedCategoryId,
  ]);

  if (configuredQueries.length > 0) {
    return configuredQueries;
  }

  return LEGACY_TOMTOM_POI_QUERY_MAP[normalizedCategoryId] || [];
}

export function normalizeSelectedPoiTypes(selectedPoiTypes = []) {
  if (!Array.isArray(selectedPoiTypes)) {
    return [];
  }

  const mappedTypes = selectedPoiTypes.flatMap(getTomTomQueriesForCategoryId);

  return [...new Set(mappedTypes)];
}

export function getProviderPoiTypes(selectedPoiTypes = []) {
  const mappedTypes = normalizeSelectedPoiTypes(selectedPoiTypes);

  return mappedTypes.length > 0 ? mappedTypes : DEFAULT_TOMTOM_TYPES;
}

export function prioritizeProviderPoiTypesForSearch(
  providerTypes = [],
  selectedPoiTypes = [],
) {
  const uniqueProviderTypes = [...new Set(providerTypes)];

  const explicitlySelectedRestaurant =
    Array.isArray(selectedPoiTypes) &&
    selectedPoiTypes.some((type) => {
      return getTomTomQueriesForCategoryId(type).some((query) =>
        RESTAURANT_TOMTOM_QUERIES.has(String(query).toLowerCase()),
      );
    });

  if (!explicitlySelectedRestaurant) {
    return uniqueProviderTypes;
  }

  return [
    ...uniqueProviderTypes.filter((query) =>
      RESTAURANT_TOMTOM_QUERIES.has(String(query).toLowerCase()),
    ),
    ...uniqueProviderTypes.filter(
      (query) => !RESTAURANT_TOMTOM_QUERIES.has(String(query).toLowerCase()),
    ),
  ];
}

export function getSearchRadiusForType(providerType) {
  const type = String(providerType || "").toLowerCase();

  if (WIDER_RADIUS_TOMTOM_QUERIES.has(type)) {
    return 6000;
  }

  return 3500;
}

function normalizeTomTomResult(result, fallbackCategory) {
  const latitude = result.position?.lat;
  const longitude = result.position?.lon;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const providerPlaceId = result.id;

  if (!providerPlaceId) {
    return null;
  }

  const providerCategory =
    fallbackCategory || result.poi?.categories?.[0] || null;
  const appCategory =
    getPoiCategoryIdForTomTomQuery(fallbackCategory) ||
    getPoiCategoryIdForTomTomQuery(result.poi?.categories?.[0]) ||
    getCanonicalPoiCategoryId(fallbackCategory) ||
    "other";

  return {
    id: `tomtom:${providerPlaceId}`,
    provider: "tomtom",
    providerPlaceId,
    tomtomPlaceId: providerPlaceId,

    name: result.poi?.name || "Unnamed place",
    category: appCategory,
    providerCategory,
    address: result.address?.freeformAddress || "",

    latitude,
    longitude,

    rating: null,
    userRatingCount: null,
    googleMapsUri: null,

    raw: result,
  };
}

export async function fetchPoisForRoutePointAndType({
  point,
  providerType,
  radiusMeters = 3000,
  maxResultCount = 5,
}) {
  const apiKey = process.env.EXPO_PUBLIC_TOMTOM_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_TOMTOM_API_KEY. Add it to your .env file before enabling TomTom.",
    );
  }

  const queryParams = new URLSearchParams({
    key: apiKey,
    lat: String(point.latitude),
    lon: String(point.longitude),
    radius: String(radiusMeters),
    limit: String(maxResultCount),
    countrySet: "CA",
  });
  const encodedProviderType = encodeURIComponent(providerType);
  const url =
    `${TOMTOM_POI_SEARCH_BASE_URL}/${encodedProviderType}.json?` +
    queryParams.toString();

  const response = await trackExternalRequest("tomtom", "poi-search", () =>
    fetch(url, {
      method: "GET",
    }),
  );

  const responseText = await response.text();
  let data = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (error) {
    logger.log("[poiService] TomTom POI response parse error:", error);
  }

  logger.log("[poiService] TomTom POI raw result:", {
    providerType,
    radiusMeters,
    point,
    status: response.status,
    resultCount: data.results?.length ?? 0,
    firstResult: data.results?.[0]?.poi?.name ?? null,
  });

  if (!response.ok) {
    logger.log("[poiService] TomTom POI error:", {
      providerType,
      status: response.status,
    });
    throw new Error(
      `TomTom POI request failed with status ${response.status}.`,
    );
  }

  return (data.results || [])
    .map((result) => normalizeTomTomResult(result, providerType))
    .filter(Boolean);
}

export const tomtomPoiProvider = {
  id: "tomtom",
  normalizeSelectedPoiTypes,
  getProviderPoiTypes,
  prioritizeProviderPoiTypesForSearch,
  getSearchRadiusForType,
  fetchPoisForRoutePointAndType,
};
