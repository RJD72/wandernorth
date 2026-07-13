const params = {
  routePoints: [
    { latitude: 43, longitude: -81 },
    { latitude: 44, longitude: -80 },
  ],
  selectedPoiTypes: ["cafe", "park"],
  numStops: 2,
};

function loadSubject({ demo = false, providerIds = ["google"] } = {}) {
  jest.resetModules();
  const activePoiProviders = providerIds.map((id) => ({ id }));
  jest.doMock("../app/config/demoMode", () => ({ isDemoModeEnabled: demo }));
  jest.doMock("../app/services/poiService", () => ({
    fetchPoisNearRoutePoints: jest.fn(),
  }));
  jest.doMock("../app/services/poiProviders", () => ({
    activePoiProviders,
  }));
  const poiService = require("../app/services/poiService");
  const tracker = require("../app/services/apiUsageTracker");
  tracker.resetApiUsage();
  return {
    fetchPoisForRoute: require("../app/services/poiSearchService")
      .fetchPoisForRoute,
    fetchPoisNearRoutePoints: poiService.fetchPoisNearRoutePoints,
    activePoiProviders,
    tracker,
  };
}

describe("poiSearchService contract", () => {
  test("demo mode returns cloned fixture POIs without providers", async () => {
    const { fetchPoisForRoute, fetchPoisNearRoutePoints } = loadSubject({
      demo: true,
    });
    const first = await fetchPoisForRoute(params);
    const second = await fetchPoisForRoute(params);

    expect(first.length).toBeGreaterThan(0);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    first[0].name = "mutated";
    expect(second[0].name).not.toBe("mutated");
    expect(fetchPoisNearRoutePoints).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("demo mode respects zero requested stops and records no provider outbound call", async () => {
    const { fetchPoisForRoute, tracker } = loadSubject({ demo: true });
    await expect(fetchPoisForRoute({ ...params, numStops: 0 })).resolves.toEqual(
      [],
    );
    expect(
      tracker
        .getApiUsageSnapshot()
        .some((entry) => ["google", "tomtom"].includes(entry.provider)),
    ).toBe(false);
  });

  test("real mode delegates and returns orchestration results", async () => {
    const { fetchPoisForRoute, fetchPoisNearRoutePoints } = loadSubject();
    const result = [{ id: "one" }];
    fetchPoisNearRoutePoints.mockResolvedValue(result);
    await expect(fetchPoisForRoute(params)).resolves.toEqual(result);
    expect(fetchPoisNearRoutePoints).toHaveBeenCalledWith(params);
  });

  test("aggregate cache reuses completed batches", async () => {
    const { fetchPoisForRoute, fetchPoisNearRoutePoints } = loadSubject();
    fetchPoisNearRoutePoints.mockResolvedValue([{ id: "one" }]);
    await fetchPoisForRoute(params);
    await fetchPoisForRoute(params);
    expect(fetchPoisNearRoutePoints).toHaveBeenCalledTimes(1);
  });

  test("aggregate cache deduplicates simultaneous batches", async () => {
    const { fetchPoisForRoute, fetchPoisNearRoutePoints } = loadSubject();
    let resolveBatch;
    fetchPoisNearRoutePoints.mockReturnValue(
      new Promise((resolve) => {
        resolveBatch = resolve;
      }),
    );
    const first = fetchPoisForRoute(params);
    const second = fetchPoisForRoute(params);
    await Promise.resolve();
    expect(fetchPoisNearRoutePoints).toHaveBeenCalledTimes(1);
    resolveBatch([{ id: "one" }]);
    await Promise.all([first, second]);
  });

  test("rejected batches are not cached", async () => {
    const { fetchPoisForRoute, fetchPoisNearRoutePoints } = loadSubject();
    fetchPoisNearRoutePoints
      .mockRejectedValueOnce(new Error("batch"))
      .mockResolvedValueOnce([{ id: "recovered" }]);
    await expect(fetchPoisForRoute(params)).rejects.toThrow("batch");
    await expect(fetchPoisForRoute(params)).resolves.toEqual([
      { id: "recovered" },
    ]);
  });

  test.each([
    ["route points", { routePoints: [{ latitude: 42, longitude: -82 }] }],
    ["category selection", { selectedPoiTypes: ["museum", "park"] }],
    ["category order", { selectedPoiTypes: ["park", "cafe"] }],
    ["stop count", { numStops: 3 }],
  ])("cache isolates different %s", async (_label, change) => {
    const { fetchPoisForRoute, fetchPoisNearRoutePoints } = loadSubject();
    fetchPoisNearRoutePoints.mockResolvedValue([]);
    await fetchPoisForRoute(params);
    await fetchPoisForRoute({ ...params, ...change });
    expect(fetchPoisNearRoutePoints).toHaveBeenCalledTimes(2);
  });

  test("cache keys isolate enabled providers", async () => {
    const loaded = loadSubject({ providerIds: ["google"] });
    loaded.fetchPoisNearRoutePoints.mockResolvedValue([]);
    await loaded.fetchPoisForRoute(params);
    loaded.activePoiProviders.push({ id: "tomtom" });
    await loaded.fetchPoisForRoute(params);
    expect(loaded.fetchPoisNearRoutePoints).toHaveBeenCalledTimes(2);
  });
});
