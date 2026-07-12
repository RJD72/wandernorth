// ---------------------------------------------------------------------------
// googleRoutes.js
// Service module for interacting with the Google Routes API (v2).
// Responsible for:
//   1. Building and sending a route request to Google
//   2. Parsing and normalizing the response into a consistent shape
//   3. Formatting raw distance/duration values into human-readable strings
// ---------------------------------------------------------------------------

// The API key is read from an Expo public environment variable so it is never
// hard-coded in source. Expo inline EXPO_PUBLIC_* variables at build time.
import { logger } from "../utils/logger";

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const ANDROID_PACKAGE_NAME = process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME;
const ANDROID_CERT_SHA1 = process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1;

// ---------------------------------------------------------------------------
// convertModeToGoogleMode
// ---------------------------------------------------------------------------
// Maps our internal travel-mode strings (used across the app) to the enum
// values expected by the Google Routes API v2.
//
// If an unrecognized mode is passed the function falls back to "DRIVE" so
// the API call never fails due to a missing travelMode field.
//
// Parameters:
//   mode {string} - One of: "driving" | "walking" | "bicycling" | "transit"
//
// Returns:
//   {string} - The corresponding Google Routes API travelMode enum value
// ---------------------------------------------------------------------------
function convertModeToGoogleMode(mode) {
  const modeMap = {
    driving: "DRIVE",
    walking: "WALK",
    bicycling: "BICYCLE",
    transit: "TRANSIT",
  };
  return modeMap[mode] || "DRIVE";
}

// ---------------------------------------------------------------------------
// buildGoogleRoute  (exported)
// ---------------------------------------------------------------------------
// Fetches a single route between two coordinate pairs from the Google Routes
// API and returns a normalized route object.
//
// Parameters (destructured object):
//   startingCoords     {object} - { latitude, longitude } for the origin
//   destinationCoords  {object} - { latitude, longitude } for the destination
//   travelMode         {string} - Internal mode string (see convertModeToGoogleMode)
//
// Returns (Promise):
//   {
//     raw            {object} - The unmodified route object from the API response
//     distanceMeters {number} - Total route distance in metres
//     distanceText   {string} - Human-readable distance, e.g. "12.3 km"
//     duration       {string} - Raw duration string from the API, e.g. "1530s"
//     durationText   {string} - Human-readable duration, e.g. "25 min"
//     encodedPolyline{string} - Encoded polyline representing the route geometry
//     legs           {Array}  - Array of route leg objects (one per waypoint segment)
//   }
//
// Throws:
//   Error - if the API returns a non-OK HTTP status or no routes are found
// ---------------------------------------------------------------------------
export async function buildGoogleRoute({
  startingCoords,
  destinationCoords,
  travelMode,
  waypoints = [], // Optional array of intermediate waypoints (not currently used)
  suppressErrorLog = false,
}) {
  // Google Routes API v2 endpoint — all requests are POST with a JSON body
  const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;

  // Build the request payload according to the Google Routes API v2 schema.
  // Only the fields we actually need are included to keep the payload small.
  const body = {
    // Origin point — must be wrapped in the location.latLng structure
    origin: {
      location: {
        latLng: {
          latitude: startingCoords.latitude,
          longitude: startingCoords.longitude,
        },
      },
    },

    // Destination point — same structure as origin
    destination: {
      location: {
        latLng: {
          latitude: destinationCoords.latitude,
          longitude: destinationCoords.longitude,
        },
      },
    },

    intermediates: waypoints.map((point) => ({
      location: {
        latLng: {
          latitude: point.latitude,
          longitude: point.longitude,
        },
      },
    })),

    // Convert the app's internal mode string to the Google API enum value
    travelMode: convertModeToGoogleMode(travelMode),

    // TRAFFIC_AWARE requests real-time traffic data for driving routes.
    // Not applicable for walking/cycling/transit so we omit it for those modes.
    routingPreference: travelMode === "driving" ? "TRAFFIC_AWARE" : undefined,

    // Only return the single best route — we don't need to display alternatives
    computeAlternativeRoutes: false,

    // Use metric units for distance (kilometers/metres)
    units: "METRIC",

    // Return the route geometry as a compact encoded polyline string rather
    // than a verbose array of lat/lng points. This keeps the response smaller
    // and is the format expected by most mapping libraries.
    polylineEncoding: "ENCODED_POLYLINE",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",

      // Required for authentication and billing.
      // Make sure to restrict this key in production!
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Android-Package": ANDROID_PACKAGE_NAME,
      "X-Android-Cert": ANDROID_CERT_SHA1,

      // FieldMask controls which fields Google includes in the response.
      // Specifying only what we need reduces bandwidth and latency.
      // Deliberately excluded: "legs.steps" (turn-by-turn instructions) since
      // we only display the overview polyline and summary info.
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs",
    },
    body: JSON.stringify(body),
  });

  // Parse the JSON body regardless of HTTP status so error details are
  // available for logging even when the request fails.
  const data = await response.json();

  // Handle HTTP-level errors (4xx / 5xx). The API returns a structured error
  // object under data.error when this happens.
  if (!response.ok) {
    if (!suppressErrorLog) {
      logger.error("Google Routes API error", data);
    }

    throw new Error(data?.error?.message || "Google route request failed");
  }

  // Guard against a successful HTTP response that contains no route data
  // (e.g. origin and destination are in different countries with no road link)
  if (!data.routes || data.routes.length === 0) {
    throw new Error("No routes found");
  }

  // We requested only one route, so the first element is always our result
  const route = data.routes[0];

  // Return a normalized object so the rest of the app never has to deal with
  // the raw Google API shape directly.
  return {
    // Keep the raw route in case any caller needs fields not listed below
    raw: route,

    // Distance as a number (metres) and as a formatted string for display
    distanceMeters: route.distanceMeters,
    distanceText: formatDistance(route.distanceMeters),

    // Duration as the raw API string (e.g. "1530s") and as a formatted string
    duration: route.duration,
    durationText: formatDuration(route.duration),

    // Encoded polyline for rendering the route path on a map
    encodedPolyline: route.polyline.encodedPolyline,

    // Legs represent individual segments of the route (one leg per waypoint
    // interval). For a simple A→B route there will be exactly one leg.
    legs: route.legs || [],
  };
}

