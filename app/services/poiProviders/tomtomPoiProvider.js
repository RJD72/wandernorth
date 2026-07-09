import { logger } from "../../utils/logger";

const TOMTOM_POI_SEARCH_BASE_URL = "https://api.tomtom.com/search/2/poiSearch";

const TOMTOM_POI_QUERY_MAP = {
  cafe: "cafe",
  coffee: "cafe",
  coffee_shop: "cafe",

  restaurant: "restaurant",
  restaurants: "restaurant",
  food: "restaurant",

  bar: "bar",
  bars: "bar",

  attraction: "tourist attraction",
  attractions: "tourist attraction",
  tourist_attraction: "tourist attraction",

  park: "park",
  parks: "park",

  museum: "museum",
  museums: "museum",

  lodging: "hotel",
  hotel: "hotel",
  hotels: "hotel",
  motel: "motel",
  motels: "motel",

  gas: "gas station",
  gas_station: "gas station",
  gas_stations: "gas station",
  "gas station": "gas station",
  fuel: "gas station",
};

const DEFAULT_TOMTOM_TYPES = ["cafe", "restaurant", "tourist attraction"];

export function normalizeSelectedPoiTypes(selectedPoiTypes = []) {
  if (!Array.isArray(selectedPoiTypes)) {
    return [];
  }

  const mappedTypes = selectedPoiTypes
    .map((type) => TOMTOM_POI_QUERY_MAP[String(type).trim().toLowerCase()])
    .filter(Boolean);

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
      const normalizedType = String(type).trim().toLowerCase();
      return TOMTOM_POI_QUERY_MAP[normalizedType] === "restaurant";
    });

  if (!explicitlySelectedRestaurant) {
    return uniqueProviderTypes;
  }

  return [
    "restaurant",
    ...uniqueProviderTypes.filter((type) => type !== "restaurant"),
  ];
}

export function getSearchRadiusForType(providerType) {
  const type = String(providerType || "").toLowerCase();

  if (
    type === "restaurant" ||
    type === "cafe" ||
    type === "bar" ||
    type === "hotel" ||
    type === "motel" ||
    type === "gas station"
  ) {
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

  return {
    id: `tomtom:${providerPlaceId}`,
    provider: "tomtom",
    providerPlaceId,
    tomtomPlaceId: providerPlaceId,

    name: result.poi?.name || "Unnamed place",
    category: fallbackCategory || result.poi?.categories?.[0] || "place",
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

  const response = await fetch(url, {
    method: "GET",
  });

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
    logger.log("[poiService] TomTom POI error:", responseText);
    throw new Error(`TomTom POI request failed with status ${response.status}.`);
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
