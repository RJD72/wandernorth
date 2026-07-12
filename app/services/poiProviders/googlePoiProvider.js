import { logger } from "../../utils/logger";
import { trackExternalRequest } from "../apiUsageTracker";
import {
  getCanonicalPoiCategoryId,
  getGoogleTypesForPoiCategoryIds,
  getPoiCategoryIdForGoogleType,
} from "../../config/poiCategories";

const GOOGLE_PLACES_NEARBY_URL =
  "https://places.googleapis.com/v1/places:searchNearby";

const LEGACY_GOOGLE_PLACE_TYPE_MAP = {
  bar: ["bar"],
  bars: ["bar"],
  lodging: ["lodging"],
  hotel: ["lodging"],
  hotels: ["lodging"],
  motel: ["lodging"],
  motels: ["lodging"],
};

/**
 * Fallback types when the user has not selected any POI filters.
 *
 * Keep this conservative so you don't burn API calls or return chaos.
 */
const DEFAULT_GOOGLE_TYPES = ["cafe", "restaurant", "tourist_attraction"];

const RESTAURANT_GOOGLE_TYPES = new Set([
  "restaurant",
  "breakfast_restaurant",
  "fast_food_restaurant",
  "pizza_restaurant",
  "italian_restaurant",
  "chinese_restaurant",
  "sushi_restaurant",
  "mexican_restaurant",
  "thai_restaurant",
  "indian_restaurant",
  "seafood_restaurant",
  "steak_house",
  "vegan_restaurant",
  "vegetarian_restaurant",
]);

const WIDER_RADIUS_GOOGLE_TYPES = new Set([
  ...RESTAURANT_GOOGLE_TYPES,
  "cafe",
  "coffee_shop",
  "bakery",
  "donut_shop",
  "ice_cream_shop",
  "bar",
  "lodging",
  "gas_station",
]);

function getGoogleTypesForCategoryId(categoryId) {
  const normalizedCategoryId = String(categoryId || "")
    .trim()
    .toLowerCase();
  const configuredTypes = getGoogleTypesForPoiCategoryIds([
    normalizedCategoryId,
  ]);

  if (configuredTypes.length > 0) {
    return configuredTypes;
  }

  return LEGACY_GOOGLE_PLACE_TYPE_MAP[normalizedCategoryId] || [];
}

/**
 * Converts app POI type ids into Google Places API types.
 *
 * Why this exists:
 * UI filters use app-facing ids (for example: "attraction"), while Google
 * Nearby Search expects specific Place type strings (for example:
 * "tourist_attraction"). This translation layer keeps Google-specific naming
 * isolated to the provider layer.
 *
 * Unknown app ids are dropped and duplicate Google types are removed.
 *
 * @param {string[]} selectedPoiTypes
 * @returns {string[]} Google Places includedTypes values
 */
export function normalizeSelectedPoiTypes(selectedPoiTypes = []) {
  if (!Array.isArray(selectedPoiTypes)) {
    return [];
  }

  const mappedTypes = selectedPoiTypes.flatMap(getGoogleTypesForCategoryId);

  return [...new Set(mappedTypes)];
}

export function getProviderPoiTypes(selectedPoiTypes = []) {
  const mappedTypes = normalizeSelectedPoiTypes(selectedPoiTypes);

  return mappedTypes.length > 0 ? mappedTypes : DEFAULT_GOOGLE_TYPES;
}

export function prioritizeProviderPoiTypesForSearch(
  providerTypes = [],
  selectedPoiTypes = [],
) {
  const uniqueProviderTypes = [...new Set(providerTypes)];

  const explicitlySelectedRestaurant =
    Array.isArray(selectedPoiTypes) &&
    selectedPoiTypes.some((type) => {
      return getGoogleTypesForCategoryId(type).some((googleType) =>
        RESTAURANT_GOOGLE_TYPES.has(googleType),
      );
    });

  if (!explicitlySelectedRestaurant) {
    return uniqueProviderTypes;
  }

  return [
    ...uniqueProviderTypes.filter((type) => RESTAURANT_GOOGLE_TYPES.has(type)),
    ...uniqueProviderTypes.filter((type) => !RESTAURANT_GOOGLE_TYPES.has(type)),
  ];
}

