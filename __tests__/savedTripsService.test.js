jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock("../app/utils/logger", () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const STORAGE_KEY = "wanderNorth.savedTrips.v1";

function makeTrip(overrides = {}) {
  const base = {
    id: "trip-one",
    title: "First Trip",
    source: "navigate",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
    routeRequest: {
      source: "navigate",
      startingAddress: "Start",
      destinationAddress: "Destination",
      startingCoords: { latitude: 43, longitude: -81 },
      destinationCoords: { latitude: 44, longitude: -80 },
      travelMode: "driving",
      selectedPoiTypes: ["cafe"],
      numStops: 1,
    },
    route: {
      encodedPolyline: "encoded-route",
      distanceMeters: 1000,
      duration: "600s",
    },
    summary: {
      startingAddress: "Start",
      destinationAddress: "Destination",
      travelMode: "driving",
    },
    selectedStops: [],
  };

  return {
    ...base,
    ...overrides,
    routeRequest: overrides.routeRequest ?? base.routeRequest,
    route: overrides.route ?? base.route,
    summary: overrides.summary ?? base.summary,
  };
}

async function flushUntil(predicate, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error("Expected async condition was not reached.");
}

describe("savedTripsService", () => {
  let AsyncStorage;
  let service;
  let storage;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    jest.spyOn(Math, "random").mockReturnValue(0.123456789);

    storage = new Map();
    AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.getItem.mockImplementation(async (key) =>
      storage.has(key) ? storage.get(key) : null,
    );
    AsyncStorage.setItem.mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
    AsyncStorage.removeItem.mockImplementation(async (key) => {
      storage.delete(key);
    });

    service = require("../app/services/savedTripsService");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function seedEnvelope(trips, schemaVersion = 2) {
    storage.set(STORAGE_KEY, JSON.stringify({ schemaVersion, trips }));
  }

  function readStoredEnvelope() {
    return JSON.parse(storage.get(STORAGE_KEY));
  }

  test("missing storage returns an empty list", async () => {
    await expect(service.loadSavedTrips()).resolves.toEqual([]);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  test("valid schema-v2 storage loads successfully", async () => {
    seedEnvelope([makeTrip()]);
    await expect(service.loadSavedTrips()).resolves.toEqual([makeTrip()]);
  });

  test("legacy top-level arrays migrate to schema version 2", async () => {
    storage.set(STORAGE_KEY, JSON.stringify([makeTrip()]));
    await expect(service.loadSavedTrips()).resolves.toHaveLength(1);
    expect(readStoredEnvelope()).toMatchObject({
      schemaVersion: 2,
      trips: [expect.objectContaining({ id: "trip-one" })],
    });
  });

  test("legacy migration is idempotent", async () => {
    storage.set(STORAGE_KEY, JSON.stringify([makeTrip()]));
    await service.loadSavedTrips();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

    await service.loadSavedTrips();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  test("migration preserves existing IDs and createdAt values", async () => {
    storage.set(STORAGE_KEY, JSON.stringify([makeTrip()]));
    const [trip] = await service.loadSavedTrips();
    expect(trip.id).toBe("trip-one");
    expect(trip.createdAt).toBe("2025-01-01T00:00:00.000Z");
  });

  test("missing IDs are generated deterministically under mocked randomness", async () => {
    seedEnvelope([makeTrip({ id: undefined })]);
    const [trip] = await service.loadSavedTrips();
    expect(trip.id).toMatch(/^trip-1767225600000-/);
  });

  test("duplicate IDs are normalized into unique React-safe IDs", async () => {
    jest
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.111111)
      .mockReturnValueOnce(0.222222);
    seedEnvelope([
      makeTrip({ id: "duplicate" }),
      makeTrip({ id: "duplicate", title: "Second" }),
    ]);

    const trips = await service.loadSavedTrips();
    expect(trips).toHaveLength(2);
    expect(new Set(trips.map((trip) => trip.id)).size).toBe(2);
  });

  test("malformed siblings are skipped while valid entries survive", async () => {
    seedEnvelope([makeTrip(), { id: "broken", route: null }]);
    const trips = await service.loadSavedTrips();
    expect(trips).toEqual([makeTrip()]);
    expect(readStoredEnvelope().trips).toHaveLength(1);
  });

  test("invalid JSON throws typed corruption without overwriting storage", async () => {
    storage.set(STORAGE_KEY, "{not-json");
    await expect(service.loadSavedTrips()).rejects.toMatchObject({
      name: "SavedTripsError",
      code: "corrupt-storage",
    });
    expect(storage.get(STORAGE_KEY)).toBe("{not-json");
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  test("unsupported schema versions throw a typed error", async () => {
    seedEnvelope([], 999);
    await expect(service.loadSavedTrips()).rejects.toMatchObject({
      code: "unsupported-storage",
    });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  test("AsyncStorage read failures surface a typed error", async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error("read failed"));
    await expect(service.loadSavedTrips()).rejects.toMatchObject({
      code: "read-failed",
    });
  });

  test("saving creates one normalized trip", async () => {
    const saved = await service.saveTrip(makeTrip({ id: undefined }));
    const trips = await service.loadSavedTrips();
    expect(saved.id).toBeTruthy();
    expect(trips).toHaveLength(1);
    expect(trips[0]).toEqual(saved);
  });

  test("saving an existing ID updates instead of duplicating", async () => {
    await service.saveTrip(makeTrip());
    jest.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
    await service.saveTrip(makeTrip({ title: "Replacement" }));

    const trips = await service.loadSavedTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].title).toBe("Replacement");
  });

  test("updating preserves ID and createdAt and changes updatedAt", async () => {
    seedEnvelope([makeTrip()]);
    jest.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));

    const updated = await service.updateSavedTrip("trip-one", {
      summary: { ...makeTrip().summary, selectedStopCount: 2 },
    });

    expect(updated.id).toBe("trip-one");
    expect(updated.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(updated.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  test("rename trims whitespace", async () => {
    seedEnvelope([makeTrip()]);
    const updated = await service.updateSavedTrip("trip-one", {
      title: "  Renamed Trip  ",
    });
    expect(updated.title).toBe("Renamed Trip");
  });

  test("empty rename is rejected at the service boundary", async () => {
    seedEnvelope([makeTrip()]);
    await expect(
      service.updateSavedTrip("trip-one", { title: "   " }),
    ).rejects.toMatchObject({ code: "invalid-title" });
  });

  test("invalid save payloads are rejected at the service boundary", async () => {
    await expect(service.saveTrip({ title: "Incomplete" })).rejects.toMatchObject({
      code: "invalid-trip-payload",
    });
  });

  test("deleting an existing ID succeeds", async () => {
    seedEnvelope([makeTrip()]);
    await expect(service.deleteSavedTrip("trip-one")).resolves.toBe(true);
    expect(await service.loadSavedTrips()).toEqual([]);
  });

  test("deleting a missing ID reports failure", async () => {
    seedEnvelope([makeTrip()]);
    await expect(service.deleteSavedTrip("missing")).rejects.toMatchObject({
      code: "trip-not-found",
    });
  });

  test("clearing removes all trips", async () => {
    seedEnvelope([makeTrip()]);
    await expect(service.clearSavedTrips()).resolves.toBe(true);
    expect(storage.has(STORAGE_KEY)).toBe(false);
    expect(await service.loadSavedTrips()).toEqual([]);
  });

  test("loading by ID returns the correct trip", async () => {
    const second = makeTrip({ id: "trip-two", title: "Second" });
    seedEnvelope([makeTrip(), second]);
    await expect(service.loadSavedTripById("trip-two")).resolves.toMatchObject({
      id: "trip-two",
      title: "Second",
    });
  });

  test("loading a missing ID follows the typed not-found contract", async () => {
    seedEnvelope([makeTrip()]);
    await expect(service.loadSavedTripById("missing")).rejects.toMatchObject({
      code: "trip-not-found",
    });
  });

  test("loading without an ID follows the typed missing-ID contract", async () => {
    await expect(service.loadSavedTripById(undefined)).rejects.toMatchObject({
      code: "missing-trip-id",
    });
  });

  test("trips remain sorted newest-first", async () => {
    const oldTrip = makeTrip({
      id: "old",
      updatedAt: "2025-01-02T00:00:00.000Z",
    });
    const newTrip = makeTrip({
      id: "new",
      updatedAt: "2025-03-02T00:00:00.000Z",
    });
    seedEnvelope([oldTrip, newTrip]);
    expect((await service.loadSavedTrips()).map((trip) => trip.id)).toEqual([
      "new",
      "old",
    ]);
  });

  test("legacy Transit values remain preserved", async () => {
    storage.set(
      STORAGE_KEY,
      JSON.stringify([
        makeTrip({
          routeRequest: { ...makeTrip().routeRequest, travelMode: "transit" },
          summary: { ...makeTrip().summary, travelMode: "transit" },
        }),
      ]),
    );
    const [trip] = await service.loadSavedTrips();
    expect(trip.routeRequest.travelMode).toBe("transit");
    expect(trip.summary.travelMode).toBe("transit");
  });

  test("failed writes surface a typed error", async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error("disk full"));
    await expect(service.saveTrip(makeTrip())).rejects.toMatchObject({
      code: "write-failed",
    });
  });

  test("a failed queued mutation does not block the next mutation", async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error("disk full"));
    await expect(service.saveTrip(makeTrip())).rejects.toMatchObject({
      code: "write-failed",
    });

    await expect(
      service.saveTrip(makeTrip({ id: "trip-two", title: "Second" })),
    ).resolves.toMatchObject({ id: "trip-two" });
  });

  test("concurrent mutations execute in order without overwriting", async () => {
    let releaseFirstWrite;
    AsyncStorage.setItem.mockImplementationOnce(
      (key, value) =>
        new Promise((resolve) => {
          releaseFirstWrite = () => {
            storage.set(key, value);
            resolve();
          };
        }),
    );

    const first = service.saveTrip(makeTrip());
    const second = service.saveTrip(
      makeTrip({ id: "trip-two", title: "Second" }),
    );

    await flushUntil(() => typeof releaseFirstWrite === "function");
    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
    releaseFirstWrite();
    await Promise.all([first, second]);

    const ids = (await service.loadSavedTrips()).map((trip) => trip.id);
    expect(ids).toEqual(expect.arrayContaining(["trip-one", "trip-two"]));
    expect(ids).toHaveLength(2);
  });

  test("reads wait for earlier writes and do not return stale data", async () => {
    let releaseWrite;
    AsyncStorage.setItem.mockImplementationOnce(
      (key, value) =>
        new Promise((resolve) => {
          releaseWrite = () => {
            storage.set(key, value);
            resolve();
          };
        }),
    );

    const save = service.saveTrip(makeTrip());
    let readSettled = false;
    const read = service.loadSavedTrips().then((trips) => {
      readSettled = true;
      return trips;
    });

    await flushUntil(() => typeof releaseWrite === "function");
    expect(readSettled).toBe(false);
    releaseWrite();

    await save;
    await expect(read).resolves.toHaveLength(1);
  });
});
