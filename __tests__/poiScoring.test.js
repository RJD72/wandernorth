import { chooseDistributedStops, scorePoi } from "../app/utils/poiScoring";

function poi(id, progress, overrides = {}) {
  return {
    id,
    name: `Place ${id}`,
    category: "cafe",
    routeProgress: progress,
    closestRouteDistanceMeters: 100,
    rating: 4.2,
    userRatingCount: 50,
    ...overrides,
  };
}

describe("POI scoring and distribution", () => {
  test("returns no stops for empty candidates or a zero limit", () => {
    expect(chooseDistributedStops([], 3)).toEqual([]);
    expect(chooseDistributedStops([poi("a", 0.2)], 0)).toEqual([]);
  });

  test("invalid stop counts use the existing fallback of three", () => {
    const candidates = [poi("a", 0), poi("b", 0.5), poi("c", 1), poi("d", 0.8)];
    expect(chooseDistributedStops(candidates, "invalid")).toHaveLength(3);
  });

  test("returns fewer candidates than requested without duplication", () => {
    expect(chooseDistributedStops([poi("a", 0), poi("b", 1)], 4)).toHaveLength(2);
  });

  test("returns the exact requested count when enough candidates exist", () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      poi(String(index), index / 7),
    );
    expect(chooseDistributedStops(candidates, 4)).toHaveLength(4);
  });

  test("excludes candidates beyond the route-distance limit", () => {
    const result = chooseDistributedStops(
      [poi("near", 0.2), poi("far", 0.8, { closestRouteDistanceMeters: 3001 })],
      2,
      { maxDistanceFromRouteMeters: 3000 },
    );
    expect(result.map((item) => item.id)).toEqual(["near"]);
  });

  test("favours a higher-quality POI when route factors are similar", () => {
    const low = poi("low", 0.5, { rating: 2, userRatingCount: 2 });
    const high = poi("high", 0.5, { rating: 4.9, userRatingCount: 500 });
    expect(chooseDistributedStops([low, high], 1)[0].id).toBe("high");
    expect(scorePoi(high)).toBeGreaterThan(scorePoi(low));
  });

  test("distributes selected stops across route progress", () => {
    const candidates = [
      poi("early", 0.05),
      poi("early-2", 0.1),
      poi("middle", 0.5),
      poi("late", 0.95),
    ];
    const result = chooseDistributedStops(candidates, 3);
    const progress = result.map((item) => item.normalizedRouteProgress);

    expect(progress[0]).toBeLessThan(0.2);
    expect(progress.some((value) => value >= 0.4 && value <= 0.6)).toBe(true);
    expect(progress.at(-1)).toBeGreaterThan(0.8);
  });

  test("preferred category order controls the first category selected", () => {
    const candidates = [
      poi("cafe", 0.2, { category: "cafe", rating: 5 }),
      poi("museum", 0.8, { category: "museum", rating: 3 }),
    ];
    const result = chooseDistributedStops(candidates, 1, {
      preferredCategories: ["museum", "cafe"],
    });
    expect(result[0].category).toBe("museum");
  });

  test("duplicate stable IDs cannot produce duplicate selected stops", () => {
    const candidates = [
      poi("duplicate", 0.1),
      poi("duplicate", 0.9, { rating: 5 }),
      poi("unique", 0.5),
    ];
    const result = chooseDistributedStops(candidates, 3);
    expect(result.filter((item) => item.id === "duplicate")).toHaveLength(1);
  });

  test("missing rating and review count do not produce NaN", () => {
    const candidate = poi("unrated", 0.5, {
      rating: undefined,
      userRatingCount: undefined,
    });
    expect(Number.isNaN(scorePoi(candidate))).toBe(false);
    expect(Number.isFinite(scorePoi(candidate))).toBe(true);
  });

  test("does not mutate input candidates", () => {
    const candidates = [poi("a", 0), poi("b", 1)];
    const before = JSON.parse(JSON.stringify(candidates));
    chooseDistributedStops(candidates, 2);
    expect(candidates).toEqual(before);
  });

  test("deterministic input produces deterministic output", () => {
    const candidates = [poi("a", 0), poi("b", 0.4), poi("c", 0.7), poi("d", 1)];
    const first = chooseDistributedStops(candidates, 3);
    const second = chooseDistributedStops(candidates, 3);
    expect(second).toEqual(first);
  });
});