export function getSearchRadiusForType(providerType) {
  const type = String(providerType || "").toLowerCase();

  /**
   * Restaurants, gas, and lodging are often clustered around towns,
   * not exactly beside the sampled highway coordinate
   */
  if (WIDER_RADIUS_GOOGLE_TYPES.has(type)) {
    return 6000;
  }

  /**
   * Parks and attractions can stay tighter because a huge radius can pull in
   * unrelated outdoor areas that are not really route-relevant
   */
  return 3500;
}

/**
 * Normalizes a Google Place object into the shape your app expects.
 *
 * Why this exists:
 * Google API responses are rich and nested. UI components and store logic are
 * easier to maintain when they receive one stable object shape.
 *
 * Validation note:
 * A place without valid coordinates is not usable on maps or route overlays,
 * so we return null and let the caller filter it out.
 *
 * @param {object} place Raw place from Google Places Nearby Search
 * @param {string} fallbackCategory Type requested in the current query
 * @returns {object|null} Normalized POI object or null when unusable
 */
function normalizeGooglePlace(place, fallbackCategory) {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  const providerCategory = fallbackCategory || place.primaryType || null;
  const appCategory =
    getPoiCategoryIdForGoogleType(fallbackCategory) ||
    getPoiCategoryIdForGoogleType(place.primaryType) ||
    getCanonicalPoiCategoryId(fallbackCategory) ||
    "other";

  return {
    id: place.id,
    provider: "google",
    providerPlaceId: place.id,
    googlePlaceId: place.id,

    name: place.displayName?.text || "Unnamed place",
    category: appCategory,
    providerCategory,
    googlePrimaryType: place.primaryType || null,
    address: place.formattedAddress || "",

    latitude,
    longitude,

    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    googleMapsUri: place.googleMapsUri || null,
  };
}

/**
 * Fetches nearby places around one route sample point for one Google type.
 *
 * Request strategy:
 * - Each call targets one (point, type) pair.
 * - rankPreference "DISTANCE" prioritizes places closer to the point over purely
 *   popular places, which generally gives better stop recommendations.
 * - A small field mask limits payload size and billing scope.
 *
 * Error behavior:
 * - Missing API key throws immediately with a clear setup message.
 * - Non-2xx Google responses are logged and re-thrown with the API message.
 * - Successful responses are normalized and invalid records are filtered out.
 *
 * @param {object} args
 * @param {{ latitude: number, longitude: number }} args.point
 * @param {string} args.providerType
 * @param {number} [args.radiusMeters=3000]
 * @param {number} [args.maxResultCount=5]
 * @returns {Promise<object[]>}
 */
export async function fetchPoisForRoutePointAndType({
  point,
  providerType,
  radiusMeters = 3000,
  maxResultCount = 5,
}) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const androidPackageName = process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME;
  const androidCertSha1 = process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1;

  if (!apiKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to your .env file.",
    );
  }

  const response = await trackExternalRequest("google", "places-nearby", () =>
    fetch(GOOGLE_PLACES_NEARBY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Android-Package": androidPackageName,
        "X-Android-Cert": androidCertSha1,
        /**
         * Keep this field mask lean.
         * More fields can increase cost and payload size.
         *
         * We include only what downstream screens need now:
         * identity, display text, coordinates, category, lightweight quality
         * signals, and a maps deep link.
         */
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.rating,places.userRatingCount,places.googleMapsUri",
      },
      body: JSON.stringify({
        includedTypes: [providerType],
        maxResultCount,
        rankPreference: "DISTANCE",
        regionCode: "CA",
        locationRestriction: {
          circle: {
            center: {
              latitude: point.latitude,
              longitude: point.longitude,
            },
            radius: radiusMeters,
          },
        },
      }),
    }),
  );

  const data = await response.json();

  logger.log("[poiService] Google Places raw result:", {
    googleType: providerType,
    radiusMeters,
    point,
    status: response.status,
    placeCount: data.places?.length ?? 0,
    firstPlace: data.places?.[0]?.displayName?.text ?? null,
  });

  if (!response.ok) {
    logger.log("[poiService] Google Places error:", data);
    throw new Error(data.error?.message || "Google Places request failed.");
  }

  return (data.places || [])
    .map((place) => normalizeGooglePlace(place, providerType))
    .filter(Boolean);
}

export const googlePoiProvider = {
  id: "google",
  normalizeSelectedPoiTypes,
  getProviderPoiTypes,
  prioritizeProviderPoiTypesForSearch,
  getSearchRadiusForType,
  fetchPoisForRoutePointAndType,
};
