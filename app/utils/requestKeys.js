function coordinate(point) {
  return `${Number(point?.latitude).toFixed(5)},${Number(
    point?.longitude,
  ).toFixed(5)}`;
}
export function createRouteRequestKey({
  startingCoords,
  destinationCoords,
  travelMode,
  waypoints = [],
}) {
  return [
    coordinate(startingCoords),
    coordinate(destinationCoords),
    travelMode || "driving",
    waypoints.map(coordinate).join(";"),
  ].join("|");
}
export function createPoiRequestKey({
  routePoints = [],
  selectedPoiTypes = [],
  numStops = 3,
  enabledProviders = [],
}) {
  return [
    routePoints.map(coordinate).join(";"),
    selectedPoiTypes.join(","),
    String(numStops),
    enabledProviders.join(","),
  ].join("|");
}
