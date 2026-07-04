/**
 * utils/routeDistance.js
 *
 * Helpers for measuring where a POI sits along a route.
 *
 * POI proximity is measured against route segments, and route progress is
 * estimated from cumulative travelled distance. Invalid or degenerate routes
 * fall back to the original closest-coordinate approximation.
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

function isValidCoordinate(coord) {
  return (
    coord &&
    typeof coord.latitude === "number" &&
    typeof coord.longitude === "number" &&
    Number.isFinite(coord.latitude) &&
    Number.isFinite(coord.longitude)
  );
}

function toPlanarPointMeters(origin, point) {
  if (!isValidCoordinate(origin) || !isValidCoordinate(point)) return null;

  const earthRadiusMeters = 6371000;
  const originLatitudeRadians = toRadians(origin.latitude);

  return {
    x:
      toRadians(point.longitude - origin.longitude) *
      earthRadiusMeters *
      Math.cos(originLatitudeRadians),
    y:
      toRadians(point.latitude - origin.latitude) * earthRadiusMeters,
  };
}

function getClosestPointOnSegment(point, segmentStart, segmentEnd) {
  const planarPoint = toPlanarPointMeters(segmentStart, point);
  const planarSegmentEnd = toPlanarPointMeters(segmentStart, segmentEnd);

  if (!planarPoint || !planarSegmentEnd) return null;

  const segmentLengthSquared =
    planarSegmentEnd.x * planarSegmentEnd.x +
    planarSegmentEnd.y * planarSegmentEnd.y;

  if (segmentLengthSquared === 0) {
    return {
      point: { x: 0, y: 0 },
      planarPoint,
      projectionFactor: 0,
    };
  }

  const unboundedProjectionFactor =
    (planarPoint.x * planarSegmentEnd.x +
      planarPoint.y * planarSegmentEnd.y) /
    segmentLengthSquared;
  const projectionFactor = Math.min(
    Math.max(unboundedProjectionFactor, 0),
    1,
  );

  return {
    point: {
      x: planarSegmentEnd.x * projectionFactor,
      y: planarSegmentEnd.y * projectionFactor,
    },
    planarPoint,
    projectionFactor,
  };
}

function getDistanceToRouteSegmentMeters(
  point,
  segmentStart,
  segmentEnd,
) {
  const closestPoint = getClosestPointOnSegment(
    point,
    segmentStart,
    segmentEnd,
  );

  if (!closestPoint) {
    return {
      distanceMeters: Infinity,
      projectionFactor: 0,
    };
  }

  return {
    distanceMeters: Math.hypot(
      closestPoint.planarPoint.x - closestPoint.point.x,
      closestPoint.planarPoint.y - closestPoint.point.y,
    ),
    projectionFactor: closestPoint.projectionFactor,
  };
}

function getClosestCoordinateInfo(poi, routeCoords) {
  let closestIndex = 0;
  let closestDistanceMeters = Infinity;

  routeCoords.forEach((routePoint, index) => {
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

  const routeProgress =
    routeCoords.length > 1 ? closestIndex / (routeCoords.length - 1) : 0;

  return {
    closestIndex,
    closestDistanceMeters,
    routeProgress,
    routeProgressPercent: Math.round(routeProgress * 100),
  };
}

/**
 * Finds the closest route segment to a POI and estimates progress from the
 * cumulative travelled distance at the projected point.
 *
 * @param {{ latitude: number, longitude: number }} poi
 * @param {Array<{ latitude: number, longitude: number }>} routeCoords
 * @returns {{
 *   closestIndex: number,
 *   closestDistanceMeters: number,
 *   routeProgress: number,
 *   routeProgressPercent: number,
 *   closestSegmentStartIndex?: number,
 *   closestSegmentEndIndex?: number,
 *   distanceAlongRouteMeters?: number,
 *   totalRouteDistanceMeters?: number
 * } | null}
 */
export function getClosestRoutePointInfo(poi, routeCoords = []) {
  if (!poi || !Array.isArray(routeCoords) || routeCoords.length === 0) {
    return null;
  }

  const fallbackInfo = () => getClosestCoordinateInfo(poi, routeCoords);

  if (
    !isValidCoordinate(poi) ||
    routeCoords.length < 2 ||
    !routeCoords.every(isValidCoordinate)
  ) {
    return fallbackInfo();
  }

  let cumulativeDistanceMeters = 0;
  let bestSegmentInfo = null;

  for (let index = 0; index < routeCoords.length - 1; index += 1) {
    const segmentStart = routeCoords[index];
    const segmentEnd = routeCoords[index + 1];
    const segmentDistanceMeters = getDistanceMeters(segmentStart, segmentEnd);

    if (
      !Number.isFinite(segmentDistanceMeters) ||
      segmentDistanceMeters < 0
    ) {
      return fallbackInfo();
    }

    const segmentProximity = getDistanceToRouteSegmentMeters(
      poi,
      segmentStart,
      segmentEnd,
    );
    const distanceAlongRouteMeters =
      cumulativeDistanceMeters +
      segmentDistanceMeters * segmentProximity.projectionFactor;

    if (
      Number.isFinite(segmentProximity.distanceMeters) &&
      (!bestSegmentInfo ||
        segmentProximity.distanceMeters < bestSegmentInfo.distanceMeters)
    ) {
      bestSegmentInfo = {
        distanceMeters: segmentProximity.distanceMeters,
        distanceAlongRouteMeters,
        startIndex: index,
        endIndex: index + 1,
      };
    }

    cumulativeDistanceMeters += segmentDistanceMeters;
  }

  if (
    !bestSegmentInfo ||
    !Number.isFinite(cumulativeDistanceMeters) ||
    cumulativeDistanceMeters <= 0
  ) {
    return fallbackInfo();
  }

  const routeProgress = Math.min(
    Math.max(
      bestSegmentInfo.distanceAlongRouteMeters / cumulativeDistanceMeters,
      0,
    ),
    1,
  );

  return {
    closestIndex: bestSegmentInfo.startIndex,
    closestDistanceMeters: bestSegmentInfo.distanceMeters,
    routeProgress,
    routeProgressPercent: Math.round(routeProgress * 100),
    closestSegmentStartIndex: bestSegmentInfo.startIndex,
    closestSegmentEndIndex: bestSegmentInfo.endIndex,
    distanceAlongRouteMeters: bestSegmentInfo.distanceAlongRouteMeters,
    totalRouteDistanceMeters: cumulativeDistanceMeters,
  };
}

/**
 * Adds route-position metadata to each POI and returns POIs sorted from
 * earliest to latest appearance along the route.
 *
 * Output fields added:
 * - closestRouteDistanceMeters: Approximate POI-to-route-segment proximity.
 * - closestRouteIndex: Closest segment's start index.
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
          closestRouteDistanceMeters: null, // Approximate POI-to-route-segment proximity is unknown.
          closestRouteIndex: null, // Closest route segment index is unknown.
          routeProgress: null, // Continuous value from 0 to 1 is unknown.
          routeProgressPercent: null, // Rounded UI-friendly progress percentage is unknown.
        };
      }

      return {
        ...poi,
        closestRouteDistanceMeters: routeInfo.closestDistanceMeters, // Approximate POI-to-route-segment proximity in meters.
        closestRouteIndex: routeInfo.closestIndex, // Closest segment's start index, or fallback coordinate index.
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
