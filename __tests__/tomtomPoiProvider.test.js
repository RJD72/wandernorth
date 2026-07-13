const FAKE_API_KEY = "tomtom-test-key-not-real";

function makeResponse({ ok = true, status = 200, data = {} } = {}) {
  return {
    ok,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

function loadSubject() {
  jest.resetModules();
  process.env.EXPO_PUBLIC_TOMTOM_API_KEY = FAKE_API_KEY;
  jest.doMock("../app/utils/logger", () => ({
    logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
  }));

  const subject = require("../app/services/poiProviders/tomtomPoiProvider");
  const { logger } = require("../app/utils/logger");
  const usage = require("../app/services/apiUsageTracker");
  usage.resetApiUsage();
  return { ...subject, logger, usage };
}

describe("tomtomPoiProvider", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_TOMTOM_API_KEY;
  });

  test("builds a GET request with the expected encoded type and query", async () => {
    const { fetchPoisForRoutePointAndType } = loadSubject();
    fetch.mockResolvedValue(
      makeResponse({ data: { results: [] } }),
    );

    await fetchPoisForRoutePointAndType({
      point: { latitude: 43.1, longitude: -81.2 },
      providerType: "tourist attraction",
      radiusMeters: 3500,
      maxResultCount: 4,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    const parsedUrl = new URL(url);
    expect(parsedUrl.pathname).toContain("/tourist%20attraction.json");
    expect(parsedUrl.searchParams.get("key")).toBe(FAKE_API_KEY);
    expect(parsedUrl.searchParams.get("lat")).toBe("43.1");
    expect(parsedUrl.searchParams.get("lon")).toBe("-81.2");
    expect(parsedUrl.searchParams.get("radius")).toBe("3500");
    expect(parsedUrl.searchParams.get("limit")).toBe("4");
    expect(parsedUrl.searchParams.get("countrySet")).toBe("CA");
    expect(options).toEqual({ method: "GET" });
  });

  test("normalizes valid results and drops records without stable coordinates or ids", async () => {
    const { fetchPoisForRoutePointAndType } = loadSubject();
    fetch.mockResolvedValue(
      makeResponse({
        data: {
          results: [
            {
              id: "place-1",
              position: { lat: 43.2, lon: -81.3 },
              poi: { name: "Lookout", categories: ["tourist attraction"] },
              address: { freeformAddress: "Test address" },
            },
            { id: "missing-position" },
            { position: { lat: 43.2, lon: -81.3 } },
          ],
        },
      }),
    );

    const result = await fetchPoisForRoutePointAndType({
      point: { latitude: 43, longitude: -81 },
      providerType: "tourist attraction",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "tomtom:place-1",
      provider: "tomtom",
      providerPlaceId: "place-1",
      tomtomPlaceId: "place-1",
      name: "Lookout",
      category: "tourist_attraction",
      providerCategory: "tourist attraction",
      address: "Test address",
      latitude: 43.2,
      longitude: -81.3,
      rating: null,
    });
  });

  test("treats empty and malformed successful payloads as no results", async () => {
    const { fetchPoisForRoutePointAndType } = loadSubject();
    fetch
      .mockResolvedValueOnce(makeResponse({ data: {} }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue("not-json"),
      });

    await expect(
      fetchPoisForRoutePointAndType({
        point: { latitude: 43, longitude: -81 },
        providerType: "cafe",
      }),
    ).resolves.toEqual([]);
    await expect(
      fetchPoisForRoutePointAndType({
        point: { latitude: 43, longitude: -81 },
        providerType: "cafe",
      }),
    ).resolves.toEqual([]);
  });

  test("rejects missing configuration before fetch", async () => {
    const { fetchPoisForRoutePointAndType } = loadSubject();
    delete process.env.EXPO_PUBLIC_TOMTOM_API_KEY;

    await expect(
      fetchPoisForRoutePointAndType({
        point: { latitude: 43, longitude: -81 },
        providerType: "cafe",
      }),
    ).rejects.toThrow("Missing EXPO_PUBLIC_TOMTOM_API_KEY");
    expect(fetch).not.toHaveBeenCalled();
  });

  test("tracks provider usage for success and non-OK failure", async () => {
    const { fetchPoisForRoutePointAndType, usage } = loadSubject();
    fetch
      .mockResolvedValueOnce(makeResponse({ data: { results: [] } }))
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 429 }));

    await fetchPoisForRoutePointAndType({
      point: { latitude: 43, longitude: -81 },
      providerType: "cafe",
    });
    await expect(
      fetchPoisForRoutePointAndType({
        point: { latitude: 43, longitude: -81 },
        providerType: "cafe",
      }),
    ).rejects.toThrow("status 429");

    expect(
      usage
        .getApiUsageSnapshot()
        .find((entry) => entry.operation === "poi-search"),
    ).toMatchObject({ started: 2, succeeded: 1, failed: 1 });
  });

  test("maps selections, prioritizes explicit restaurants, and chooses radii", () => {
    const {
      normalizeSelectedPoiTypes,
      getProviderPoiTypes,
      prioritizeProviderPoiTypesForSearch,
      getSearchRadiusForType,
    } = loadSubject();

    expect(normalizeSelectedPoiTypes(["cafe", "coffee", "hotels"])).toEqual(
      expect.arrayContaining(["cafe", "coffee shop", "hotel"]),
    );
    expect(getProviderPoiTypes([])).toEqual([
      "cafe",
      "restaurant",
      "tourist attraction",
    ]);
    expect(
      prioritizeProviderPoiTypesForSearch(
        ["museum", "restaurant", "cafe"],
        ["restaurants"],
      ),
    ).toEqual(["restaurant", "cafe", "museum"]);
    expect(getSearchRadiusForType("restaurant")).toBe(6000);
    expect(getSearchRadiusForType("museum")).toBe(3500);
  });

  test("does not expose the configured credential in errors or logs", async () => {
    const { fetchPoisForRoutePointAndType, logger } = loadSubject();
    fetch.mockResolvedValue(
      makeResponse({
        ok: false,
        status: 403,
        data: { message: `credential ${FAKE_API_KEY} rejected` },
      }),
    );

    let thrown;
    try {
      await fetchPoisForRoutePointAndType({
        point: { latitude: 43, longitude: -81 },
        providerType: "cafe",
      });
    } catch (error) {
      thrown = error;
    }

    expect(String(thrown)).not.toContain(FAKE_API_KEY);
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(FAKE_API_KEY);
  });
});