export async function canBuildGoogleRoute({
  startingCoords,
  destinationCoords,
  travelMode,
  waypoints = [],
}) {
  try {
    await buildGoogleRoute({
      startingCoords,
      destinationCoords,
      travelMode,
      waypoints,
      suppressErrorLog: true,
    });

    return true;
  } catch (error) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// formatDistance  (private)
// ---------------------------------------------------------------------------
// Converts a raw distance in metres to a human-readable kilometer string.
//
// Parameters:
//   distanceMeters {number} - Distance in metres as returned by the Google API
//
// Returns:
//   {string} - e.g. "12.3 km", or "Unknown distance" if the value is falsy
// ---------------------------------------------------------------------------
function formatDistance(distanceMeters) {
  if (!distanceMeters) return "Unknown distance";

  // Convert metres → kilometers and round to one decimal place
  const km = distanceMeters / 1000;

  return `${km.toFixed(1)} km`;
}

// ---------------------------------------------------------------------------
// formatDuration  (private)
// ---------------------------------------------------------------------------
// Converts the Google Routes API duration string to a human-readable format.
//
// The API returns duration as a plain seconds string, e.g. "1530s" (not the
// ISO 8601 "PT25M30S" format used by some other Google APIs). We strip the
// trailing "s", parse to a number, then convert to hours/minutes.
//
// Parameters:
//   durationString {string} - Duration string from the API, e.g. "1530s"
//
// Returns:
//   {string} - e.g. "25 min", "1 hr 30 min", or "Unknown duration" if falsy
// ---------------------------------------------------------------------------
function formatDuration(durationString) {
  if (!durationString) return "Unknown duration";

  // Strip the trailing "s" unit suffix and convert to a plain integer
  const seconds = Number(durationString.replace("s", ""));

  // Round to the nearest whole minute for display
  const minutes = Math.round(seconds / 60);

  // For durations under an hour, show minutes only
  if (minutes < 60) {
    return `${minutes} min`;
  }

  // For longer durations, break into hours and remaining minutes
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours} hr ${remainingMinutes} min`;
}
