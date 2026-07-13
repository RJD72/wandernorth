jest.mock("expo-location", () => ({
  geocodeAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

jest.mock("../app/utils/logger", () => ({
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function loadSubject() {
  jest.resetModules();
  const Location = require("expo-location");
  const tracker = require("../app/services/apiUsageTracker");
  tracker.resetApiUsage();
  return {
    ...require("../app/services/locationService"),
    Location,
    tracker,
  };
}

describe("locationService contract", () => {
  test("empty addresses avoid geocoding", async () => {
    const { geocodeAddress, Location } = loadSubject();
    await expect(geocodeAddress("   ")).resolves.toBeNull();
    expect(Location.geocodeAsync).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("valid address geocoding returns normalized coordinates", async () => {
    const { geocodeAddress, Location } = loadSubject();
    Location.geocodeAsync.mockResolvedValue([{ latitude: 43, longitude: -81 }]);
    await expect(geocodeAddress("  Test Place  ")).resolves.toEqual({
      latitude: 43,
      longitude: -81,
    });
    expect(Location.geocodeAsync).toHaveBeenCalledWith("Test Place");
  });

  test("no or malformed geocoding result returns null", async () => {
    const { geocodeAddress, Location } = loadSubject();
    Location.geocodeAsync.mockResolvedValueOnce([]).mockResolvedValueOnce(null);
    await expect(geocodeAddress("First")).resolves.toBeNull();
    await expect(geocodeAddress("Second")).resolves.toBeNull();
  });

  test("cache hits avoid repeated geocoding and are tracked separately", async () => {
    const { geocodeAddress, Location, tracker } = loadSubject();
    Location.geocodeAsync.mockResolvedValue([{ latitude: 43, longitude: -81 }]);
    await geocodeAddress("Test   Place");
    await geocodeAddress(" test place ");
    expect(Location.geocodeAsync).toHaveBeenCalledTimes(1);
    expect(tracker.getApiUsageSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "google",
          operation: "geocoding",
          started: 1,
          succeeded: 1,
          cacheHits: 1,
        }),
      ]),
    );
  });

  test("failed geocoding returns null, is tracked, and is retryable", async () => {
    const { geocodeAddress, Location, tracker } = loadSubject();
    Location.geocodeAsync
      .mockRejectedValueOnce(new Error("native failure"))
      .mockResolvedValueOnce([{ latitude: 43, longitude: -81 }]);
    await expect(geocodeAddress("Retry Place")).resolves.toBeNull();
    await expect(geocodeAddress("Retry Place")).resolves.toEqual({
      latitude: 43,
      longitude: -81,
    });
    expect(Location.geocodeAsync).toHaveBeenCalledTimes(2);
    expect(
      tracker
        .getApiUsageSnapshot()
        .find((entry) => entry.operation === "geocoding"),
    ).toMatchObject({ started: 2, succeeded: 1, failed: 1 });
  });

  test("permission denied avoids location and reverse-geocoding calls", async () => {
    const { getCurrentLocationWithLabel, Location } = loadSubject();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    });
    await expect(getCurrentLocationWithLabel()).resolves.toEqual({
      ok: false,
      reason: "permission-denied",
    });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(Location.reverseGeocodeAsync).not.toHaveBeenCalled();
  });

  test("granted permission returns coordinates and reverse-geocoded label", async () => {
    const { getCurrentLocationWithLabel, Location } = loadSubject();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    Location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 43, longitude: -81, accuracy: 10 },
    });
    Location.reverseGeocodeAsync.mockResolvedValue([
      { city: "Test City", region: "Ontario" },
    ]);
    await expect(getCurrentLocationWithLabel()).resolves.toEqual({
      ok: true,
      addressLabel: "Test City, Ontario",
      coords: { latitude: 43, longitude: -81 },
    });
    expect(Location.reverseGeocodeAsync).toHaveBeenCalledWith({
      latitude: 43,
      longitude: -81,
    });
  });

  test("reverse-geocoding uses fallback labels", async () => {
    const { getCurrentLocationWithLabel, Location } = loadSubject();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    Location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 43, longitude: -81 },
    });
    Location.reverseGeocodeAsync.mockResolvedValue([{}]);
    await expect(getCurrentLocationWithLabel()).resolves.toMatchObject({
      ok: true,
      addressLabel: "Current Location",
    });
  });

  test("location retrieval failure returns the documented error", async () => {
    const { getCurrentLocationWithLabel, Location } = loadSubject();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("GPS"));
    await expect(getCurrentLocationWithLabel()).resolves.toEqual({
      ok: false,
      reason: "location-error",
    });
  });

  test("reverse-geocoding usage is tracked", async () => {
    const { getCurrentLocationWithLabel, Location, tracker } = loadSubject();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    Location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 43, longitude: -81 },
    });
    Location.reverseGeocodeAsync.mockResolvedValue([]);
    await getCurrentLocationWithLabel();
    expect(tracker.getApiUsageSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "google",
          operation: "reverse-geocoding",
          started: 1,
          succeeded: 1,
        }),
      ]),
    );
  });
});
