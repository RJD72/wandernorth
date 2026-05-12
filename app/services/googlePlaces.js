const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";

function getGoogleApiKey() {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to your .env file.",
    );
  }

  return apiKey;
}

function getGooglePlaceId(stop) {
  if (!stop) return null;

  return (
    stop.googlePlaceId ??
    stop.id ??
    stop.place_id ??
    stop.fsq_id ??
    stop.properties?.place_id ??
    stop.properties?.id ??
    null
  );
}

function buildPhotoUrl(photoName, maxWidth = 800) {
  if (!photoName) return null;

  const apiKey = getGoogleApiKey();

  return `${GOOGLE_PLACES_BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
}

export async function fetchGooglePlaceDetailsForStop(stop) {
  const placeId = getGooglePlaceId(stop);

  if (!placeId) {
    return {
      googlePlaceId: null,
      imageUrls: [],
      description: null,
      source: "no-google-place-id",
    };
  }

  const apiKey = getGoogleApiKey();

  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places/${placeId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,

      "X-Goog-FieldMask": "photos,editorialSummary",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Google Places details request failed: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();

  const imageUrls =
    data.photos?.slice(0, 3).map((photo) => buildPhotoUrl(photo.name)) ?? [];

  return {
    googlePlaceId: data.id ?? placeId,
    title: data.displayName?.text ?? null,
    imageUrls,
    description: data.editorialSummary?.text ?? null,
    raw: data,
    source: "google-place-details",
  };
}
