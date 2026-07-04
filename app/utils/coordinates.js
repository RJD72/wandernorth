export function isValidCoords(coords) {
  return (
    coords &&
    typeof coords.latitude === "number" &&
    typeof coords.longitude === "number" &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude)
  );
}
