import {
  buildAutocompleteRequestBody,
  createAutocompleteSessionToken,
  fetchAutocompletePredictions,
  fetchPlaceDetailsNew,
  normalizeAutocompleteSuggestions,
} from "../app/services/googlePlacesAutocomplete";

const FAKE_KEY = "test-key";

function okJson(data) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(data),
  };
}

describe("Google Places Autocomplete (New)", () => {
  const originalPackageName = process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME;
  const originalCertSha1 = process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME = "com.rob.wandernorth";
    process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1 = "AA:BB:CC";
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME = originalPackageName;
    process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1 = originalCertSha1;
  });

  test("creates a fresh deterministic token from the supplied sources", () => {
    expect(
      createAutocompleteSessionToken({
        now: () => 123456,
        random: () => 0.25,
      }),
    ).toBe("wn_2n9c_9");
  });

  test("keeps Canada restriction and route-aware location bias", () => {
    expect(
      buildAutocompleteRequestBody({
        inputText: "museum",
        sessionToken: "session-one",
        locationBias: {
          latitude: 43.45,
          longitude: -80.49,
          radiusMeters: 50000,
        },
      }),
    ).toEqual({
      input: "museum",
      includedRegionCodes: ["ca"],
      regionCode: "CA",
      sessionToken: "session-one",
      locationBias: {
        circle: {
          center: { latitude: 43.45, longitude: -80.49 },
          radius: 50000,
        },
      },
    });
  });

  test("uses a location restriction when strict bounds are requested", () => {
    const body = buildAutocompleteRequestBody({
      inputText: "Kitchener",
      sessionToken: "session-two",
      locationBias: {
        latitude: 43.45,
        longitude: -80.49,
        radiusMeters: 25000,
      },
      strictBounds: true,
    });

    expect(body.locationBias).toBeUndefined();
    expect(body.locationRestriction.circle.radius).toBe(25000);
  });

  test("normalizes the new suggestion shape to the existing UI contract", () => {
    expect(
      normalizeAutocompleteSuggestions([
        {
          placePrediction: {
            placeId: "place-one",
            text: { text: "Victoria Park, Kitchener, ON, Canada" },
            structuredFormat: {
              mainText: { text: "Victoria Park" },
              secondaryText: { text: "Kitchener, ON, Canada" },
            },
          },
        },
        { queryPrediction: { text: { text: "ignored query" } } },
      ]),
    ).toEqual([
      expect.objectContaining({
        place_id: "place-one",
        name: "Victoria Park",
        address: "Kitchener, ON, Canada",
        description: "Victoria Park, Kitchener, ON, Canada",
        source: "autocomplete-new",
      }),
    ]);
  });

  test("posts Autocomplete (New) with one session token and Android restrictions", async () => {
    fetch.mockResolvedValueOnce(
      okJson({
        suggestions: [
          {
            placePrediction: {
              placeId: "place-one",
              text: { text: "Victoria Park, Kitchener, ON, Canada" },
            },
          },
        ],
      }),
    );

    const predictions = await fetchAutocompletePredictions({
      inputText: "Victoria",
      apiKey: FAKE_KEY,
      sessionToken: "session-three",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places:autocomplete",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Goog-Api-Key": FAKE_KEY,
          "X-Android-Package": "com.rob.wandernorth",
          "X-Android-Cert": "AA:BB:CC",
        }),
      }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      input: "Victoria",
      includedRegionCodes: ["ca"],
      sessionToken: "session-three",
    });
    expect(predictions[0].place_id).toBe("place-one");
  });

  test("passes the matching token to Place Details (New) and returns coordinates", async () => {
    fetch.mockResolvedValueOnce(
      okJson({
        id: "place-one",
        displayName: { text: "Victoria Park" },
        formattedAddress: "32 Dill St, Kitchener, ON, Canada",
        location: { latitude: 43.4389, longitude: -80.4997 },
      }),
    );

    await expect(
      fetchPlaceDetailsNew({
        placeId: "place-one",
        fallbackName: "Fallback",
        apiKey: FAKE_KEY,
        sessionToken: "session-three",
      }),
    ).resolves.toEqual({
      name: "Victoria Park",
      address: "32 Dill St, Kitchener, ON, Canada",
      coords: { latitude: 43.4389, longitude: -80.4997 },
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places/place-one?sessionToken=session-three",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
        }),
      }),
    );
  });

  test("rejects non-success HTTP responses", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(
      fetchAutocompletePredictions({
        inputText: "museum",
        apiKey: FAKE_KEY,
        sessionToken: "session-four",
      }),
    ).rejects.toThrow("google request failed");
  });
});
