import {
  getStopAddress,
  getStopCoords,
  getStopId,
  getStopTitle,
} from "../app/utils/stopUtils";

describe("stopUtils", () => {
  test.each([
    [{ id: "provider-id" }, "provider-id"],
    [{ googlePlaceId: "google-id" }, "google-id"],
    [{ placeId: "place-id" }, "place-id"],
    [{ place_id: "legacy-id" }, "legacy-id"],
    [{ id: "custom-123", source: "custom" }, "custom-123"],
    [{ properties: { googlePlaceId: "nested-id" } }, "nested-id"],
  ])("extracts a stable ID from supported shape %#", (stop, expected) => {
    expect(getStopId(stop)).toBe(expected);
  });

  test("returns undefined when no ID fallback exists", () => {
    expect(getStopId(null)).toBeUndefined();
    expect(getStopId({})).toBeUndefined();
  });

  test.each([
    [
      { latitude: 43, longitude: -81 },
      { latitude: 43, longitude: -81 },
    ],
    [{ lat: 43, lng: -81 }, { latitude: 43, longitude: -81 }],
    [
      { location: { latitude: 43, longitude: -81 } },
      { latitude: 43, longitude: -81 },
    ],
    [
      { geometry: { location: { lat: 43, lng: -81 } } },
      { latitude: 43, longitude: -81 },
    ],
  ])("extracts coordinates from supported shape %#", (stop, expected) => {
    expect(getStopCoords(stop)).toEqual(expected);
  });

  test("rejects missing, non-numeric, and non-finite coordinates", () => {
    expect(getStopCoords({})).toBeNull();
    expect(getStopCoords({ latitude: "43", longitude: -81 })).toBeNull();
    expect(getStopCoords({ latitude: Infinity, longitude: -81 })).toBeNull();
  });

  test("equivalent ID fields produce matching values", () => {
    expect(getStopId({ id: "same" })).toBe(getStopId({ placeId: "same" }));
  });

  test("title and address normalize common provider shapes", () => {
    expect(getStopTitle({ displayName: { text: "Museum" } })).toBe("Museum");
    expect(getStopAddress({ formattedAddress: "1 Main Street" })).toBe(
      "1 Main Street",
    );
  });
});
