import AsyncStorage from "@react-native-async-storage/async-storage";

const SAVED_TRIPS_STORAGE_KEY = "wanderNorth.savedTrips.v1";
const VALID_TRIP_SOURCES = new Set(["navigate", "explore"]);

function createTripId() {
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSavedTrip(savedTrip = {}) {
  const trip =
    savedTrip && typeof savedTrip === "object" ? savedTrip : {};
  const now = new Date().toISOString();

  return {
    ...trip,
    id: trip.id || createTripId(),
    title: trip.title || "Saved Trip",
    source: VALID_TRIP_SOURCES.has(trip.source) ? trip.source : "unknown",
    createdAt: trip.createdAt || now,
    updatedAt: now,
  };
}

function getTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortSavedTripsNewestFirst(trips) {
  return [...trips].sort((firstTrip, secondTrip) => {
    const updatedAtDifference =
      getTimestamp(secondTrip?.updatedAt) - getTimestamp(firstTrip?.updatedAt);

    if (updatedAtDifference !== 0) {
      return updatedAtDifference;
    }

    return (
      getTimestamp(secondTrip?.createdAt) - getTimestamp(firstTrip?.createdAt)
    );
  });
}

async function readSavedTripsFromStorage() {
  const storedTrips = await AsyncStorage.getItem(SAVED_TRIPS_STORAGE_KEY);

  if (storedTrips === null) {
    return [];
  }

  let parsedTrips;

  try {
    parsedTrips = JSON.parse(storedTrips);
  } catch (error) {
    console.warn("[savedTripsService] loadSavedTrips invalid JSON:", error);
    return [];
  }

  if (!Array.isArray(parsedTrips)) {
    return [];
  }

  return sortSavedTripsNewestFirst(parsedTrips);
}

export async function loadSavedTrips() {
  try {
    return await readSavedTripsFromStorage();
  } catch (error) {
    console.warn("[savedTripsService] loadSavedTrips error:", error);
    return [];
  }
}

export async function saveTrip(savedTrip) {
  try {
    const existingTrips = await readSavedTripsFromStorage();
    const existingTrip = savedTrip?.id
      ? existingTrips.find((trip) => trip.id === savedTrip.id)
      : null;
    const normalizedTrip = normalizeSavedTrip(
      existingTrip
        ? {
            ...existingTrip,
            ...savedTrip,
            id: existingTrip.id,
            createdAt: existingTrip.createdAt,
          }
        : savedTrip,
    );
    const tripIndex = existingTrips.findIndex(
      (trip) => trip.id === normalizedTrip.id,
    );

    if (tripIndex >= 0) {
      existingTrips[tripIndex] = normalizedTrip;
    } else {
      existingTrips.push(normalizedTrip);
    }

    await AsyncStorage.setItem(
      SAVED_TRIPS_STORAGE_KEY,
      JSON.stringify(sortSavedTripsNewestFirst(existingTrips)),
    );

    return normalizedTrip;
  } catch (error) {
    console.warn("[savedTripsService] saveTrip error:", error);
    return null;
  }
}

export async function deleteSavedTrip(savedTripId) {
  try {
    const existingTrips = await readSavedTripsFromStorage();
    const remainingTrips = existingTrips.filter(
      (trip) => trip.id !== savedTripId,
    );

    await AsyncStorage.setItem(
      SAVED_TRIPS_STORAGE_KEY,
      JSON.stringify(remainingTrips),
    );

    return true;
  } catch (error) {
    console.warn("[savedTripsService] deleteSavedTrip error:", error);
    return false;
  }
}

export async function updateSavedTrip(savedTripId, updates) {
  try {
    const existingTrips = await readSavedTripsFromStorage();
    const tripIndex = existingTrips.findIndex(
      (trip) => trip.id === savedTripId,
    );

    if (tripIndex < 0) {
      return null;
    }

    const existingTrip = existingTrips[tripIndex];
    const updatedTrip = {
      ...existingTrip,
      ...(updates && typeof updates === "object" ? updates : {}),
      id: existingTrip.id,
      createdAt: existingTrip.createdAt,
      updatedAt: new Date().toISOString(),
    };

    existingTrips[tripIndex] = updatedTrip;

    await AsyncStorage.setItem(
      SAVED_TRIPS_STORAGE_KEY,
      JSON.stringify(sortSavedTripsNewestFirst(existingTrips)),
    );

    return updatedTrip;
  } catch (error) {
    console.warn("[savedTripsService] updateSavedTrip error:", error);
    return null;
  }
}

export async function clearSavedTrips() {
  try {
    await AsyncStorage.removeItem(SAVED_TRIPS_STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn("[savedTripsService] clearSavedTrips error:", error);
    return false;
  }
}
