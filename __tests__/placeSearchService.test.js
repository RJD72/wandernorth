function loadSubject(demo) {
  jest.resetModules();
  jest.doMock("../app/config/demoMode", () => ({ isDemoModeEnabled: demo }));
  return require("../app/services/placeSearchService").searchPlacesLocally;
}

describe("placeSearchService contract", () => {
  test("real mode exposes no local results and performs no request", () => {
    expect(loadSubject(false)("museum")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("demo mode avoids requests and rejects short searches", () => {
    const searchPlacesLocally = loadSubject(true);
    expect(searchPlacesLocally("x")).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("demo mode returns deterministic local place matches", () => {
    const searchPlacesLocally = loadSubject(true);
    const first = searchPlacesLocally("Cowbell");
    const second = searchPlacesLocally("Cowbell");
    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      placeId: expect.any(String),
      name: expect.any(String),
      address: expect.any(String),
      coords: { latitude: expect.any(Number), longitude: expect.any(Number) },
    });
  });
});
