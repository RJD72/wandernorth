import { requestExternalApi } from "./externalApiRequest";
import {
  getGoogleAndroidRestrictionHeaders,
  getGoogleWebServicesApiKey,
} from "../config/providerConfig";
import { placeDetailsRequestCache } from "./apiRequestCaches";

const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";

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

  const apiKey = getGoogleWebServicesApiKey();

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

  return placeDetailsRequestCache.load(placeId, async () => {
    const response = await requestExternalApi({
      provider: "google",
      operation: "place-details-rich",
      url: `${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`,
      options: {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": getGoogleWebServicesApiKey(),
          ...getGoogleAndroidRestrictionHeaders(),
          "X-Goog-FieldMask":
            "id,displayName,formattedAddress,photos,editorialSummary,rating,userRatingCount,googleMapsUri",
        },
      },
      retryTransient: true,
    });

    const data = await response.json();

    const imageUrls =
      data.photos
        ?.slice(0, 1)
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
    };
  });
}
