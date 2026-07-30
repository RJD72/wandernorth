import { requestExternalApi } from "./externalApiRequest";
import {
  getGoogleAndroidRestrictionHeaders,
  getGoogleWebServicesApiKey,
} from "../config/providerConfig";
import { autocompleteRequestCache } from "./apiRequestCaches";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_FIELD_MASK = "id,displayName,formattedAddress,location";

export function createAutocompleteSessionToken({
  now = Date.now,
  random = Math.random,
} = {}) {
  return `wn_${now().toString(36)}_${random().toString(36).slice(2, 18)}`;
}

export const getAndroidRestrictionHeaders = getGoogleAndroidRestrictionHeaders;

export function buildAutocompleteRequestBody({
  inputText,
  sessionToken,
  locationBias,
  strictBounds = false,
}) {
  const body = {
    input: inputText,
    includedRegionCodes: ["ca"],
    regionCode: "CA",
    sessionToken,
  };

  if (
    locationBias &&
    Number.isFinite(locationBias.latitude) &&
    Number.isFinite(locationBias.longitude) &&
    Number.isFinite(locationBias.radiusMeters)
  ) {
    const circle = {
      center: {
        latitude: locationBias.latitude,
        longitude: locationBias.longitude,
      },
      radius: locationBias.radiusMeters,
    };

    if (strictBounds) {
      body.locationRestriction = { circle };
    } else {
      body.locationBias = { circle };
    }
  }

  return body;
}

export function normalizeAutocompleteSuggestions(suggestions = []) {
  return suggestions
    .map((suggestion) => {
      const prediction = suggestion?.placePrediction;
      const placeId = prediction?.placeId;
      const description = prediction?.text?.text;
      const mainText =
        prediction?.structuredFormat?.mainText?.text || description;
      const secondaryText =
        prediction?.structuredFormat?.secondaryText?.text || "";

      if (!placeId || !description) return null;

      return {
        place_id: placeId,
        name: mainText,
        title: mainText,
        address: secondaryText,
        description,
        structured_formatting: {
          main_text: mainText,
          secondary_text: secondaryText,
        },
        source: "autocomplete-new",
      };
    })
    .filter(Boolean);
}

export async function fetchAutocompletePredictions({
  inputText,
  apiKey,
  sessionToken,
  locationBias,
  strictBounds = false,
  signal,
}) {
  const resolvedApiKey = apiKey || getGoogleWebServicesApiKey();

  const normalizedInput = inputText.trim().toLowerCase().replace(/\s+/g, " ");
  const biasKey = locationBias
    ? `${Number(locationBias.latitude).toFixed(4)},${Number(
        locationBias.longitude,
      ).toFixed(4)},${Math.round(Number(locationBias.radiusMeters) || 0)}`
    : "none";
  const cacheKey = [
    sessionToken,
    normalizedInput,
    biasKey,
    strictBounds ? "restriction" : "bias",
  ].join("|");

  return autocompleteRequestCache.load(cacheKey, async () => {
    const response = await requestExternalApi({
      provider: "google",
      operation: "places-autocomplete",
      url: AUTOCOMPLETE_URL,
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": resolvedApiKey,
          "X-Goog-FieldMask":
            "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
          ...getGoogleAndroidRestrictionHeaders(),
        },
        body: JSON.stringify(
          buildAutocompleteRequestBody({
            inputText,
            sessionToken,
            locationBias,
            strictBounds,
          }),
        ),
      },
      signal,
      retryTransient: true,
    });

    const data = await response.json();
    return normalizeAutocompleteSuggestions(data.suggestions);
  });
}

export async function fetchPlaceDetailsNew({
  placeId,
  fallbackName = "",
  apiKey,
  sessionToken,
  signal,
}) {
  const resolvedApiKey = apiKey || getGoogleWebServicesApiKey();

  const query = sessionToken
    ? `?sessionToken=${encodeURIComponent(sessionToken)}`
    : "";
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(
    placeId,
  )}${query}`;

  const response = await requestExternalApi({
    provider: "google",
    operation: "place-details",
    url,
    options: {
      headers: {
        "X-Goog-Api-Key": resolvedApiKey,
        "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
        ...getGoogleAndroidRestrictionHeaders(),
      },
    },
    signal,
    retryTransient: true,
  });

  const place = await response.json();
  const latitude = place?.location?.latitude;
  const longitude = place?.location?.longitude;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    name: place?.displayName?.text || fallbackName,
    address: place?.formattedAddress || fallbackName,
    coords: {
      latitude,
      longitude,
    },
  };
}
