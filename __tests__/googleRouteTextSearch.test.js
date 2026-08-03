import { clearApiRequestCaches } from "../app/services/apiRequestCaches";
import {
  fetchRouteTextSearchPredictions,
  mergeRouteAndAutocompletePredictions,
} from "../app/services/googleRouteTextSearch";

const FAKE_KEY = "route-text-search-key-not-real";
const routeCoords = [
  { latitude: 43.7, longitude: -81.7 },
  { latitude: 43.88, longitude: -81.31 },
  { latitude: 43.95, longitude: -80.9 },
];
const searchPoints = [routeCoords[0], routeCoords[1], routeCoords[2]];

function successResponse(places) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ places }),
  };
}

function failureResponse(status, error) {
  const body = { error };
  return {
    ok: false,
    status,
    clone() {
      return {
        json: jest.fn().mockResolvedValue(body),
        text: jest.fn().mockResolvedValue(JSON.stringify(body)),
      };
    },
  };
}

function place(id, name, latitude, longitude) {
  return {
    id,
    displayName: { text: name },
    formattedAddress: `${name} address`,
    location: { latitude, longitude },
    primaryType: "coffee_shop",
  };
}

function createLog() {
  return { log: jest.fn(), warn: jest.fn() };
}

describe("custom route Text Search", () => {
  beforeEach(() => {
    clearApiRequestCaches();
    process.env.EXPO_PUBLIC_GOOGLE_WEB_SERVICES_API_KEY = FAKE_KEY;
    process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME = "com.rob.wandernorth";
    process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1 = "AA:BB:CC";
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_SERVICES_API_KEY;
    delete process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME;
    delete process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1;
  });

  test("uses 25 km DISTANCE requests at no more than five route points", async () => {
    fetch.mockResolvedValue(successResponse([]));

    await fetchRouteTextSearchPredictions({
      inputText: "Tim Hortons",
      searchPoints: Array.from({ length: 7 }, (_, index) => ({
        latitude: 43.7 + index * 0.02,
        longitude: -81.7 + index * 0.1,
      })),
      routeCoords,
      interactionToken: "session-request-shape",
      log: createLog(),
    });

    expect(fetch).toHaveBeenCalledTimes(5);
    const [url, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(body).toEqual({
      textQuery: "Tim Hortons",
      locationBias: {
        circle: {
          center: { latitude: 43.7, longitude: -81.7 },
          radius: 25000,
        },
      },
      rankPreference: "DISTANCE",
      regionCode: "CA",
      pageSize: 5,
    });
    expect(options.headers).toMatchObject({
      "X-Goog-Api-Key": FAKE_KEY,
      "X-Android-Package": "com.rob.wandernorth",
      "X-Android-Cert": "AABBCC",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType",
    });
  });

  test("keeps early, middle, and late results ordered by route progress", async () => {
    fetch
      .mockResolvedValueOnce(
        successResponse([place("wingham", "Tim Hortons", 43.887, -81.312)]),
      )
      .mockResolvedValueOnce(
        successResponse([place("middle", "Tim Hortons", 43.91, -81.1)]),
      )
      .mockResolvedValueOnce(
        successResponse([place("late", "Tim Hortons", 43.95, -80.91)]),
      );

    const predictions = await fetchRouteTextSearchPredictions({
      inputText: "Tim Hortons",
      searchPoints,
      routeCoords,
      interactionToken: "session-route-order",
      log: createLog(),
    });

    expect(predictions.map((prediction) => prediction.place_id)).toEqual([
      "wingham",
      "middle",
      "late",
    ]);
    expect(predictions[0]).toMatchObject({
      latitude: 43.887,
      longitude: -81.312,
      routeSearchPointIndex: 0,
      source: "text-search",
      routeProgress: expect.any(Number),
      closestRouteDistanceMeters: expect.any(Number),
    });
  });

  test("prefers a close name match when route progress and distance are equal", async () => {
    fetch.mockResolvedValue(
      successResponse([
        place("other", "Coffee House", 43.887, -81.312),
        place("matching", "Tim Hortons", 43.887, -81.312),
      ]),
    );

    const predictions = await fetchRouteTextSearchPredictions({
      inputText: "Tim Hortons",
      searchPoints: searchPoints.slice(0, 1),
      routeCoords,
      interactionToken: "session-name-match",
      log: createLog(),
    });

    expect(predictions.map((prediction) => prediction.place_id)).toEqual([
      "matching",
      "other",
    ]);
  });

  test("one failed point logs status safely without removing successful points", async () => {
    const log = createLog();
    fetch
      .mockResolvedValueOnce(
        failureResponse(403, {
          status: "PERMISSION_DENIED",
          message: `Denied ${FAKE_KEY}`,
        }),
      )
      .mockResolvedValueOnce(
        successResponse([place("middle", "Tim Hortons", 43.91, -81.1)]),
      );

    const predictions = await fetchRouteTextSearchPredictions({
      inputText: "Tim Hortons",
      searchPoints: searchPoints.slice(0, 2),
      routeCoords,
      interactionToken: "session-partial-failure",
      log,
    });

    expect(predictions.map((prediction) => prediction.place_id)).toEqual([
      "middle",
    ]);
    expect(log.warn).toHaveBeenCalledWith(
      "[AutocompleteInput] Custom route Text Search failed.",
      expect.objectContaining({
        httpStatus: 403,
        googleErrorStatus: "PERMISSION_DENIED",
        routeSearchPointIndex: 0,
        sampleLatitude: searchPoints[0].latitude,
        sampleLongitude: searchPoints[0].longitude,
      }),
    );
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain(FAKE_KEY);
    expect(log.log).toHaveBeenCalledWith(
      "[AutocompleteInput] Custom route Text Search summary.",
      expect.objectContaining({
        requestedPointCount: 2,
        successfulRequestCount: 1,
        failedRequestCount: 1,
        returnedPlaceCount: 1,
      }),
    );
  });

  test("all failed points produce the explicit ordinary-autocomplete warning", async () => {
    const log = createLog();
    fetch.mockResolvedValue(
      failureResponse(403, {
        status: "PERMISSION_DENIED",
        message: "Text Search is blocked",
      }),
    );

    await expect(
      fetchRouteTextSearchPredictions({
        inputText: "Tim Hortons",
        searchPoints: searchPoints.slice(0, 2),
        routeCoords,
        interactionToken: "session-all-failed",
        log,
      }),
    ).resolves.toEqual([]);

    expect(log.warn).toHaveBeenCalledWith(
      "[AutocompleteInput] All custom route Text Search requests failed; using ordinary autocomplete fallback.",
    );
  });

  test("deduplicates places, keeps route results first, and caches unchanged searches", async () => {
    const log = createLog();
    fetch
      .mockResolvedValueOnce(
        successResponse([place("duplicate", "Tim Hortons", 43.887, -81.312)]),
      )
      .mockResolvedValueOnce(
        successResponse([place("duplicate", "Tim Hortons", 43.887, -81.312)]),
      );
    const args = {
      inputText: "Tim Hortons",
      searchPoints: searchPoints.slice(0, 2),
      routeCoords,
      interactionToken: "session-cache",
      log,
    };
    const first = await fetchRouteTextSearchPredictions(args);
    const second = await fetchRouteTextSearchPredictions(args);

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      mergeRouteAndAutocompletePredictions(first, [
        { place_id: "duplicate", source: "autocomplete-new" },
        { place_id: "fallback", source: "autocomplete-new" },
      ]).map((prediction) => prediction.source),
    ).toEqual(["text-search", "autocomplete-new"]);
  });
});
