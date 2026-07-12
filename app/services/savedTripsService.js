import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "../utils/logger";

const SAVED_TRIPS_STORAGE_KEY = "wanderNorth.savedTrips.v1";
const SCHEMA_VERSION = 2;
let operationTail = Promise.resolve();

export class SavedTripsError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = "SavedTripsError";
    this.code = code;
    this.cause = cause;
  }
}

function enqueue(operation) {
  const result = operationTail.then(operation, operation);
  operationTail = result.catch(() => undefined);
  return result;
}
function createTripId() {
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function validDate(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function timestamp(value) {
  return new Date(value).getTime() || 0;
}
export function sortSavedTripsNewestFirst(trips) {
  return [...trips].sort(
    (a, b) =>
      timestamp(b.updatedAt) - timestamp(a.updatedAt) ||
      timestamp(b.createdAt) - timestamp(a.createdAt),
  );
}

export function normalizeStoredTrips(records = []) {
  const seen = new Set();
  const now = new Date().toISOString();
  return records.flatMap((value, index) => {
    if (
      !isObject(value) ||
      !isObject(value.routeRequest) ||
      !isObject(value.route) ||
      !isObject(value.summary) ||
      typeof value.route.encodedPolyline !== "string" ||
      !value.route.encodedPolyline.trim()
    ) {
      logger.warn(
        `[savedTripsService] Skipped malformed saved trip at index ${index}.`,
      );
      return [];
    }
    let id =
      typeof value.id === "string" && value.id.trim()
        ? value.id.trim()
        : createTripId();
    while (seen.has(id)) id = createTripId();
    seen.add(id);
    const title =
      typeof value.title === "string" && value.title.trim()
        ? value.title.trim()
        : "Saved Trip";
    const createdAt = validDate(value.createdAt) || now;
    return [
      {
        ...value,
        id,
        title,
        source:
          typeof value.source === "string" && value.source.trim()
            ? value.source
            : "unknown",
        createdAt,
        updatedAt: validDate(value.updatedAt) || createdAt,
        selectedStops: Array.isArray(value.selectedStops)
          ? value.selectedStops
          : [],
        summary: value.summary,
        routeRequest: value.routeRequest,
        route: {
          ...value.route,
          encodedPolyline: value.route.encodedPolyline.trim(),
        },
      },
    ];
  });
}

async function readEnvelope() {
  let stored;
  try {
    stored = await AsyncStorage.getItem(SAVED_TRIPS_STORAGE_KEY);
  } catch (error) {
    throw new SavedTripsError(
      "read-failed",
      "Saved trips could not be read from this device.",
      error,
    );
  }
  if (stored === null) return { schemaVersion: SCHEMA_VERSION, trips: [] };
  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch (error) {
    throw new SavedTripsError(
      "corrupt-storage",
      "Saved Trips data on this device is corrupted.",
      error,
    );
  }
  const legacy = Array.isArray(parsed);
  if (
    !legacy &&
    (!isObject(parsed) ||
      parsed.schemaVersion !== SCHEMA_VERSION ||
      !Array.isArray(parsed.trips))
  )
    throw new SavedTripsError(
      "unsupported-storage",
      "Saved Trips data on this device has an unsupported format.",
    );
  const trips = sortSavedTripsNewestFirst(
    normalizeStoredTrips(legacy ? parsed : parsed.trips),
  );
  const normalizedChanged =
    legacy || JSON.stringify(parsed.trips) !== JSON.stringify(trips);
  if (normalizedChanged)
    await writeEnvelope(
      trips,
      legacy ? "migration-write-failed" : "write-failed",
    );
  return { schemaVersion: SCHEMA_VERSION, trips };
}

async function writeEnvelope(trips, code = "write-failed") {
  try {
    await AsyncStorage.setItem(
      SAVED_TRIPS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        trips: sortSavedTripsNewestFirst(trips),
      }),
    );
  } catch (error) {
    throw new SavedTripsError(
      code,
      "Saved Trips changes could not be written to this device.",
      error,
    );
  }
}
function requireId(id) {
  if (typeof id !== "string" || !id.trim())
    throw new SavedTripsError(
      "missing-trip-id",
      "A saved trip ID is required.",
    );
  return id.trim();
}
function validatePayload(payload) {
  if (
    !isObject(payload) ||
    !isObject(payload.routeRequest) ||
    !isObject(payload.route) ||
    !isObject(payload.summary) ||
    typeof payload.route.encodedPolyline !== "string" ||
    !payload.route.encodedPolyline.trim()
  )
    throw new SavedTripsError(
      "invalid-trip-payload",
      "The saved trip is incomplete and could not be stored.",
    );
  if (typeof payload.title !== "string" || !payload.title.trim())
    throw new SavedTripsError(
      "invalid-title",
      "Enter a title for this saved trip.",
    );
}

