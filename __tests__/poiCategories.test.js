import {
  getAllPoiCategories,
  getCanonicalPoiCategoryId,
  getCanonicalPoiCategoryIds,
  getGoogleTypesForPoiCategoryIds,
  getPoiCategoryIdForGoogleType,
  getPoiCategoryIdForTomTomQuery,
  getPoiCategoryLabelById,
  getTomTomQueriesForPoiCategoryIds,
} from "../app/config/poiCategories";

describe("poiCategories", () => {
  test("every canonical category has a non-empty ID and label", () => {
    for (const category of getAllPoiCategories()) {
      expect(category.id.trim()).not.toBe("");
      expect(category.label.trim()).not.toBe("");
    }
  });

  test("canonical category IDs are unique", () => {
    const ids = getAllPoiCategories().map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each([
    ["restaurants", "restaurant"],
    ["coffee_shop", "coffee"],
    ["attraction", "tourist_attraction"],
    ["gas", "gas_station"],
    [" GAS STATION ", "gas_station"],
  ])("normalizes legacy alias %s", (input, expected) => {
    expect(getCanonicalPoiCategoryId(input)).toBe(expected);
  });

  test("unknown values and empty values follow existing fallbacks", () => {
    expect(getCanonicalPoiCategoryId("new_category")).toBe("new_category");
    expect(getCanonicalPoiCategoryId("")).toBe("other");
    expect(getPoiCategoryLabelById("new_category")).toBe("New Category");
  });

  test("empty and invalid selections return no provider mappings", () => {
    expect(getCanonicalPoiCategoryIds([])).toEqual([]);
    expect(getCanonicalPoiCategoryIds(null)).toEqual([]);
    expect(getGoogleTypesForPoiCategoryIds([])).toEqual([]);
    expect(getTomTomQueriesForPoiCategoryIds([])).toEqual([]);
  });

  test("provider mappings resolve only to canonical category IDs", () => {
    const validIds = new Set(getAllPoiCategories().map((category) => category.id));
    for (const category of getAllPoiCategories()) {
      for (const type of category.googleTypes || []) {
        expect(validIds.has(getPoiCategoryIdForGoogleType(type))).toBe(true);
      }
      for (const query of category.tomtomQueries || []) {
        expect(validIds.has(getPoiCategoryIdForTomTomQuery(query))).toBe(true);
      }
    }
  });

  test("selected canonical category order is preserved while duplicates collapse", () => {
    expect(
      getCanonicalPoiCategoryIds(["gas", "cafe", "restaurants", "gas_station"]),
    ).toEqual(["gas_station", "cafe", "restaurant"]);
  });

  test("provider mapping output follows selected category order", () => {
    const firstCafeType = getGoogleTypesForPoiCategoryIds(["cafe"])[0];
    const firstParkType = getGoogleTypesForPoiCategoryIds(["park"])[0];
    const combined = getGoogleTypesForPoiCategoryIds(["park", "cafe"]);

    expect(combined.indexOf(firstParkType)).toBeLessThan(
      combined.indexOf(firstCafeType),
    );
  });
});
