import * as Location from "expo-location";

import { logger } from "../utils/logger";
import { geocodeRequestCache } from "./apiRequestCaches";
import {
  recordCacheHit,
  recordInFlightDeduplication,
  trackExternalRequest,
} from "./apiUsageTracker";

export async function geocodeAddress(address) {
  if (!address?.trim()) return null;

  try {
    const normalizedAddress = address.trim().toLowerCase().replace(/\s+/g, " ");
    const results = await geocodeRequestCache.load(
      normalizedAddress,
      () =>
        trackExternalRequest("google", "geocoding", () =>
          Location.geocodeAsync(address.trim()),
        ),
      {
        onCacheHit: () => recordCacheHit("google", "geocoding"),
        onInFlightDeduplicated: () =>
          recordInFlightDeduplication("google", "geocoding"),
      },
    );

    if (!results?.length) return null;

    return {
      latitude: results[0].latitude,
      longitude: results[0].longitude,
    };
  } catch (error) {
    logger.log("[locationService] Geocode error:", error);
    return null;
  }
}

export async function getCurrentLocationWithLabel() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      return {
        ok: false,
        reason: "permission-denied",
      };
    }

    const position = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = position.coords;

    const geo = await trackExternalRequest("google", "reverse-geocoding", () =>
      Location.reverseGeocodeAsync({
        latitude,
        longitude,
      }),
    );

    const firstResult = geo?.[0];

    const city =
      firstResult?.city ||
      firstResult?.subregion ||
      firstResult?.region ||
      "Current Location";

    const region = firstResult?.region || "";

    return {
      ok: true,
      addressLabel: region ? `${city}, ${region}` : city,
      coords: { latitude, longitude },
    };
  } catch (error) {
    logger.log("[locationService] Current location error:", error);

    return {
      ok: false,
      reason: "location-error",
    };
  }
}
