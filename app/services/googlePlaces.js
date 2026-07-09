const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";

function getAndroidRestrictionHeaders() {
  const androidPackageName = process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME;
  const androidCertSha1 = process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1;

  if (!androidPackageName || !androidCertSha1) {
    return {};
  }

  return {
    "X-Android-Package": androidPackageName,
    "X-Android-Cert": androidCertSha1,
  };
}

function getGoogleApiKey() {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.");
  }

  return apiKey;
}

function getGooglePlaceId(stop) {
  if (!stop) return null;

  return (
    stop.googlePlaceId ??
    stop.placeId ??
    stop.place_id ??
    stop.properties?.googlePlaceId ??
    stop.properties?.placeId ??
    null
  );
}

function buildPhotoUrl(photoName, maxWidthPx = 900) {
  if (!photoName) return null;

  const apiKey = getGoogleApiKey();

  return `${GOOGLE_PLACES_BASE_URL}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;
}

export async function fetchGooglePlaceDetailsForStop(stop) {
  const placeId = getGooglePlaceId(stop);

  if (!placeId) {
    return {
      googlePlaceId: null,
      title: null,
      address: null,
      imageUrls: [],
      description: null,
      rating: null,
      userRatingCount: null,
      googleMapsUri: null,
      source: "no-google-place-id",
    };
  }

  const apiKey = getGoogleApiKey();

  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places/${placeId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      ...getAndroidRestrictionHeaders(),
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,photos,editorialSummary,rating,userRatingCount,googleMapsUri",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Google Place Details failed: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();

  const imageUrls =
    data.photos
      ?.slice(0, 5)
      .map((photo) => buildPhotoUrl(photo.name))
      .filter(Boolean) ?? [];

  return {
    googlePlaceId: data.id ?? placeId,
    title: data.displayName?.text ?? null,
    address: data.formattedAddress ?? null,
    imageUrls,
    description: data.editorialSummary?.text ?? null,
    rating: data.rating ?? null,
    userRatingCount: data.userRatingCount ?? null,
    googleMapsUri: data.googleMapsUri ?? null,
    source: "google-place-details",
    raw: data,
  };
}
