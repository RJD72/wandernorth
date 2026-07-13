jest.mock("../app/services/savedTripsService", () => ({
  clearSavedTrips: jest.fn(),
  deleteSavedTrip: jest.fn(),
  loadSavedTrips: jest.fn(),
  loadSavedTripById: jest.fn(),
  saveTrip: jest.fn(),
  updateSavedTrip: jest.fn(),
}));

jest.mock("../app/utils/logger", () => ({
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const services = require("../app/services/savedTripsService");
const { useSavedTripsStore } = require("../app/store/useSavedTripsStore");

const tripOne = { id: "one", title: "One" };
const tripTwo = { id: "two", title: "Two" };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function resetStore(overrides = {}) {
  useSavedTripsStore.setState({
    savedTrips: [],
    loadingSavedTrips: false,
    savedTripsError: null,
    savedTripsRecoveryRequired: false,
    activeSavedTrip: null,
    ...overrides,
  });
}

describe("useSavedTripsStore integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  test("has the documented initial state", () => {
    expect(useSavedTripsStore.getState()).toMatchObject({
      savedTrips: [],
      loadingSavedTrips: false,
      savedTripsError: null,
      savedTripsRecoveryRequired: false,
      activeSavedTrip: null,
    });
  });

  test("loadTrips exposes loading while the service is pending", async () => {
    const pending = deferred();
    services.loadSavedTrips.mockReturnValue(pending.promise);
    const load = useSavedTripsStore.getState().loadTrips();

    expect(useSavedTripsStore.getState().loadingSavedTrips).toBe(true);
    pending.resolve([tripOne]);
    await load;
    expect(useSavedTripsStore.getState().loadingSavedTrips).toBe(false);
  });

  test("successful loading stores trips and clears prior errors", async () => {
    resetStore({
      savedTripsError: "Old error",
      savedTripsRecoveryRequired: true,
    });
    services.loadSavedTrips.mockResolvedValue([tripOne]);

    await expect(useSavedTripsStore.getState().loadTrips()).resolves.toEqual([
      tripOne,
    ]);
    expect(useSavedTripsStore.getState()).toMatchObject({
      savedTrips: [tripOne],
      savedTripsError: null,
      savedTripsRecoveryRequired: false,
    });
  });

  test("failed loading exposes a user-facing message", async () => {
    services.loadSavedTrips.mockRejectedValue(
      Object.assign(new Error("disk"), { code: "read-failed" }),
    );
    await expect(useSavedTripsStore.getState().loadTrips()).resolves.toEqual([]);
    expect(useSavedTripsStore.getState().savedTripsError).toBe(
      "Unable to load saved trips.",
    );
  });

  test("corrupt storage requires recovery", async () => {
    services.loadSavedTrips.mockRejectedValue(
      Object.assign(new Error("bad data"), { code: "corrupt-storage" }),
    );
    await useSavedTripsStore.getState().loadTrips();
    expect(useSavedTripsStore.getState()).toMatchObject({
      savedTripsError:
        "Saved Trips data on this device is corrupted. Reset Saved Trips to recover.",
      savedTripsRecoveryRequired: true,
    });
  });

  test("a successful later load clears an earlier failure", async () => {
    services.loadSavedTrips
      .mockRejectedValueOnce(new Error("first"))
      .mockResolvedValueOnce([tripOne]);
    await useSavedTripsStore.getState().loadTrips();
    await useSavedTripsStore.getState().loadTrips();
    expect(useSavedTripsStore.getState()).toMatchObject({
      savedTrips: [tripOne],
      savedTripsError: null,
      savedTripsRecoveryRequired: false,
    });
  });

  test("addTrip saves and refreshes the list", async () => {
    services.saveTrip.mockResolvedValue(tripTwo);
    services.loadSavedTrips.mockResolvedValue([tripTwo, tripOne]);
    resetStore({ savedTrips: [tripOne] });

    await expect(useSavedTripsStore.getState().addTrip(tripTwo)).resolves.toBe(
      tripTwo,
    );
    expect(services.saveTrip).toHaveBeenCalledWith(tripTwo);
    expect(useSavedTripsStore.getState().savedTrips).toEqual([tripTwo, tripOne]);
  });

  test("failed addTrip preserves existing trips", async () => {
    resetStore({ savedTrips: [tripOne] });
    services.saveTrip.mockRejectedValue(new Error("write"));
    await expect(useSavedTripsStore.getState().addTrip(tripTwo)).resolves.toBeNull();
    expect(useSavedTripsStore.getState().savedTrips).toEqual([tripOne]);
  });

  test("removeTrip removes only the requested trip", async () => {
    resetStore({ savedTrips: [tripOne, tripTwo] });
    services.deleteSavedTrip.mockResolvedValue(true);
    await expect(useSavedTripsStore.getState().removeTrip("one")).resolves.toBe(
      true,
    );
    expect(useSavedTripsStore.getState().savedTrips).toEqual([tripTwo]);
  });

  test("removing the active trip clears it", async () => {
    resetStore({ savedTrips: [tripOne, tripTwo], activeSavedTrip: tripOne });
    services.deleteSavedTrip.mockResolvedValue(true);
    await useSavedTripsStore.getState().removeTrip("one");
    expect(useSavedTripsStore.getState().activeSavedTrip).toBeNull();
  });

  test("removing another trip preserves the active trip", async () => {
    resetStore({ savedTrips: [tripOne, tripTwo], activeSavedTrip: tripOne });
    services.deleteSavedTrip.mockResolvedValue(true);
    await useSavedTripsStore.getState().removeTrip("two");
    expect(useSavedTripsStore.getState().activeSavedTrip).toBe(tripOne);
  });

  test("failed deletion preserves state", async () => {
    resetStore({ savedTrips: [tripOne, tripTwo], activeSavedTrip: tripOne });
    services.deleteSavedTrip.mockRejectedValue(new Error("delete"));
    await expect(useSavedTripsStore.getState().removeTrip("one")).resolves.toBe(
      false,
    );
    expect(useSavedTripsStore.getState()).toMatchObject({
      savedTrips: [tripOne, tripTwo],
      activeSavedTrip: tripOne,
    });
  });

  test("updateTrip refreshes the list and active trip", async () => {
    const updated = { ...tripOne, title: "Updated" };
    resetStore({ savedTrips: [tripOne, tripTwo], activeSavedTrip: tripOne });
    services.updateSavedTrip.mockResolvedValue(updated);
    services.loadSavedTrips.mockResolvedValue([updated, tripTwo]);

    await expect(
      useSavedTripsStore.getState().updateTrip("one", { title: "Updated" }),
    ).resolves.toBe(updated);
    expect(services.updateSavedTrip).toHaveBeenCalledWith("one", {
      title: "Updated",
    });
    expect(useSavedTripsStore.getState()).toMatchObject({
      savedTrips: [updated, tripTwo],
      activeSavedTrip: updated,
    });
  });

  test("failed updates preserve previous state", async () => {
    resetStore({ savedTrips: [tripOne], activeSavedTrip: tripOne });
    services.updateSavedTrip.mockRejectedValue(new Error("update"));
    await expect(
      useSavedTripsStore.getState().updateTrip("one", { title: "No" }),
    ).resolves.toBeNull();
    expect(useSavedTripsStore.getState()).toMatchObject({
      savedTrips: [tripOne],
      activeSavedTrip: tripOne,
    });
  });

  test("clearTrips clears list and active trip", async () => {
    resetStore({ savedTrips: [tripOne], activeSavedTrip: tripOne });
    services.clearSavedTrips.mockResolvedValue(true);
    await expect(useSavedTripsStore.getState().clearTrips()).resolves.toBe(true);
    expect(useSavedTripsStore.getState()).toMatchObject({
      savedTrips: [],
      activeSavedTrip: null,
      savedTripsRecoveryRequired: false,
    });
  });

  test("failed clearing preserves list and active trip", async () => {
    resetStore({ savedTrips: [tripOne], activeSavedTrip: tripOne });
    services.clearSavedTrips.mockRejectedValue(new Error("clear"));
    await expect(useSavedTripsStore.getState().clearTrips()).resolves.toBe(false);
    expect(useSavedTripsStore.getState()).toMatchObject({
      savedTrips: [tripOne],
      activeSavedTrip: tripOne,
    });
  });

  test("loadTripById sets activeSavedTrip", async () => {
    services.loadSavedTripById.mockResolvedValue(tripOne);
    await expect(
      useSavedTripsStore.getState().loadTripById("one"),
    ).resolves.toBe(tripOne);
    expect(useSavedTripsStore.getState().activeSavedTrip).toBe(tripOne);
  });

  test("a missing ID returns null and exposes the documented message", async () => {
    services.loadSavedTripById.mockRejectedValue(
      Object.assign(new Error("missing"), { code: "trip-not-found" }),
    );
    await expect(
      useSavedTripsStore.getState().loadTripById("missing"),
    ).resolves.toBeNull();
    expect(useSavedTripsStore.getState().savedTripsError).toBe(
      "This saved trip could not be found on this device.",
    );
  });

  test("setActiveSavedTrip and clearActiveSavedTrip work", () => {
    useSavedTripsStore.getState().setActiveSavedTrip(tripOne);
    expect(useSavedTripsStore.getState().activeSavedTrip).toBe(tripOne);
    useSavedTripsStore.getState().clearActiveSavedTrip();
    expect(useSavedTripsStore.getState().activeSavedTrip).toBeNull();
  });

  test("clearSavedTripsError clears error and recovery state", () => {
    resetStore({
      savedTripsError: "Corrupt",
      savedTripsRecoveryRequired: true,
    });
    useSavedTripsStore.getState().clearSavedTripsError();
    expect(useSavedTripsStore.getState()).toMatchObject({
      savedTripsError: null,
      savedTripsRecoveryRequired: false,
    });
  });

  test("overlapping loads settle to the latest completed state", async () => {
    const first = deferred();
    const second = deferred();
    services.loadSavedTrips
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstLoad = useSavedTripsStore.getState().loadTrips();
    const secondLoad = useSavedTripsStore.getState().loadTrips();
    first.resolve([tripOne]);
    await firstLoad;
    second.resolve([tripTwo]);
    await secondLoad;

    expect(useSavedTripsStore.getState().savedTrips).toEqual([tripTwo]);
  });
});
