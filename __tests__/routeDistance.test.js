import {
  attachRoutePositionToPois,
  getClosestRoutePointInfo,
  getDistanceMeters,
} from "../app/utils/routeDistance";

const route = [
  { latitude: 43, longitude: -81 },
  { latitude: 43, longitude: -80.99 },
  { latitude: 43, longitude: -80.98 },
];

describe("routeDistance", () => {
  test("the same coordinate produces approximately zero distance", () => {
    expect(getDistanceMeters(route[0], route[0])).toBeCloseTo(0, 6);
  });

  test("a known short latitude change has a reasonable distance", () => {
    const distance = getDistanceMeters(
      { latitude: 43, longitude: -81 },
      { latitude: 43.001, longitude: -81 },
    );
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(125);
  });

  test("invalid or missing coordinates follow the Infinity contract", () => {
    expect(getDistanceMeters(null, route[0])).toBe(Infinity);
    expect(getDistanceMeters(route[0], null)).toBe(Infinity);
  });

  test("selects the nearest route segment index", () => {
    const info = getClosestRoutePointInfo(
      { latitude: 43.0001, longitude: -80.989 },
      route,
    );
    expect(info.closestIndex).toBe(1);
  });

  test("route progress is near the beginning and end", () => {
    const beginning = getClosestRoutePointInfo(
      { latitude: 43, longitude: -80.9999 },
      route,
    );
    const end = getClosestRoutePointInfo(
      { latitude: 43, longitude: -80.9801 },
      route,
    );

    expect(beginning.routeProgress).toBeLessThan(0.05);
    expect(end.routeProgress).toBeGreaterThan(0.95);
  });

  test("returns null when route information cannot be computed", () => {
    expect(getClosestRoutePointInfo(null, route)).toBeNull();
    expect(getClosestRoutePointInfo(route[0], [])).toBeNull();
  });

  test("attaches index, progress, and distance metadata", () => {
    const [poi] = attachRoutePositionToPois(
      [{ id: "one", latitude: 43.0001, longitude: -80.99 }],
      route,
    );

    expect(poi).toEqual(
      expect.objectContaining({
        id: "one",
        closestRouteIndex: expect.any(Number),
        routeProgress: expect.any(Number),
        routeProgressPercent: expect.any(Number),
        closestRouteDistanceMeters: expect.any(Number),
      }),
    );
  });

  test("does not mutate POI or route inputs", () => {
    const pois = [{ id: "one", latitude: 43.0001, longitude: -80.99 }];
    const poisBefore = JSON.parse(JSON.stringify(pois));
    const routeBefore = JSON.parse(JSON.stringify(route));

    const output = attachRoutePositionToPois(pois, route);

    expect(pois).toEqual(poisBefore);
    expect(route).toEqual(routeBefore);
    expect(output[0]).not.toBe(pois[0]);
  });
});
