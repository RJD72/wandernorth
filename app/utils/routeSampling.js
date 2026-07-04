import { getDistanceMeters } from "./routeDistance";

const SAMPLE_PERCENTAGES = [0.15, 0.3, 0.5, 0.75, 0.95];

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

  const cumulativePoints = [
    { coord: validRouteCoords[0], distanceMeters: 0 },
  ];
  let totalDistanceMeters = 0;

  for (let index = 1; index < validRouteCoords.length; index += 1) {
    const segmentDistanceMeters = getDistanceMeters(
      validRouteCoords[index - 1],
      validRouteCoords[index],
    );

    if (
      !Number.isFinite(segmentDistanceMeters) ||
      segmentDistanceMeters < 0
    ) {
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
