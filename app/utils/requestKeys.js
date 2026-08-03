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
}) {
  return [
    coordinate(startingCoords),
    coordinate(destinationCoords),
    travelMode || "driving",
    waypoints.map(coordinate).join(";"),
    purpose,
  ].join("|");
}
