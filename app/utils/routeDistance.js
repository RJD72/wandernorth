/**
 * utils/routeDistance.js
 *
 * Helpers for measuring where a POI sits along a route.
 *
 * This does not need to be perfect yet.
 * It gives us a useful approximation:
 * - Find the closest route coordinate to the POI
 * - Use that coordinate's index to estimate route progress
 */

/**
 * Converts angular degrees to radians.
 *
 * JavaScript trigonometric functions (Math.sin, Math.cos, etc.) expect radian
 * input, so geospatial values from APIs (usually in degrees) need conversion.
 *
 * @param {number} degrees
 * @returns {number}
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculates distance between two lat/lng points in meters.
 *
 * Uses the Haversine formula.
 *
 * Why Haversine here:
 * - It is accurate enough for route/POI UX decisions.
 * - It handles global lat/lng values better than simple planar math.
 * - It keeps implementation small and dependency-free.
 *
 * Defensive behavior:
 * Returning Infinity for invalid input ensures callers that compare distances
 * naturally treat invalid pairs as "worst match" without special-case code.
 *
 * @param {{ latitude: number, longitude: number }} pointA
 * @param {{ latitude: number, longitude: number }} pointB
 * @returns {number} Great-circle distance in meters
 */
export function getDistanceMeters(pointA, pointB) {
  if (!pointA || !pointB) return Infinity;

  // Mean Earth radius in meters, commonly used for Haversine calculations.
  const earthRadiusMeters = 6371000;

  const lat1 = toRadians(pointA.latitude); // We only need to convert latitudes to radians once for each point.
  const lat2 = toRadians(pointB.latitude); // Longitudes are converted to radians in the delta calculation since we only need their difference.

  const deltaLat = toRadians(pointB.latitude - pointA.latitude); // This is the difference in latitudes, converted to radians.
  const deltaLng = toRadians(pointB.longitude - pointA.longitude); // This is the difference in longitudes, converted to radians.

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

/**
 * Finds the closest sampled route coordinate to a POI and estimates route
 * progress based on that coordinate's index.
 *
 * Note on approximation:
 * We measure distance to discrete route points, not to route segments.
 * This is fast and usually good enough for ordering/labeling stops, but it is
 * not a mathematically exact "distance to polyline" projection.
 *
 * @param {{ latitude: number, longitude: number }} poi
 * @param {Array<{ latitude: number, longitude: number }>} routeCoords
 * @returns {{
 *   closestIndex: number,
 *   closestDistanceMeters: number,
 *   routeProgress: number,
 *   routeProgressPercent: number
 * } | null}
 */
export function getClosestRoutePointInfo(poi, routeCoords = []) {
  if (!poi || !Array.isArray(routeCoords) || routeCoords.length === 0) {
    // Defensive handling of invalid input: if we don't have a valid POI or route coordinates, we cannot compute meaningful proximity info, so we return null.
    return null;
  }

  let closestIndex = 0;
  let closestDistanceMeters = Infinity;

  routeCoords.forEach((routePoint, index) => {
    // Compare POI -> current route coordinate distance.
    const distanceMeters = getDistanceMeters(
      {
        latitude: poi.latitude,
        longitude: poi.longitude,
      },
      routePoint,
    );

    if (distanceMeters < closestDistanceMeters) {
      closestDistanceMeters = distanceMeters;
      closestIndex = index;
    }
  });

  // Normalize index into [0, 1] so downstream UI can reason in percentages.
  const routeProgress =
    routeCoords.length > 1 ? closestIndex / (routeCoords.length - 1) : 0;

  return {
    closestIndex, // Useful for debugging and potential future features, even if not currently used in UI.
    closestDistanceMeters, // This is the key value for determining how "close" a POI is to the route.
    routeProgress, // Continuous value from 0 to 1 representing progress along the route.
    routeProgressPercent: Math.round(routeProgress * 100), // Rounded percentage for easier UI display and labeling.
  };
}

/**
 * Adds route-position metadata to each POI and returns POIs sorted from
 * earliest to latest appearance along the route.
 *
 * Output fields added:
 * - closestRouteDistanceMeters: Approximate POI-to-route proximity.
 * - closestRouteIndex: Nearest sampled route coordinate index.
 * - routeProgress: Continuous value from 0 to 1.
 * - routeProgressPercent: Rounded UI-friendly progress percentage.
 *
 * Null-handling strategy:
 * If route info cannot be computed (for example no route coordinates), fields
 * are set to null so callers can distinguish "unknown" from a numeric value.
 *
 * Sorting behavior:
 * POIs with unknown progress are sorted last via fallback value 999.
 *
 * @param {Array<object>} pois
 * @param {Array<{ latitude: number, longitude: number }>} routeCoords
 * @returns {Array<object>}
 */
export function attachRoutePositionToPois(pois = [], routeCoords = []) {
  if (!Array.isArray(pois)) return [];

  return pois
    .map((poi) => {
      const routeInfo = getClosestRoutePointInfo(poi, routeCoords);

      if (!routeInfo) {
        return {
          ...poi,
          closestRouteDistanceMeters: null, // Approximate POI-to-route proximity is unknown.
          closestRouteIndex: null, // Nearest sampled route coordinate index is unknown.
          routeProgress: null, // Continuous value from 0 to 1 is unknown.
          routeProgressPercent: null, // Rounded UI-friendly progress percentage is unknown.
        };
      }

      return {
        ...poi,
        closestRouteDistanceMeters: routeInfo.closestDistanceMeters, // Approximate POI-to-route proximity in meters, used for determining "closeness".
        closestRouteIndex: routeInfo.closestIndex, // Nearest sampled route coordinate index, useful for debugging and potential future features.
        routeProgress: routeInfo.routeProgress, // Continuous value from 0 to 1 representing progress along the route, used for ordering and potential UI features.
        routeProgressPercent: routeInfo.routeProgressPercent, // Rounded UI-friendly progress percentage, used for labeling and display purposes.
      };
    })
    .sort((a, b) => {
      const aProgress = a.routeProgress ?? 999; // POIs with unknown progress are sorted last via fallback value 999.
      const bProgress = b.routeProgress ?? 999; // POIs with unknown progress are sorted last via fallback value 999.

      return aProgress - bProgress;
    });
}
