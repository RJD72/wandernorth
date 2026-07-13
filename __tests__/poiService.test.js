function createProvider({
  id = "google",
  types = ["cafe"],
  prioritizedTypes = types,
  radius = 3500,
  implementation = async () => [],
} = {}) {
  return {
    id,
    normalizeSelectedPoiTypes: jest.fn((value) => value),
    getProviderPoiTypes: jest.fn(() => [...types]),
    prioritizeProviderPoiTypesForSearch: jest.fn(() => [
      ...prioritizedTypes,
    ]),
    getSearchRadiusForType: jest.fn(() => radius),
    fetchPoisForRoutePointAndType: jest.fn(implementation),
  };
}

function loadSubject(providers) {
  jest.resetModules();
  jest.doMock("../app/services/poiProviders", () => ({
    activePoiProviders: providers,
    primaryPoiProvider: providers[0],
  }));
  jest.doMock("../app/utils/logger", () => ({
    logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
  }));
  return {
    subject: require("../app/services/poiService"),
    logger: require("../app/utils/logger").logger,
  };
}

const routePoints = Array.from({ length: 10 }, (_, index) => ({
  latitude: 43 + index / 100,
  longitude: -81 - index / 100,
}));

describe("poiService orchestration", () => {
  test("returns early for no route points or zero stops", async () => {
    const provider = createProvider();
    const { subject } = loadSubject([provider]);

    await expect(
      subject.fetchPoisNearRoutePoints({ routePoints: [] }),
    ).resolves.toEqual([]);
    await expect(
      subject.fetchPoisNearRoutePoints({ routePoints, numStops: 0 }),
    ).resolves.toEqual([]);
    expect(provider.fetchPoisForRoutePointAndType).not.toHaveBeenCalled();
  });

  test("samples at most five evenly distributed route points", async () => {
    const provider = createProvider();
    const { subject } = loadSubject([provider]);

    await subject.fetchPoisNearRoutePoints({ routePoints, numStops: 3 });

    expect(provider.fetchPoisForRoutePointAndType).toHaveBeenCalledTimes(5);
    expect(
      provider.fetchPoisForRoutePointAndType.mock.calls.map(
        ([request]) => request.point,
      ),
    ).toEqual([
      routePoints[0],
      routePoints[2],
      routePoints[5],
      routePoints[7],
      routePoints[9],
    ]);
  });

  test("uses provider normalization and priority while capping types and request values", async () => {
    const provider = createProvider({
      types: ["first", "second", "third"],
      prioritizedTypes: ["third", "first", "second"],
      radius: 6000,
    });
    const { subject } = loadSubject([provider]);
    const selectedPoiTypes = ["restaurants"];

    await subject.fetchPoisNearRoutePoints({
      routePoints: routePoints.slice(0, 2),
      selectedPoiTypes,
      numStops: 2,
    });

    expect(provider.getProviderPoiTypes).toHaveBeenCalledWith(selectedPoiTypes);
    expect(provider.prioritizeProviderPoiTypesForSearch).toHaveBeenCalledWith(
      ["first", "second", "third"],
      selectedPoiTypes,
    );
    expect(provider.fetchPoisForRoutePointAndType).toHaveBeenCalledTimes(4);
    expect(
      provider.fetchPoisForRoutePointAndType.mock.calls.map(
        ([request]) => request.providerType,
      ),
    ).toEqual(["third", "first", "third", "first"]);
    expect(provider.fetchPoisForRoutePointAndType).toHaveBeenCalledWith({
      point: routePoints[0],
      providerType: "third",
      radiusMeters: 6000,
      maxResultCount: 5,
    });
  });

  test("flattens fulfilled batches and tolerates exactly half of requests failing", async () => {
    const keptPoi = {
      id: "google:kept",
      provider: "google",
      providerPlaceId: "kept",
      name: "Kept",
      latitude: 43,
      longitude: -81,
    };
    const provider = createProvider({
      implementation: jest
        .fn()
        .mockRejectedValueOnce(new Error("one failed"))
        .mockResolvedValueOnce([keptPoi]),
    });
    const { subject } = loadSubject([provider]);

    await expect(
      subject.fetchPoisNearRoutePoints({
        routePoints: routePoints.slice(0, 2),
        numStops: 1,
      }),
    ).resolves.toEqual([keptPoi]);
  });

  test("rejects when most or all provider requests fail", async () => {
    const mostlyFailing = createProvider({
      implementation: jest
        .fn()
        .mockRejectedValueOnce(new Error("one"))
        .mockRejectedValueOnce(new Error("two"))
        .mockResolvedValueOnce([]),
    });
    let loaded = loadSubject([mostlyFailing]);
    await expect(
      loaded.subject.fetchPoisNearRoutePoints({
        routePoints: routePoints.slice(0, 3),
        numStops: 1,
      }),
    ).rejects.toThrow("Most POI provider requests failed");

    const allFailing = createProvider({
      implementation: async () => {
        throw new Error("failed");
      },
    });
    loaded = loadSubject([allFailing]);
    await expect(
      loaded.subject.fetchPoisNearRoutePoints({
        routePoints: routePoints.slice(0, 2),
        numStops: 1,
      }),
    ).rejects.toThrow("All POI provider requests failed");
  });

  test("deduplicates stable ids within a provider while keeping the first result", async () => {
    const first = {
      id: "google:same",
      provider: "google",
      providerPlaceId: "same",
      name: "First",
      latitude: 43,
      longitude: -81,
    };
    const duplicate = { ...first, name: "Second" };
    const provider = createProvider({
      implementation: jest
        .fn()
        .mockResolvedValueOnce([first])
        .mockResolvedValueOnce([duplicate]),
    });
    const { subject } = loadSubject([provider]);

    await expect(
      subject.fetchPoisNearRoutePoints({
        routePoints: routePoints.slice(0, 2),
      }),
    ).resolves.toEqual([first]);
  });

  test("deduplicates likely cross-provider matches and prefers Google", async () => {
    const tomtomPoi = {
      id: "tomtom:t1",
      provider: "tomtom",
      providerPlaceId: "t1",
      name: "North Shore Cafe",
      latitude: 43,
      longitude: -81,
    };
    const googlePoi = {
      id: "google:g1",
      provider: "google",
      providerPlaceId: "g1",
      name: "North Shore Café",
      latitude: 43.0001,
      longitude: -81.0001,
    };
    const tomtom = createProvider({
      id: "tomtom",
      implementation: async () => [tomtomPoi],
    });
    const google = createProvider({
      id: "google",
      implementation: async () => [googlePoi],
    });
    const { subject } = loadSubject([tomtom, google]);

    await expect(
      subject.fetchPoisNearRoutePoints({ routePoints: routePoints.slice(0, 1) }),
    ).resolves.toEqual([googlePoi]);
  });

  test("keeps similar names far apart and unrelated names close together", async () => {
    const pois = [
      {
        id: "tomtom:far",
        provider: "tomtom",
        providerPlaceId: "far",
        name: "Trail Cafe",
        latitude: 43,
        longitude: -81,
      },
      {
        id: "google:far",
        provider: "google",
        providerPlaceId: "far",
        name: "Trail Cafe",
        latitude: 44,
        longitude: -82,
      },
      {
        id: "google:near",
        provider: "google",
        providerPlaceId: "near",
        name: "Museum",
        latitude: 43.0001,
        longitude: -81.0001,
      },
    ];
    const provider = createProvider({ implementation: async () => pois });
    const { subject } = loadSubject([provider]);

    await expect(
      subject.fetchPoisNearRoutePoints({ routePoints: routePoints.slice(0, 1) }),
    ).resolves.toEqual(pois);
  });

  test("reports provider counts and does not mutate caller inputs", async () => {
    const selectedPoiTypes = ["cafes"];
    const originalPoints = routePoints.slice(0, 2).map((point) => ({ ...point }));
    const inputPoints = originalPoints.map((point) => ({ ...point }));
    const google = createProvider({
      id: "google",
      implementation: async () => [
        {
          id: "google:one",
          provider: "google",
          providerPlaceId: "one",
          name: "One",
          latitude: 43,
          longitude: -81,
        },
      ],
    });
    const tomtom = createProvider({
      id: "tomtom",
      implementation: async () => [
        {
          id: "tomtom:two",
          provider: "tomtom",
          providerPlaceId: "two",
          name: "Two",
          latitude: 44,
          longitude: -82,
        },
      ],
    });
    const { subject, logger } = loadSubject([google, tomtom]);

    await subject.fetchPoisNearRoutePoints({
      routePoints: inputPoints,
      selectedPoiTypes,
    });

    expect(inputPoints).toEqual(originalPoints);
    expect(selectedPoiTypes).toEqual(["cafes"]);
    expect(logger.log).toHaveBeenCalledWith(
      "[poiService] Provider result counts:",
      expect.objectContaining({ google: 2, tomtom: 2 }),
    );
  });
});
