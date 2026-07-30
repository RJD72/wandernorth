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
  purpose = "preview",
  routingPreference = "basic",
}) {
  return [
    coordinate(startingCoords),
    coordinate(destinationCoords),
    travelMode || "driving",
    waypoints.map(coordinate).join(";"),
    purpose,
    routingPreference,
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
