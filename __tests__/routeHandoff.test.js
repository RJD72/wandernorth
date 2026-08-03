import {
  buildGoogleMapsDirectionsUrl,
  MAX_GOOGLE_MAPS_WAYPOINTS,
  prepareStopsForRouteHandoff,
} from "../app/utils/routeHandoff";

const routeCoords = [
  { latitude: 43, longitude: -81 },
  { latitude: 43, longitude: -80.5 },
  { latitude: 43, longitude: -80 },
];

function stop(id, longitude, metadata = {}) {
  return { id, latitude: 43, longitude, ...metadata };
}

describe("prepareStopsForRouteHandoff", () => {
  test("turns C, A, B selection order into A, B, C route order", () => {
    const selectedStops = [
      stop("C", -80.1),
      stop("A", -80.9),
      stop("B", -80.5),
    ];

    const result = prepareStopsForRouteHandoff(selectedStops, routeCoords);

    expect(result.orderedStops.map((item) => item.id)).toEqual(["A", "B", "C"]);
    expect(selectedStops.map((item) => item.id)).toEqual(["C", "A", "B"]);
  });

  test("orders suggested stops by calculated travelled-route progress", () => {
    const result = prepareStopsForRouteHandoff(
      [
        stop("suggested-late", -80.15, { source: "google" }),
        stop("suggested-early", -80.85, { source: "tomtom" }),
      ],
      routeCoords,
    );

    expect(result.orderedStops.map((item) => item.id)).toEqual([
      "suggested-early",
      "suggested-late",
    ]);
    expect(
      result.orderedStops.every((item) => Number.isFinite(item.routeProgress)),
    ).toBe(true);
  });

  test("refreshes stale metadata from travelled-route progress", () => {
    const result = prepareStopsForRouteHandoff(
      [
        stop("late", -80.1, { routeProgress: 0.01, closestRouteIndex: 0 }),
        stop("early", -80.9, { routeProgress: 0.99, closestRouteIndex: 2 }),
      ],
      routeCoords,
    );

    expect(result.orderedStops.map((item) => item.id)).toEqual([
      "early",
      "late",
    ]);
    expect(result.orderedStops[0].routeProgress).toBeLessThan(
      result.orderedStops[1].routeProgress,
    );
  });

  test("orders an off-route custom stop by its closest route position", () => {
    const [custom, later] = prepareStopsForRouteHandoff(
      [
        stop("custom", -80.75, { latitude: 43.25, source: "custom" }),
        stop("later", -80.1),
      ],
      routeCoords,
    ).orderedStops;

    expect(custom.id).toBe("custom");
    expect(custom.routeProgress).toBeLessThan(later.routeProgress);
    expect(custom.closestRouteDistanceMeters).toBeGreaterThan(1000);
  });

  test("normalizes closestRouteIndex only when recalculation is unavailable", () => {
    const result = prepareStopsForRouteHandoff(
      [
        stop("unknown", -80.8),
        stop("index", -80.7, { closestRouteIndex: 2 }),
        stop("progress", -80.6, { routeProgress: 0.75 }),
      ],
      [{ malformed: true }, {}, {}, {}, {}],
    );

    expect(result.orderedStops.map((item) => item.id)).toEqual([
      "index",
      "progress",
      "unknown",
    ]);
    expect(result.orderedStops[0].routeProgress).toBe(0.5);
  });

  test("keeps equal and unknown progress stops in stable selection order", () => {
    const result = prepareStopsForRouteHandoff(
      [
        stop("equal-one", -80.8, { routeProgress: 0.4 }),
        stop("unknown-one", -80.7),
        stop("equal-two", -80.6, { routeProgress: 0.4 }),
        stop("unknown-two", -80.5),
      ],
      [],
    );

    expect(result.orderedStops.map((item) => item.id)).toEqual([
      "equal-one",
      "equal-two",
      "unknown-one",
      "unknown-two",
    ]);
  });

  test("returns coordinate-invalid stops separately", () => {
    const invalid = { id: "invalid", latitude: "43", longitude: -80.5 };
    const result = prepareStopsForRouteHandoff(
      [stop("valid", -80.5), invalid],
      routeCoords,
    );

    expect(result.orderedStops.map((item) => item.id)).toEqual(["valid"]);
    expect(result.invalidStops).toEqual([invalid]);
  });

  test("handles empty, one-point, malformed, and non-array inputs", () => {
    expect(prepareStopsForRouteHandoff()).toEqual({
      orderedStops: [],
      invalidStops: [],
    });
    expect(prepareStopsForRouteHandoff(null, routeCoords)).toEqual({
      orderedStops: [],
      invalidStops: [],
    });
    expect(
      prepareStopsForRouteHandoff([stop("one", -81)], [routeCoords[0]])
        .orderedStops[0],
    ).toMatchObject({ routeProgress: 0, routeProgressPercent: 0 });
  });
});

describe("Google Maps route handoff", () => {
  test("uses calculated A, B, C order in the waypoint URL without an API request", () => {
    const { orderedStops } = prepareStopsForRouteHandoff(
      [stop("C", -80.1), stop("A", -80.9), stop("B", -80.5)],
      routeCoords,
    );
    const url = buildGoogleMapsDirectionsUrl({
      origin: routeCoords[0],
      destination: routeCoords[2],
      orderedStops,
      travelMode: "driving",
    });

    expect(decodeURIComponent(url)).toContain(
      "waypoints=43,-80.9|43,-80.5|43,-80.1",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  test("accepts nine waypoints and rejects a tenth", () => {
    const nineStops = Array.from(
      { length: MAX_GOOGLE_MAPS_WAYPOINTS },
      (_, index) => stop(`stop-${index}`, -80.9 + index * 0.1),
    );
    const args = {
      origin: routeCoords[0],
      destination: routeCoords[2],
      orderedStops: nineStops,
      travelMode: "driving",
    };

    expect(buildGoogleMapsDirectionsUrl(args)).toContain("waypoints=");
    expect(() =>
      buildGoogleMapsDirectionsUrl({
        ...args,
        orderedStops: [...nineStops, stop("tenth", -80)],
      }),
    ).toThrow("up to 9");
  });

  test("rejects invalid endpoints and invalid selected stops", () => {
    expect(() =>
      buildGoogleMapsDirectionsUrl({
        origin: null,
        destination: routeCoords[2],
        orderedStops: [],
      }),
    ).toThrow("start or destination");
    expect(() =>
      buildGoogleMapsDirectionsUrl({
        origin: routeCoords[0],
        destination: routeCoords[2],
        orderedStops: [{ id: "invalid" }],
      }),
    ).toThrow("missing valid coordinates");
  });
});
