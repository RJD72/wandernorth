jest.mock("../app/utils/logger", () => ({
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const FAKE_KEY = "test-google-poi-key-not-real";

function response(data, { ok = true, status = 200 } = {}) {
  return { ok, status, json: jest.fn().mockResolvedValue(data) };
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
    ...require("../app/services/poiProviders/googlePoiProvider"),
    tracker,
    logger: require("../app/utils/logger").logger,
  };
}

const request = {
  point: { latitude: 43, longitude: -81 },
  providerType: "cafe",
  radiusMeters: 6000,
  maxResultCount: 5,
};

describe("Google POI provider contract", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME;
    delete process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1;
  });

  test("builds the expected Places Nearby request", async () => {
    const { fetchPoisForRoutePointAndType } = loadSubject();
    fetch.mockResolvedValue(response({ places: [] }));
    await fetchPoisForRoutePointAndType(request);
    const [url, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toBe("https://places.googleapis.com/v1/places:searchNearby");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Goog-Api-Key": FAKE_KEY,
      "X-Android-Package": "com.example.test",
      "X-Android-Cert": "AA:BB:CC",
      "X-Goog-FieldMask": expect.stringContaining("places.location"),
    });
    expect(body).toMatchObject({
      includedTypes: ["cafe"],
      maxResultCount: 5,
      locationRestriction: {
        circle: { center: request.point, radius: 6000 },
      },
    });
  });

  test("normalizes Google results into canonical app POIs", async () => {
    const { fetchPoisForRoutePointAndType } = loadSubject();
    fetch.mockResolvedValue(
      response({
        places: [
          {
            id: "google-one",
            displayName: { text: "Test Cafe" },
            formattedAddress: "1 Test Street",
            location: { latitude: 43.1, longitude: -81.1 },
            primaryType: "cafe",
            rating: 4.6,
            userRatingCount: 80,
            googleMapsUri: "https://maps.example/one",
          },
        ],
      }),
    );
    await expect(fetchPoisForRoutePointAndType(request)).resolves.toEqual([
      {
        id: "google-one",
        provider: "google",
        providerPlaceId: "google-one",
        googlePlaceId: "google-one",
        name: "Test Cafe",
        category: "cafe",
        providerCategory: "cafe",
        googlePrimaryType: "cafe",
        address: "1 Test Street",
        latitude: 43.1,
        longitude: -81.1,
        rating: 4.6,
        userRatingCount: 80,
        googleMapsUri: "https://maps.example/one",
      },
    ]);
  });

  test("empty and malformed results normalize to an empty list", async () => {
    const { fetchPoisForRoutePointAndType } = loadSubject();
    fetch
      .mockResolvedValueOnce(response({ places: [] }))
      .mockResolvedValueOnce(response({ places: [{ id: "missing-location" }] }));
    await expect(fetchPoisForRoutePointAndType(request)).resolves.toEqual([]);
    await expect(fetchPoisForRoutePointAndType(request)).resolves.toEqual([]);
  });

  test("non-OK responses count as failures and do not leak credentials", async () => {
    const { fetchPoisForRoutePointAndType, tracker, logger } = loadSubject();
    fetch.mockResolvedValue(
      response(
        { error: { message: `Denied ${FAKE_KEY}` } },
        { ok: false, status: 403 },
      ),
    );
    let caught;
    try {
      await fetchPoisForRoutePointAndType(request);
    } catch (error) {
      caught = error;
    }
    expect(caught.message).not.toContain(FAKE_KEY);
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(FAKE_KEY);
    expect(
      tracker
        .getApiUsageSnapshot()
        .find((entry) => entry.operation === "places-nearby"),
    ).toMatchObject({ started: 1, failed: 1, succeeded: 0 });
  });

  test("successful requests count as successes", async () => {
    const { fetchPoisForRoutePointAndType, tracker } = loadSubject();
    fetch.mockResolvedValue(response({ places: [] }));
    await fetchPoisForRoutePointAndType(request);
    expect(
      tracker
        .getApiUsageSnapshot()
        .find((entry) => entry.operation === "places-nearby"),
    ).toMatchObject({ started: 1, succeeded: 1, failed: 0 });
  });

  test("type mapping, priority, and radius follow current policy", () => {
    const {
      getProviderPoiTypes,
      prioritizeProviderPoiTypesForSearch,
      getSearchRadiusForType,
    } = loadSubject();
    expect(getProviderPoiTypes(["gas"])).toContain("gas_station");
    expect(
      prioritizeProviderPoiTypesForSearch(
        ["park", "restaurant", "cafe"],
        ["restaurant", "park"],
      )[0],
    ).toBe("restaurant");
    expect(getSearchRadiusForType("restaurant")).toBe(6000);
    expect(getSearchRadiusForType("park")).toBe(3500);
  });
});
