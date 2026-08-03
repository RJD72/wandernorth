import { getClosestRoutePointInfo } from "./routeDistance";
import { getStopCoords } from "./stopUtils";

export const MAX_GOOGLE_MAPS_WAYPOINTS = 9;

function isValidCoordinate(coords) {
  return (
    coords &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

function getUsableRoute(routeCoords) {
  if (!Array.isArray(routeCoords) || routeCoords.length === 0) return null;
  return routeCoords.every(isValidCoordinate) ? routeCoords : null;
}

function getFallbackProgress(stop, routePointCount) {
  if (Number.isFinite(stop?.routeProgress)) {
    return Math.min(Math.max(stop.routeProgress, 0), 1);
  }

  if (
    Number.isFinite(stop?.closestRouteIndex) &&
    Number.isInteger(routePointCount) &&
    routePointCount > 0
  ) {
    if (routePointCount === 1) return 0;
    return Math.min(
      Math.max(stop.closestRouteIndex / (routePointCount - 1), 0),
      1,
    );
  }

  return null;
}

function withRouteMetadata(stop, routeCoords, routePointCount) {
  const coords = getStopCoords(stop);
  const routeInfo = routeCoords
    ? getClosestRoutePointInfo(coords, routeCoords)
    : null;

  if (routeInfo) {
    return {
      ...stop,
      closestRouteDistanceMeters: routeInfo.closestDistanceMeters,
      closestRouteIndex: routeInfo.closestIndex,
      routeProgress: routeInfo.routeProgress,
      routeProgressPercent: routeInfo.routeProgressPercent,
    };
  }

  const routeProgress = getFallbackProgress(stop, routePointCount);

  return {
    ...stop,
    closestRouteDistanceMeters: Number.isFinite(
      stop?.closestRouteDistanceMeters,
    )
      ? stop.closestRouteDistanceMeters
      : null,
    closestRouteIndex: Number.isFinite(stop?.closestRouteIndex)
      ? stop.closestRouteIndex
      : null,
    routeProgress,
    routeProgressPercent:
      routeProgress === null ? null : Math.round(routeProgress * 100),
  };
}

export function prepareStopsForRouteHandoff(stops = [], routeCoords = []) {
  if (!Array.isArray(stops)) {
    return { orderedStops: [], invalidStops: [] };
  }

  const usableRoute = getUsableRoute(routeCoords);
  const validStops = [];
  const invalidStops = [];

  stops.forEach((stop, originalIndex) => {
    const coords = getStopCoords(stop);
    if (!isValidCoordinate(coords)) {
      invalidStops.push(stop);
      return;
    }

    validStops.push({
      originalIndex,
      stop: withRouteMetadata(
        stop,
        usableRoute,
        Array.isArray(routeCoords) ? routeCoords.length : null,
      ),
    });
  });

  validStops.sort((a, b) => {
    const aProgress = Number.isFinite(a.stop.routeProgress)
      ? a.stop.routeProgress
      : Number.POSITIVE_INFINITY;
    const bProgress = Number.isFinite(b.stop.routeProgress)
      ? b.stop.routeProgress
      : Number.POSITIVE_INFINITY;

    return aProgress - bProgress || a.originalIndex - b.originalIndex;
  });

  return {
    orderedStops: validStops.map(({ stop }) => stop),
    invalidStops,
  };
}

function formatCoordinates(coords) {
  return `${coords.latitude},${coords.longitude}`;
}

export function buildGoogleMapsDirectionsUrl({
  origin,
  destination,
  orderedStops = [],
  travelMode,
}) {
  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
    throw new Error("The route start or destination is missing coordinates.");
  }
  if (!Array.isArray(orderedStops)) {
    throw new Error("The selected stops are invalid.");
  }
  if (orderedStops.length > MAX_GOOGLE_MAPS_WAYPOINTS) {
    throw new Error(
      `Google Maps supports up to ${MAX_GOOGLE_MAPS_WAYPOINTS} Wander North stops.`,
    );
  }

  const waypointCoords = orderedStops.map(getStopCoords);
  if (waypointCoords.some((coords) => !isValidCoordinate(coords))) {
    throw new Error("One or more selected stops is missing valid coordinates.");
  }

  const queryValues = [
    ["api", "1"],
    ["origin", formatCoordinates(origin)],
    ["destination", formatCoordinates(destination)],
    ["travelmode", travelMode || "driving"],
  ];

  if (waypointCoords.length > 0) {
    queryValues.push([
      "waypoints",
      waypointCoords.map(formatCoordinates).join("|"),
    ]);
  }

  const queryString = queryValues
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");

  return `https://www.google.com/maps/dir/?${queryString}`;
}
