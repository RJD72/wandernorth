import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import SuggestedStopsList, {
  getDisplayedStopDescription,
} from "../app/components/SuggestedStopsList";
import { fetchGooglePlaceDetailsForStop } from "../app/services/googlePlaces";

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));

jest.mock("../app/services/googlePlaces", () => ({
  fetchGooglePlaceDetailsForStop: jest.fn(),
}));

const baseStop = {
  id: "stop-one",
  name: "Test Stop",
  address: "1 Test Street",
  category: "park",
};

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("SuggestedStopsList details description", () => {
  beforeEach(() => {
    fetchGooglePlaceDetailsForStop.mockResolvedValue({
      title: "Test Stop",
      address: "1 Test Street",
      imageUrls: [],
      description: null,
      rating: 4.5,
      userRatingCount: 10,
      googleMapsUri: "https://maps.example/test-stop",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("shows the local placeholder in the Details modal when no description exists", async () => {
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <SuggestedStopsList suggestedStops={[baseStop]} selectedStops={[]} />,
      );
    });

    const stopCard = renderer.root.find(
      (node) =>
        typeof node.props.onPress === "function" &&
        node.props.className?.includes("border p-3"),
    );

    await act(async () => {
      await stopCard.props.onPress();
      await flushPromises();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain(
      "More information about this stop is coming soon.",
    );

    await act(async () => renderer.unmount());
  });

  test("prefers a genuine provider description over the placeholder", () => {
    expect(
      getDisplayedStopDescription(
        { description: null },
        { ...baseStop, description: "A genuine provider description." },
      ),
    ).toBe("A genuine provider description.");
  });
});
