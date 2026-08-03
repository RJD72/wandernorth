import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import SelectedStopsList from "../app/components/SelectedStopsList";
import {
  buildGoogleMapsDirectionsUrl,
  prepareStopsForRouteHandoff,
} from "../app/utils/routeHandoff";

describe("SelectedStopsList route order", () => {
  test("display numbering matches Google Maps waypoint order and removal keeps the stable stop", async () => {
    const routeCoords = [
      { latitude: 43, longitude: -81 },
      { latitude: 43, longitude: -80.5 },
      { latitude: 43, longitude: -80 },
    ];
    const selectedStops = [
      { id: "C", name: "Stop C", latitude: 43, longitude: -80.1 },
      { id: "A", name: "Stop A", latitude: 43, longitude: -80.9 },
      { id: "B", name: "Stop B", latitude: 43, longitude: -80.5 },
    ];
    const { orderedStops } = prepareStopsForRouteHandoff(
      selectedStops,
      routeCoords,
    );
    const onRemoveStop = jest.fn();
    let renderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <SelectedStopsList
          selectedStops={orderedStops}
          onRemoveStop={onRemoveStop}
          onRemoveAllStops={jest.fn()}
        />,
      );
    });

    const renderedText = renderer.root
      .findAllByType("Text")
      .map((node) => node.props.children)
      .flat(Infinity)
      .join(" ");
    expect(renderedText.indexOf("Stop A")).toBeLessThan(
      renderedText.indexOf("Stop B"),
    );
    expect(renderedText.indexOf("Stop B")).toBeLessThan(
      renderedText.indexOf("Stop C"),
    );

    const url = decodeURIComponent(
      buildGoogleMapsDirectionsUrl({
        origin: routeCoords[0],
        destination: routeCoords[2],
        orderedStops,
        travelMode: "driving",
      }),
    );
    expect(url).toContain("waypoints=43,-80.9|43,-80.5|43,-80.1");

    const removeStopB = renderer.root.findByProps({
      accessibilityLabel: "Remove Stop B",
    });
    await act(async () => removeStopB.props.onPress());
    expect(onRemoveStop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "B" }),
    );

    await act(async () => renderer.unmount());
  });
});
