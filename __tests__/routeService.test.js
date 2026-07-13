function normalizedRoute(overrides = {}) {
  return {
    raw: { provider: "mock" },
    distanceMeters: 1200,
    distanceText: "1.2 km",
    duration: "600s",
    durationText: "10 min",
    encodedPolyline: "encoded",
    legs: [],
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    startingCoords: { latitude: 43, longitude: -81 },
    destinationCoords: { latitude: 44, longitude: -80 },
    travelMode: "driving",
    waypoints: [],
    ...overrides,
  };
}

function loadSubject({ demo = false } = {}) {
  jest.resetModules();
  jest.doMock("../app/config/demoMode", () => ({ isDemoModeEnabled: demo }));
  jest.doMock("../app/services/googleRoutes", () => ({
    buildGoogleRoute: jest.fn(),
  }));
  const googleRoutes = require("../app/services/googleRoutes");
  const tracker = require("../app/services/apiUsageTracker");
  tracker.resetApiUsage();
  return {
    buildRoute: require("../app/services/routeService").buildRoute,
    buildGoogleRoute: googleRoutes.buildGoogleRoute,
    tracker,
  };
}

describe("routeService contract", () => {
  test("demo mode returns deterministic compatible route data", async () => {
    const { buildRoute, buildGoogleRoute } = loadSubject({ demo: true });
    const params = request();
    const first = await buildRoute(params);
    const second = await buildRoute(params);

    expect(second).toEqual(first);
    expect(first).toEqual(
      expect.objectContaining({
        encodedPolyline: expect.any(String),
        distanceMeters: expect.any(Number),
        distanceText: expect.any(String),
        duration: expect.stringMatching(/s$/),
        durationText: expect.any(String),
        legs: [],
        demo: true,
      }),
    );
    expect(buildGoogleRoute).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("demo operations do not increment Google outbound counts", async () => {
    const { buildRoute, tracker } = loadSubject({ demo: true });
    await buildRoute(request());
    const snapshot = tracker.getApiUsageSnapshot();

    expect(snapshot).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "app", operation: "build-route" }),
        expect.objectContaining({ provider: "demo", operation: "route" }),
      ]),
    );
    expect(snapshot.some((entry) => entry.provider === "google")).toBe(false);
  });

  test("demo final routes include ordered waypoints", async () => {
    const { buildRoute } = loadSubject({ demo: true });
    const waypoints = [
      { latitude: 43.2, longitude: -80.8 },
      { latitude: 43.8, longitude: -80.2 },
    ];
    const result = await buildRoute(request({ waypoints }));
    expect(result.raw.waypointCount).toBe(2);
    expect(result.encodedPolyline).toEqual(expect.any(String));
  });

  test("real mode delegates once and returns the adapter result unchanged", async () => {
    const { buildRoute, buildGoogleRoute } = loadSubject();
    const result = normalizedRoute();
    const params = request({
      waypoints: [{ latitude: 43.5, longitude: -80.5 }],
    });
    buildGoogleRoute.mockResolvedValue(result);

    await expect(buildRoute(params)).resolves.toEqual(result);
    expect(buildGoogleRoute).toHaveBeenCalledTimes(1);
    expect(buildGoogleRoute).toHaveBeenCalledWith(params);
  });

  test("reuses a valid completed cache entry", async () => {
    const { buildRoute, buildGoogleRoute } = loadSubject();
    buildGoogleRoute.mockResolvedValue(normalizedRoute());
    await buildRoute(request());
    await buildRoute(request());
    expect(buildGoogleRoute).toHaveBeenCalledTimes(1);
  });

  test("deduplicates simultaneous identical calls", async () => {
    const { buildRoute, buildGoogleRoute } = loadSubject();
    let resolveRoute;
    buildGoogleRoute.mockReturnValue(
      new Promise((resolve) => {
        resolveRoute = resolve;
      }),
    );
    const first = buildRoute(request());
    const second = buildRoute(request());
    await Promise.resolve();
    expect(buildGoogleRoute).toHaveBeenCalledTimes(1);
    resolveRoute(normalizedRoute());
    await Promise.all([first, second]);
  });

  test("does not cache failures and allows retry", async () => {
    const { buildRoute, buildGoogleRoute } = loadSubject();
    buildGoogleRoute
      .mockRejectedValueOnce(new Error("failure"))
      .mockResolvedValueOnce(normalizedRoute());
    await expect(buildRoute(request())).rejects.toThrow("failure");
    await expect(buildRoute(request())).resolves.toEqual(normalizedRoute());
    expect(buildGoogleRoute).toHaveBeenCalledTimes(2);
  });

  test("different travel modes remain isolated", async () => {
    const { buildRoute, buildGoogleRoute } = loadSubject();
    buildGoogleRoute.mockResolvedValue(normalizedRoute());
    await buildRoute(request({ travelMode: "driving" }));
    await buildRoute(request({ travelMode: "walking" }));
    expect(buildGoogleRoute).toHaveBeenCalledTimes(2);
  });

  test("different waypoint orders remain isolated", async () => {
    const { buildRoute, buildGoogleRoute } = loadSubject();
    buildGoogleRoute.mockResolvedValue(normalizedRoute());
    const a = { latitude: 43.2, longitude: -80.8 };
    const b = { latitude: 43.8, longitude: -80.2 };
    await buildRoute(request({ waypoints: [a, b] }));
    await buildRoute(request({ waypoints: [b, a] }));
    expect(buildGoogleRoute).toHaveBeenCalledTimes(2);
  });
});
