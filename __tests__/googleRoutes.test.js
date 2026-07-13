jest.mock("../app/utils/logger", () => ({
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const FAKE_KEY = "test-google-key-not-real";

function successRoute(overrides = {}) {
  return {
    distanceMeters: 12500,
    duration: "5400s",
    polyline: { encodedPolyline: "encoded-polyline" },
    legs: [{ distanceMeters: 12500 }],
    ...overrides,
  };
}

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
  };
}

function loadSubject() {
  jest.resetModules();
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = FAKE_KEY;
  process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME = "com.example.test";
  process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1 = "AA:BB:CC";
  global.fetch = jest.fn();
  const tracker = require("../app/services/apiUsageTracker");
  tracker.resetApiUsage();
  return {
    buildGoogleRoute: require("../app/services/googleRoutes").buildGoogleRoute,
    tracker,
    logger: require("../app/utils/logger").logger,
  };
}

const baseParams = {
  startingCoords: { latitude: 43, longitude: -81 },
  destinationCoords: { latitude: 44, longitude: -80 },
  travelMode: "driving",
};

describe("googleRoutes adapter contract", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME;
    delete process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1;
  });

  test.each([
    ["driving", "DRIVE", "TRAFFIC_AWARE"],
    ["walking", "WALK", undefined],
    ["bicycling", "BICYCLE", undefined],
  ])("builds the expected %s request", async (mode, googleMode, preference) => {
    const { buildGoogleRoute } = loadSubject();
    fetch.mockResolvedValue(jsonResponse({ routes: [successRoute()] }));

    await buildGoogleRoute({ ...baseParams, travelMode: mode });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(url).toBe(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
    );
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Goog-Api-Key": FAKE_KEY,
      "X-Android-Package": "com.example.test",
      "X-Android-Cert": "AA:BB:CC",
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs",
    });
    expect(body).toMatchObject({
      origin: { location: { latLng: baseParams.startingCoords } },
      destination: { location: { latLng: baseParams.destinationCoords } },
      travelMode: googleMode,
      units: "METRIC",
      polylineEncoding: "ENCODED_POLYLINE",
      computeAlternativeRoutes: false,
    });
    if (preference) {
      expect(body.routingPreference).toBe(preference);
    } else {
      expect(body).not.toHaveProperty("routingPreference");
    }
  });

  test("preserves ordered intermediate waypoints", async () => {
    const { buildGoogleRoute } = loadSubject();
    fetch.mockResolvedValue(jsonResponse({ routes: [successRoute()] }));
    const waypoints = [
      { latitude: 43.2, longitude: -80.8 },
      { latitude: 43.8, longitude: -80.2 },
    ];
    await buildGoogleRoute({ ...baseParams, waypoints });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.intermediates).toEqual(
      waypoints.map((latLng) => ({ location: { latLng } })),
    );
  });

  test("normalizes success, distance, and duration", async () => {
    const { buildGoogleRoute } = loadSubject();
    const raw = successRoute();
    fetch.mockResolvedValue(jsonResponse({ routes: [raw] }));
    await expect(buildGoogleRoute(baseParams)).resolves.toEqual({
      raw,
      distanceMeters: 12500,
      distanceText: "12.5 km",
      duration: "5400s",
      durationText: "1 hr 30 min",
      encodedPolyline: "encoded-polyline",
      legs: raw.legs,
    });
  });

  test("formats short durations and missing metrics using current fallbacks", async () => {
    const { buildGoogleRoute } = loadSubject();
    fetch.mockResolvedValue(
      jsonResponse({
        routes: [
          successRoute({
            distanceMeters: 0,
            duration: "1500s",
            legs: undefined,
          }),
        ],
      }),
    );
    await expect(buildGoogleRoute(baseParams)).resolves.toMatchObject({
      distanceText: "Unknown distance",
      durationText: "25 min",
      legs: [],
    });
  });

  test("missing route results reject clearly", async () => {
    const { buildGoogleRoute } = loadSubject();
    fetch.mockResolvedValue(jsonResponse({ routes: [] }));
    await expect(buildGoogleRoute(baseParams)).rejects.toThrow("No routes found");
  });

  test("malformed success responses reject", async () => {
    const { buildGoogleRoute } = loadSubject();
    fetch.mockResolvedValue(jsonResponse({ routes: [{}] }));
    await expect(buildGoogleRoute(baseParams)).rejects.toThrow();
  });

  test("non-OK responses are tracked as failures", async () => {
    const { buildGoogleRoute, tracker } = loadSubject();
    fetch.mockResolvedValue(
      jsonResponse({ error: { message: "Denied" } }, { ok: false, status: 403 }),
    );
    await expect(buildGoogleRoute(baseParams)).rejects.toThrow("Denied");
    expect(tracker.getApiUsageSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "google",
          operation: "routes",
          started: 1,
          failed: 1,
          succeeded: 0,
          currentInFlight: 0,
        }),
      ]),
    );
  });

  test("success is tracked accurately", async () => {
    const { buildGoogleRoute, tracker } = loadSubject();
    fetch.mockResolvedValue(jsonResponse({ routes: [successRoute()] }));
    await buildGoogleRoute(baseParams);
    expect(tracker.getApiUsageSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "google",
          operation: "routes",
          started: 1,
          succeeded: 1,
          failed: 0,
        }),
      ]),
    );
  });

  test("provider errors cannot leak configured credentials", async () => {
    const { buildGoogleRoute, logger } = loadSubject();
    fetch.mockResolvedValue(
      jsonResponse(
        { error: { message: `Denied for ${FAKE_KEY}` } },
        { ok: false, status: 403 },
      ),
    );
    let caught;
    try {
      await buildGoogleRoute(baseParams);
    } catch (error) {
      caught = error;
    }
    expect(caught.message).not.toContain(FAKE_KEY);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(FAKE_KEY);
  });
});
