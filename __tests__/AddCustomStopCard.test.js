import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import AddCustomStopCard from "../app/components/AddCustomStopCard";

jest.mock("../app/components/AutoCompleteInput", () => "AutocompleteInput");

jest.mock("../app/components/WNButton", () => "WNButton");

describe("AddCustomStopCard route-aware selection", () => {
  test("passes search points, shows distance, attaches progress, and resets", async () => {
    const onAddStop = jest.fn();
    const routeCoords = [
      { latitude: 43, longitude: -81 },
      { latitude: 43, longitude: -80.99 },
      { latitude: 43, longitude: -80.98 },
    ];
    const customSearchPoints = [routeCoords[0], routeCoords[2]];
    const locationBias = {
      latitude: 43,
      longitude: -80.99,
      radiusMeters: 50000,
    };
    let renderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <AddCustomStopCard
          onAddStop={onAddStop}
          locationBias={locationBias}
          customSearchPoints={customSearchPoints}
          routeCoords={routeCoords}
        />,
      );
    });

    let autocomplete = renderer.root.findByType("AutocompleteInput");
    expect(autocomplete.props.customSearchPoints).toBe(customSearchPoints);
    expect(autocomplete.props.routeCoords).toBe(routeCoords);
    expect(autocomplete.props.locationBias).toBe(locationBias);
    expect(autocomplete.props.strictBounds).toBe(false);

    await act(async () => {
      autocomplete.props.onSelectLocation(
        "Test Park, Ontario",
        { latitude: 43.001, longitude: -80.99 },
        { name: "Test Park", placeId: "place-one" },
      );
    });

    expect(JSON.stringify(renderer.toJSON())).toContain("off route");

    await act(async () => {
      renderer.root.findByType("WNButton").props.onPress();
    });

    expect(onAddStop).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test Park",
        address: "Test Park, Ontario",
        latitude: 43.001,
        longitude: -80.99,
        closestRouteDistanceMeters: expect.any(Number),
        closestRouteIndex: expect.any(Number),
        routeProgress: expect.any(Number),
        routeProgressPercent: expect.any(Number),
      }),
    );

    autocomplete = renderer.root.findByType("AutocompleteInput");
    expect(autocomplete.props.value).toBe("");
    expect(JSON.stringify(renderer.toJSON())).not.toContain("off route");

    await act(async () => renderer.unmount());
  });
});
