const FAKE_KEY = "test-places-key-not-real";

function loadSubject() {
  jest.resetModules();
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = FAKE_KEY;
  process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME = "com.example.test";
  process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1 = "AA:BB:CC";
  global.fetch = jest.fn();
  const tracker = require("../app/services/apiUsageTracker");
  tracker.resetApiUsage();
  return {
    fetchGooglePlaceDetailsForStop:
      require("../app/services/googlePlaces").fetchGooglePlaceDetailsForStop,
    tracker,
  };
}

function response(data, { ok = true, status = 200, text = "" } = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(text),
  };
}

describe("googlePlaces details contract", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME;
    delete process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1;
  });

  test("missing Place ID avoids requests", async () => {
    const { fetchGooglePlaceDetailsForStop } = loadSubject();
    await expect(fetchGooglePlaceDetailsForStop({ id: "provider-only" })).resolves.toMatchObject({
      googlePlaceId: null,
      imageUrls: [],
      source: "no-google-place-id",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("uses the details endpoint, restriction headers, and required field mask", async () => {
    const { fetchGooglePlaceDetailsForStop } = loadSubject();
    fetch.mockResolvedValue(response({ id: "place-one" }));
    await fetchGooglePlaceDetailsForStop({ googlePlaceId: "place-one" });
    expect(fetch).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places/place-one",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "X-Goog-Api-Key": FAKE_KEY,
          "X-Android-Package": "com.example.test",
          "X-Android-Cert": "AA:BB:CC",
          "X-Goog-FieldMask":
            "id,displayName,formattedAddress,photos,editorialSummary,rating,userRatingCount,googleMapsUri",
        }),
      }),
    );
  });

  test("normalizes title, address, rating, reviews, Maps URI, and description", async () => {
    const { fetchGooglePlaceDetailsForStop } = loadSubject();
    fetch.mockResolvedValue(
      response({
        id: "place-one",
        displayName: { text: "Test Place" },
        formattedAddress: "1 Test Street",
        editorialSummary: { text: "A useful stop" },
        rating: 4.7,
        userRatingCount: 123,
        googleMapsUri: "https://maps.example/place-one",
      }),
    );
    await expect(
      fetchGooglePlaceDetailsForStop({ placeId: "place-one" }),
    ).resolves.toMatchObject({
      googlePlaceId: "place-one",
      title: "Test Place",
      address: "1 Test Street",
      description: "A useful stop",
      rating: 4.7,
      userRatingCount: 123,
      googleMapsUri: "https://maps.example/place-one",
      source: "google-place-details",
    });
  });

  test("photo URLs are capped at five and use the configured key", async () => {
    const { fetchGooglePlaceDetailsForStop } = loadSubject();
    fetch.mockResolvedValue(
      response({
        id: "place-one",
        photos: Array.from({ length: 7 }, (_, index) => ({
          name: `places/place-one/photos/${index}`,
        })),
      }),
    );
    const result = await fetchGooglePlaceDetailsForStop({
      googlePlaceId: "place-one",
    });
    expect(result.imageUrls).toHaveLength(5);
    expect(result.imageUrls[0]).toBe(
      `https://places.googleapis.com/v1/places/place-one/photos/0/media?maxWidthPx=900&key=${FAKE_KEY}`,
    );
  });

  test("missing or malformed optional data normalizes safely", async () => {
    const { fetchGooglePlaceDetailsForStop } = loadSubject();
    fetch.mockResolvedValue(response({}));
    await expect(
      fetchGooglePlaceDetailsForStop({ place_id: "fallback-id" }),
    ).resolves.toMatchObject({
      googlePlaceId: "fallback-id",
      title: null,
      address: null,
      imageUrls: [],
      rating: null,
      userRatingCount: null,
    });
  });

  test("success and failure usage are tracked", async () => {
    const { fetchGooglePlaceDetailsForStop, tracker } = loadSubject();
    fetch
      .mockResolvedValueOnce(response({ id: "one" }))
      .mockResolvedValueOnce(response({}, { ok: false, status: 500, text: "bad" }));
    await fetchGooglePlaceDetailsForStop({ googlePlaceId: "one" });
    await expect(
      fetchGooglePlaceDetailsForStop({ googlePlaceId: "two" }),
    ).rejects.toThrow();
    expect(
      tracker
        .getApiUsageSnapshot()
        .find((entry) => entry.operation === "place-details"),
    ).toMatchObject({ started: 2, succeeded: 1, failed: 1 });
  });

  test("non-OK response bodies cannot leak credentials", async () => {
    const { fetchGooglePlaceDetailsForStop } = loadSubject();
    fetch.mockResolvedValue(
      response({}, { ok: false, status: 403, text: `Denied ${FAKE_KEY}` }),
    );
    let caught;
    try {
      await fetchGooglePlaceDetailsForStop({ googlePlaceId: "one" });
    } catch (error) {
      caught = error;
    }
    expect(caught.message).not.toContain(FAKE_KEY);
  });

  test("repeated details calls are uncached by the current service contract", async () => {
    const { fetchGooglePlaceDetailsForStop } = loadSubject();
    fetch.mockResolvedValue(response({ id: "one" }));
    await fetchGooglePlaceDetailsForStop({ googlePlaceId: "one" });
    await fetchGooglePlaceDetailsForStop({ googlePlaceId: "one" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
