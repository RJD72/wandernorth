export function asText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function splitCompositeDescription(description) {
  const [title, address] = asText(description)
    .split(/\s+\u00B7\s+|\s+\u00C2\u00B7\s+/)
    .map((part) => part.trim());

  if (!address) {
    return { title: null, address: null };
  }

  return { title, address };
}

export function getStopId(stop) {
  if (!stop) return undefined;

  return (
    stop.id ??
    stop.place_id ??
    stop.placeId ??
    stop.googlePlaceId ??
    stop.fsq_id ??
    stop.properties?.place_id ??
    stop.properties?.placeId ??
    stop.properties?.googlePlaceId ??
    stop.properties?.id ??
    stop.name
  );
}

export function getStopTitle(stop) {
  if (!stop) return "Unnamed stop";

  const descriptionParts = splitCompositeDescription(stop.description);

  return (
    asText(stop.name) ||
    asText(stop.title) ||
    asText(stop.displayName?.text) ||
    asText(stop.displayName) ||
    descriptionParts.title ||
    asText(stop.address) ||
    "Unnamed stop"
  );
}

export function getStopCategory(stop) {
  if (!stop) return "Suggested stop";

  return stop.category ?? stop.type ?? stop.poiType ?? "Suggested stop";
}

export function getStopAddress(stop) {
  if (!stop) return "Address not available";

  const descriptionParts = splitCompositeDescription(stop.description);

  return (
    stop.address ??
    stop.formattedAddress ??
    stop.formatted_address ??
    stop.vicinity ??
    stop.location?.address ??
    stop.properties?.address ??
    descriptionParts.address ??
    "Address not available"
  );
}

export function getStopCoords(stop) {
  if (!stop) return null;

  const latitude =
    stop.latitude ??
    stop.lat ??
    stop.location?.latitude ??
    stop.location?.lat ??
    stop.geometry?.location?.latitude ??
    stop.geometry?.location?.lat;

  const longitude =
    stop.longitude ??
    stop.lng ??
    stop.location?.longitude ??
    stop.location?.lng ??
    stop.geometry?.location?.longitude ??
    stop.geometry?.location?.lng;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return { latitude, longitude };
}

export function getDistanceOffRouteText(stop) {
  if (!stop) return "Distance off route unavailable";

  const distanceMeters =
    stop.closestRouteDistanceMeters ??
    stop.distanceOffRouteMeters ??
    stop.distanceFromRouteMeters;

  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) {
    return "Distance off route unavailable";
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m off route`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km off route`;
}
