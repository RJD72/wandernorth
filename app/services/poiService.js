/**
 * services/poiService.js
 *
 * Fetches real POIs near sampled route points using Google Places Nearby Search (New).
 *
 * Current strategy:
 * 1. route.jsx samples a few points along the route.
 * 2. This service searches near each sample point.
 * 3. Results are normalized into one simple app-friendly shape.
 * 4. Duplicate Google places are removed.
 * 5. The final list is returned to route.jsx.
 */

const GOOGLE_PLACES_NEARBY_URL =
  "https://places.googleapis.com/v1/places:searchNearby";

/**
 * Map your app's POI type ids to Google Places API types.
 *
 * Important:
 * These values must be valid Google Places "includedTypes" values.
 * Keep this simple at first.
 */
const GOOGLE_PLACE_TYPE_MAP = {
  "cafe": "cafe",
  "coffee": "cafe",
  "coffee_shop": "cafe",

  "restaurant": "restaurant",
  "restaurants": "restaurant",
  "food": "restaurant",

  "bar": "bar",
  "bars": "bar",

  "attraction": "tourist_attraction",
  "attractions": "tourist_attraction",
  "tourist_attraction": "tourist_attraction",

  "park": "park",
  "parks": "park",

  "museum": "museum",
  "museums": "museum",

  "lodging": "lodging",
  "hotel": "lodging",
  "hotels": "lodging",
  "motel": "lodging",
  "motels": "lodging",

  "gas": "gas_station",
  "gas_station": "gas_station",
  "gas_stations": "gas_station",
  "gas station": "gas_station",
  "fuel": "gas_station",
};

/**
 * Fallback types when the user has not selected any POI filters.
 *
 * Keep this conservative so you don't burn API calls or return chaos.
 */
const DEFAULT_GOOGLE_TYPES = ["cafe", "restaurant", "tourist_attraction"];

// Todo: These temporary limits are for development safety. Remove them later when you have confidence in the service's behavior and performance.
const MAX_ROUTE_POINTS_TO_SEARCH = 4;
const MAX_POI_TYPES_TO_SEARCH = 2;

/**
 * Converts app POI type ids into Google Places API types.
 *
 * Why this exists:
 * UI filters use app-facing ids (for example: "attraction"), while Google
 * Nearby Search expects specific Place type strings (for example:
 * "tourist_attraction"). This translation layer keeps Google-specific naming
 * isolated to the service layer.
 *
 * Behavior details:
 * - If input is missing/empty/not an array, we fall back to default types.
 * - Unknown app ids are dropped via filter(Boolean).
 * - If every selected id is unknown, we still return defaults instead of an
 *   empty list so callers always have useful search behavior.
 *
 * @param {string[]} selectedPoiTypes
 * @returns {string[]} Google Places includedTypes values
 */
function getGooglePlaceTypes(selectedPoiTypes = []) {
  if (!Array.isArray(selectedPoiTypes) || selectedPoiTypes.length === 0) {
    return DEFAULT_GOOGLE_TYPES;
  }

  const mappedTypes = selectedPoiTypes
    .map((type) => GOOGLE_PLACE_TYPE_MAP[String(type).trim().toLowerCase()])
    .filter(Boolean);

  return mappedTypes.length > 0 ? mappedTypes : DEFAULT_GOOGLE_TYPES;
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

  return {
    id: place.id,
    googlePlaceId: place.id,

    name: place.displayName?.text || "Unnamed place",
    category: fallbackCategory || place.primaryType || "place",
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
 * @param {string} args.googleType
 * @param {number} [args.radiusMeters=3000]
 * @param {number} [args.maxResultCount=5]
 * @returns {Promise<object[]>}
 */
async function fetchNearbyPlacesForPoint({
  point,
  googleType,
  radiusMeters = 3000,
  maxResultCount = 5,
}) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to your .env file.",
    );
  }

  const response = await fetch(GOOGLE_PLACES_NEARBY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,

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
      includedTypes: [googleType],
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
  });

  const data = await response.json();

  console.log("[poiService] Google Places raw result:", {
    googleType,
    radiusMeters,
    point,
    status: response.status,
    placeCount: data.places?.length ?? 0,
    firstPlace: data.places?.[0]?.displayName?.text ?? null,
  });

  if (!response.ok) {
    console.log("[poiService] Google Places error:", data);
    throw new Error(data.error?.message || "Google Places request failed.");
  }

  return (data.places || [])
    .map((place) => normalizeGooglePlace(place, googleType))
    .filter(Boolean);
}

