import { getSamplePointsAlongRoute } from "../app/utils/routeSampling";

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
