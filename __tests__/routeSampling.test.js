import {
  getCustomStopSearchPoints,
  getRoutePointAtDistancePercentage,
  getSamplePointsAlongRoute,
} from "../app/utils/routeSampling";

describe("getSamplePointsAlongRoute", () => {
  test("returns an empty array for empty or invalid routes", () => {
    expect(getSamplePointsAlongRoute()).toEqual([]);
    expect(getSamplePointsAlongRoute([])).toEqual([]);
    expect(getSamplePointsAlongRoute([null, { latitude: "x" }])).toEqual([]);
  });

  test("returns the only valid coordinate in a one-point route", () => {
    const coordinate = { latitude: 43, longitude: -81 };
    expect(getSamplePointsAlongRoute([coordinate])).toEqual([coordinate]);
  });

  test("does not invent points for a route shorter than five samples", () => {
    const route = [
      { latitude: 43, longitude: -81 },
      { latitude: 43.01, longitude: -81 },
    ];
    const samples = getSamplePointsAlongRoute(route);

    expect(samples.length).toBeLessThanOrEqual(route.length);
    expect(samples.every((sample) => route.includes(sample))).toBe(true);
  });

  test("distributes samples along a normal route", () => {
    const route = Array.from({ length: 11 }, (_, index) => ({
      latitude: 43 + index * 0.01,
      longitude: -81,
    }));
    const samples = getSamplePointsAlongRoute(route);

    expect(samples).toHaveLength(5);
    expect(samples[0].latitude).toBeLessThan(samples[2].latitude);
    expect(samples[2].latitude).toBeLessThan(samples[4].latitude);
    expect(samples[0].latitude).toBeGreaterThan(route[0].latitude);
  });

  test("does not return duplicate sample coordinates", () => {
    const repeated = { latitude: 43, longitude: -81 };
    const samples = getSamplePointsAlongRoute([
      repeated,
      repeated,
      { latitude: 43.01, longitude: -81 },
    ]);
    const keys = samples.map((point) => `${point.latitude},${point.longitude}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  test("does not mutate the input array or coordinates", () => {
    const route = [
      { latitude: 43, longitude: -81 },
      { latitude: 43.01, longitude: -81 },
      { latitude: 43.02, longitude: -81 },
    ];
    const before = JSON.parse(JSON.stringify(route));

    getSamplePointsAlongRoute(route);
    expect(route).toEqual(before);
  });

  test("retains the expected coordinate shape", () => {
    const samples = getSamplePointsAlongRoute([
      { latitude: 43, longitude: -81 },
      { latitude: 43.01, longitude: -81 },
    ]);

    for (const sample of samples) {
      expect(Object.keys(sample).sort()).toEqual(["latitude", "longitude"]);
      expect(Number.isFinite(sample.latitude)).toBe(true);
      expect(Number.isFinite(sample.longitude)).toBe(true);
    }
  });
});

describe("custom-stop route search sampling", () => {
  test("selects start, quarter, midpoint, three-quarter, and destination", () => {
    const route = Array.from({ length: 9 }, (_, index) => ({
      latitude: 43,
      longitude: -81 + index * 0.1,
    }));
    const samples = getCustomStopSearchPoints(route);

    expect(samples).toHaveLength(5);
    expect(samples[0]).toEqual(route[0]);
    expect(samples[1].longitude).toBeCloseTo(-80.8, 4);
    expect(samples[2].longitude).toBeCloseTo(-80.6, 4);
    expect(samples[3].longitude).toBeCloseTo(-80.4, 4);
    expect(samples[4]).toEqual(route[route.length - 1]);
  });

  test("uses travelled distance instead of polyline array indexes", () => {
    const route = [
      { latitude: 43, longitude: -81 },
      { latitude: 43, longitude: -80.99 },
      { latitude: 43, longitude: -80.98 },
      { latitude: 43, longitude: -80.5 },
      { latitude: 43, longitude: -80 },
    ];
    const midpoint = getRoutePointAtDistancePercentage(route, 0.5);

    expect(midpoint.longitude).toBeCloseTo(-80.5, 2);
    expect(midpoint.longitude).not.toBeCloseTo(route[2].longitude, 2);
  });

  test("handles missing, invalid, one-point, and degenerate routes", () => {
    const onlyPoint = { latitude: 43, longitude: -81 };

    expect(getCustomStopSearchPoints()).toEqual([]);
    expect(getCustomStopSearchPoints([null, { latitude: "x" }])).toEqual([]);
    expect(getCustomStopSearchPoints([onlyPoint])).toEqual([onlyPoint]);
    expect(getCustomStopSearchPoints([onlyPoint, onlyPoint])).toEqual([
      onlyPoint,
    ]);
  });
});
