import fs from "fs";
import path from "path";

function loadSubject() {
  jest.resetModules();
  return require("../app/services/poiProviderRequestCache");
}

const baseRequest = {
  provider: "google",
  providerType: "restaurant",
  point: { latitude: 43.123456, longitude: -81.123456 },
  radiusMeters: 6000,
  maxResults: 20,
  rankingPreference: "DISTANCE",
  region: "CA",
  language: "",
  fieldMaskVersion: "google-nearby-v1:fields",
};

describe("POI provider request cache", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("builds deterministic keys from one provider request, not category arrays or stop count", () => {
    const { createPoiProviderRequestCacheKey } = loadSubject();
    const first = createPoiProviderRequestCacheKey({
      ...baseRequest,
      selectedPoiTypes: ["restaurant", "park"],
      numStops: 2,
    });
    const second = createPoiProviderRequestCacheKey({
      ...baseRequest,
      selectedPoiTypes: ["park", "restaurant"],
      numStops: 5,
    });

    expect(first).toBe(second);
    expect(first).not.toContain("numStops");
    expect(first).not.toContain("park");
    expect(first).not.toContain("apiKey");
  });

  test.each([
    ["provider", { provider: "tomtom" }],
    ["provider type", { providerType: "park" }],
    ["point", { point: { latitude: 44, longitude: -81 } }],
    ["radius", { radiusMeters: 3500 }],
    ["result limit", { maxResults: 10 }],
    ["ranking", { rankingPreference: "POPULARITY" }],
    ["region", { region: "US" }],
    ["language", { language: "fr-CA" }],
    ["field schema", { fieldMaskVersion: "google-nearby-v2:fields" }],
  ])("isolates %s changes", (_label, change) => {
    const { createPoiProviderRequestCacheKey } = loadSubject();
    expect(createPoiProviderRequestCacheKey(baseRequest)).not.toBe(
      createPoiProviderRequestCacheKey({ ...baseRequest, ...change }),
    );
  });

  test("reuses successful results and returns defensive clones", async () => {
    const { createPoiProviderRequestCacheKey, loadPoiProviderRequest } =
      loadSubject();
    const cacheKey = createPoiProviderRequestCacheKey(baseRequest);
    const loader = jest.fn().mockResolvedValue([{ id: "one", name: "One" }]);

    const first = await loadPoiProviderRequest({
      cacheKey,
      provider: "google",
      loader,
    });
    first[0].name = "route-enriched mutation";
    const second = await loadPoiProviderRequest({
      cacheKey,
      provider: "google",
      loader,
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(second).toEqual([{ id: "one", name: "One" }]);
    expect(second).not.toBe(first);
  });

  test("caches successful empty arrays", async () => {
    const { createPoiProviderRequestCacheKey, loadPoiProviderRequest } =
      loadSubject();
    const cacheKey = createPoiProviderRequestCacheKey(baseRequest);
    const loader = jest.fn().mockResolvedValue([]);

    await loadPoiProviderRequest({ cacheKey, provider: "google", loader });
    await loadPoiProviderRequest({ cacheKey, provider: "google", loader });

    expect(loader).toHaveBeenCalledTimes(1);
  });

  test("deduplicates in-flight requests with the same promise", async () => {
    const { createPoiProviderRequestCacheKey, loadPoiProviderRequest } =
      loadSubject();
    const cacheKey = createPoiProviderRequestCacheKey(baseRequest);
    let resolveRequest;
    const loader = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const firstPromise = loadPoiProviderRequest({
      cacheKey,
      provider: "google",
      loader,
    });
    const secondPromise = loadPoiProviderRequest({
      cacheKey,
      provider: "google",
      loader,
    });
    expect(firstPromise).toBe(secondPromise);
    await Promise.resolve();
    resolveRequest([{ id: "one" }]);
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first).toBe(second);
  });

  test("does not cache failures or malformed provider results", async () => {
    const { createPoiProviderRequestCacheKey, loadPoiProviderRequest } =
      loadSubject();
    const cacheKey = createPoiProviderRequestCacheKey(baseRequest);
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ places: [] })
      .mockResolvedValueOnce([{ id: "recovered" }]);

    await expect(
      loadPoiProviderRequest({ cacheKey, provider: "google", loader }),
    ).rejects.toThrow("network");
    await expect(
      loadPoiProviderRequest({ cacheKey, provider: "google", loader }),
    ).rejects.toThrow("malformed");
    await expect(
      loadPoiProviderRequest({ cacheKey, provider: "google", loader }),
    ).resolves.toEqual([{ id: "recovered" }]);
    expect(loader).toHaveBeenCalledTimes(3);
  });

  test("expires entries after 24 hours without extending TTL on a hit", async () => {
    const { createPoiProviderRequestCacheKey, loadPoiProviderRequest } =
      loadSubject();
    const cacheKey = createPoiProviderRequestCacheKey(baseRequest);
    const loader = jest
      .fn()
      .mockResolvedValueOnce([{ id: "old" }])
      .mockResolvedValueOnce([{ id: "fresh" }]);
    let now = 1_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);

    await loadPoiProviderRequest({ cacheKey, provider: "google", loader });
    now += 23 * 60 * 60 * 1000;
    await loadPoiProviderRequest({ cacheKey, provider: "google", loader });
    now += 2 * 60 * 60 * 1000;
    await expect(
      loadPoiProviderRequest({ cacheKey, provider: "google", loader }),
    ).resolves.toEqual([{ id: "fresh" }]);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  test("uses bounded LRU eviction and reports memory-only persistence", async () => {
    const {
      createPoiProviderRequestCacheKey,
      getPoiProviderRequestCacheSize,
      loadPoiProviderRequest,
      POI_CACHE_PERSISTENCE_POLICY,
    } = loadSubject();

    for (let index = 0; index < 401; index += 1) {
      const request = {
        ...baseRequest,
        point: { latitude: 43 + index / 1000, longitude: -81 },
      };
      await loadPoiProviderRequest({
        cacheKey: createPoiProviderRequestCacheKey(request),
        provider: "google",
        loader: async () => [],
      });
    }

    expect(getPoiProviderRequestCacheSize()).toBe(400);
    expect(POI_CACHE_PERSISTENCE_POLICY).toEqual({
      google: "memory-only",
      tomtom: "memory-only",
    });
    const source = fs.readFileSync(
      path.join(__dirname, "../app/services/poiProviderRequestCache.js"),
      "utf8",
    );
    expect(source).not.toContain("AsyncStorage");
  });

  test("records cache and network diagnostics per provider", async () => {
    const {
      createPoiCacheDiagnostics,
      createPoiProviderRequestCacheKey,
      loadPoiProviderRequest,
    } = loadSubject();
    const cacheKey = createPoiProviderRequestCacheKey(baseRequest);
    const diagnostics = createPoiCacheDiagnostics();
    const loader = jest.fn().mockResolvedValue([]);

    await loadPoiProviderRequest({
      cacheKey,
      provider: "google",
      loader,
      diagnostics,
    });
    await loadPoiProviderRequest({
      cacheKey,
      provider: "google",
      loader,
      diagnostics,
    });

    expect(diagnostics).toMatchObject({
      providerRequestCount: 2,
      memoryCacheHits: 1,
      persistentCacheHits: 0,
      cacheMisses: 1,
      networkCalls: 1,
      successfulNetworkCalls: 1,
      failedNetworkCalls: 0,
    });
    expect(diagnostics.byProvider.google).toMatchObject({
      providerRequestCount: 2,
      memoryCacheHits: 1,
      networkCalls: 1,
    });
  });
});
