import { getDistanceMeters } from "./routeDistance";

const SAMPLE_PERCENTAGES = [0.15, 0.3, 0.5, 0.75, 0.95];
const CUSTOM_STOP_SEARCH_PERCENTAGES = [0, 0.25, 0.5, 0.75, 1];

function isValidCoordinate(coord) {
  return (
    coord &&
    typeof coord.latitude === "number" &&
    typeof coord.longitude === "number" &&
    Number.isFinite(coord.latitude) &&
    Number.isFinite(coord.longitude)
  );
}

function removeDuplicateCoordinates(coords) {
  const seenCoordinates = new Set();

  return coords.filter((coord) => {
    if (!isValidCoordinate(coord)) return false;

    const coordinateKey = `${coord.latitude},${coord.longitude}`;

    if (seenCoordinates.has(coordinateKey)) return false;

    seenCoordinates.add(coordinateKey);
    return true;
  });
}

function getIndexBasedSamplePoints(routeCoords) {
  return removeDuplicateCoordinates(
    SAMPLE_PERCENTAGES.map((percentage) => {
      const index = Math.floor((routeCoords.length - 1) * percentage);
      return routeCoords[index];
    }),
  );
}

/**
 * Extracts up to five POI search points at fixed travelled-distance
 * percentages along a route.
 *
 * @param {Array<{ latitude: number, longitude: number }>} routeCoords
 * @returns {Array<{ latitude: number, longitude: number }>}
 */
export function getSamplePointsAlongRoute(routeCoords = []) {
  if (!Array.isArray(routeCoords) || routeCoords.length === 0) return [];

  const validRouteCoords = routeCoords.filter(isValidCoordinate);

  if (validRouteCoords.length === 0) return [];
  if (validRouteCoords.length === 1) return [validRouteCoords[0]];

  const cumulativePoints = [{ coord: validRouteCoords[0], distanceMeters: 0 }];
  let totalDistanceMeters = 0;

  for (let index = 1; index < validRouteCoords.length; index += 1) {
    const segmentDistanceMeters = getDistanceMeters(
      validRouteCoords[index - 1],
      validRouteCoords[index],
    );

    if (!Number.isFinite(segmentDistanceMeters) || segmentDistanceMeters < 0) {
      return getIndexBasedSamplePoints(validRouteCoords);
    }

    totalDistanceMeters += segmentDistanceMeters;
    cumulativePoints.push({
      coord: validRouteCoords[index],
      distanceMeters: totalDistanceMeters,
    });
  }

  if (!Number.isFinite(totalDistanceMeters) || totalDistanceMeters <= 0) {
    return getIndexBasedSamplePoints(validRouteCoords);
  }

  const sampledCoords = SAMPLE_PERCENTAGES.map((percentage) => {
    const targetDistanceMeters = totalDistanceMeters * percentage;
    const cumulativePoint = cumulativePoints.find(
      (point) => point.distanceMeters >= targetDistanceMeters,
    );

    return cumulativePoint?.coord;
  });

  return removeDuplicateCoordinates(sampledCoords);
}

function buildTravelledDistanceRoute(routeCoords) {
  if (!Array.isArray(routeCoords)) return null;

  const validRouteCoords = routeCoords.filter(isValidCoordinate);
  if (validRouteCoords.length === 0) return null;

  const cumulativePoints = [{ coord: validRouteCoords[0], distanceMeters: 0 }];
  let totalDistanceMeters = 0;

  for (let index = 1; index < validRouteCoords.length; index += 1) {
    const segmentDistanceMeters = getDistanceMeters(
      validRouteCoords[index - 1],
      validRouteCoords[index],
    );

    if (!Number.isFinite(segmentDistanceMeters) || segmentDistanceMeters < 0) {
      return null;
    }

    totalDistanceMeters += segmentDistanceMeters;
    cumulativePoints.push({
      coord: validRouteCoords[index],
      distanceMeters: totalDistanceMeters,
    });
  }

  return { cumulativePoints, totalDistanceMeters, validRouteCoords };
}

export function getRoutePointAtDistancePercentage(
  routeCoords = [],
  percentage = 0.5,
) {
  const travelledRoute = buildTravelledDistanceRoute(routeCoords);
  if (!travelledRoute) return null;

  const { cumulativePoints, totalDistanceMeters, validRouteCoords } =
    travelledRoute;
  if (validRouteCoords.length === 1 || totalDistanceMeters <= 0) {
    return validRouteCoords[0];
  }

  const boundedPercentage = Math.min(Math.max(percentage, 0), 1);
  const targetDistanceMeters = totalDistanceMeters * boundedPercentage;
  const endIndex = cumulativePoints.findIndex(
    (point) => point.distanceMeters >= targetDistanceMeters,
  );

  if (endIndex <= 0) return validRouteCoords[0];
  if (endIndex === -1) return validRouteCoords[validRouteCoords.length - 1];

  const segmentStart = cumulativePoints[endIndex - 1];
  const segmentEnd = cumulativePoints[endIndex];
  const segmentDistanceMeters =
    segmentEnd.distanceMeters - segmentStart.distanceMeters;
  const segmentProgress =
    segmentDistanceMeters > 0
      ? (targetDistanceMeters - segmentStart.distanceMeters) /
        segmentDistanceMeters
      : 0;

  return {
    latitude:
      segmentStart.coord.latitude +
      (segmentEnd.coord.latitude - segmentStart.coord.latitude) *
        segmentProgress,
    longitude:
      segmentStart.coord.longitude +
      (segmentEnd.coord.longitude - segmentStart.coord.longitude) *
        segmentProgress,
  };
}

export function getCustomStopSearchPoints(routeCoords = []) {
  return removeDuplicateCoordinates(
    CUSTOM_STOP_SEARCH_PERCENTAGES.map((percentage) =>
      getRoutePointAtDistancePercentage(routeCoords, percentage),
    ),
  );
}
