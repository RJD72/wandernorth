import { createRouteRequestKey } from "../app/utils/requestKeys";

const baseRequest = {
  startingCoords: { latitude: 43.451639, longitude: -80.492533 },
  destinationCoords: { latitude: 44.231172, longitude: -76.486954 },
  travelMode: "driving",
  waypoints: [],
};

describe("route request cache keys", () => {
  test("include purpose and routing preference", () => {
    const preview = createRouteRequestKey({
      ...baseRequest,
      purpose: "preview",
      routingPreference: "basic",
    });
    const final = createRouteRequestKey({
      ...baseRequest,
      purpose: "final",
      routingPreference: "TRAFFIC_AWARE",
    });
    expect(preview).not.toBe(final);
  });

  test("preserve nearby but distinct coordinates at five decimals", () => {
    const first = createRouteRequestKey(baseRequest);
    const second = createRouteRequestKey({
      ...baseRequest,
      destinationCoords: {
        ...baseRequest.destinationCoords,
        latitude: baseRequest.destinationCoords.latitude + 0.00002,
      },
    });
    expect(first).not.toBe(second);
  });
});