export function loadSavedTrips() {
  return enqueue(async () => (await readEnvelope()).trips);
}
export function loadSavedTripById(savedTripId) {
  return enqueue(async () => {
    const id = requireId(savedTripId);
    const trip = (await readEnvelope()).trips.find((item) => item.id === id);
    if (!trip)
      throw new SavedTripsError(
        "trip-not-found",
        "This saved trip could not be found on this device.",
      );
    return trip;
  });
}
export function saveTrip(payload) {
  return enqueue(async () => {
    validatePayload(payload);
    const envelope = await readEnvelope();
    const existing = payload.id
      ? envelope.trips.find((trip) => trip.id === payload.id)
      : null;
    const now = new Date().toISOString();
    const trip = normalizeStoredTrips([
      {
        ...existing,
        ...payload,
        id: existing?.id || payload.id || createTripId(),
        title: payload.title.trim(),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      },
    ])[0];
    const trips = envelope.trips.filter((item) => item.id !== trip.id);
    trips.push(trip);
    await writeEnvelope(trips);
    return trip;
  });
}
export function updateSavedTrip(savedTripId, updates) {
  return enqueue(async () => {
    const id = requireId(savedTripId);
    if (!isObject(updates))
      throw new SavedTripsError(
        "invalid-trip-payload",
        "The saved trip update is invalid.",
      );
    if (
      Object.hasOwn(updates, "title") &&
      (typeof updates.title !== "string" || !updates.title.trim())
    )
      throw new SavedTripsError(
        "invalid-title",
        "Enter a title for this saved trip.",
      );
    const envelope = await readEnvelope();
    const existing = envelope.trips.find((trip) => trip.id === id);
    if (!existing)
      throw new SavedTripsError(
        "trip-not-found",
        "This saved trip could not be found on this device.",
      );
    const merged = {
      ...existing,
      ...updates,
      id,
      title: Object.hasOwn(updates, "title")
        ? updates.title.trim()
        : existing.title,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    validatePayload(merged);
    const trips = envelope.trips.map((trip) =>
      trip.id === id ? merged : trip,
    );
    await writeEnvelope(trips);
    return merged;
  });
}
export function deleteSavedTrip(savedTripId) {
  return enqueue(async () => {
    const id = requireId(savedTripId);
    const envelope = await readEnvelope();
    if (!envelope.trips.some((trip) => trip.id === id))
      throw new SavedTripsError(
        "trip-not-found",
        "This saved trip could not be found on this device.",
      );
    await writeEnvelope(envelope.trips.filter((trip) => trip.id !== id));
    return true;
  });
}
export function clearSavedTrips() {
  return enqueue(async () => {
    try {
      await AsyncStorage.removeItem(SAVED_TRIPS_STORAGE_KEY);
      return true;
    } catch (error) {
      throw new SavedTripsError(
        "write-failed",
        "Saved trips could not be reset on this device.",
        error,
      );
    }
  });
}