/**
 * Removes duplicate places by Google place id.
 *
 * Why duplicates happen:
 * Multiple route sample points can overlap geographically. The same business
 * can therefore appear in several Nearby Search responses.
 *
 * Dedupe policy:
 * - Prefer googlePlaceId, fallback to id.
 * - Drop records that have no stable id.
 * - Keep the first occurrence and skip subsequent duplicates.
 *
 * @param {object[]} pois
 * @returns {object[]} De-duplicated POI list
 */
function dedupePois(pois = []) {
  const seen = new Set();

  return pois.filter((poi) => {
    const key = poi.googlePlaceId || poi.id;

    if (!key) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
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

function getSearchRadiusForType(googleType) {
  const type = String(googleType || "").toLowerCase();

  /**
   * Restaurants, gas, and lodging are often clustered around towns,
   * not exactly beside the sampled highway coordinate
   */
  if (
    type === "restaurant" ||
    type === "cafe" ||
    type === "bar" ||
    type === "lodging" ||
    type === "gas_station"
  ) {
    return 6000;
  }

  /**
   * Parks and attractions can stay tighter because a huge radius can pull in
   * unrelated outdoor areas that are not really route-relevant
   */
  return 3500;
}

/**
 * Main function used by route.jsx.
 *
 * End-to-end flow:
 * 1. Validate route points and resolve Google types.
 * 2. Apply temporary call caps to control API cost/latency during iteration.
 * 3. Build a request matrix of (point x type).
 * 4. Execute all requests concurrently with Promise.allSettled so one failing
 *    request does not fail the whole batch.
 * 5. Flatten successful results, de-duplicate, and return the top N stops.
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

  const googleTypes = getGooglePlaceTypes(selectedPoiTypes);

  if (googleTypes.length === 0) {
    console.log(
      "[poiService] No valid Google POI types found for:",
      selectedPoiTypes,
    );
    return [];
  }

  const pointsToSearch = getEvenlySpacedRoutePoints(
    routePoints,
    MAX_ROUTE_POINTS_TO_SEARCH,
  );
  const typesToSearch = googleTypes.slice(0, MAX_POI_TYPES_TO_SEARCH);

  console.log(
    "[poiService] Incoming sampled route points:",
    routePoints.length,
  );
  console.log("[poiService] Points actually searched:", pointsToSearch.length);
  console.log("[poiService] Types actually searched:", typesToSearch);
  console.log(
    "[poiService] Search request count:",
    pointsToSearch.length * typesToSearch.length,
  );

  // Build all request promises first so they can execute in parallel.
  const requests = [];

  for (const point of pointsToSearch) {
    for (const googleType of typesToSearch) {
      requests.push(
        fetchNearbyPlacesForPoint({
          point,
          googleType,
          radiusMeters: getSearchRadiusForType(googleType),
          maxResultCount: 5,
        }),
      );
    }
  }

  const settledResults = await Promise.allSettled(requests);

  // Keep successful batches; log and ignore failures to preserve resilience.
  const allPois = settledResults.flatMap((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    console.log("[poiService] One POI request failed:", result.reason);
    return [];
  });

  const dedupedPois = dedupePois(allPois);

  /**
   * Return the full candidate pool.
   *
   * Important:
   * Do NOT slice to safeNumStops here anymore.
   *
   * poiService's job is to fetch possible stops.
   * poiScoring.js decides which stops are actually worth showing.
   */
  return dedupedPois;
}
