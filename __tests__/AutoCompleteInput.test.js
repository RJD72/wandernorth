import React from "react";
import { TextInput } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import AutocompleteInput from "../app/components/AutoCompleteInput";

function autocompleteResponse(placeId, description) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({
      suggestions: [
        {
          placePrediction: {
            placeId,
            text: { text: description },
            structuredFormat: {
              mainText: { text: "Kitchener City Hall" },
              secondaryText: { text: "Kitchener, ON, Canada" },
            },
          },
        },
      ],
    }),
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("AutocompleteInput session lifecycle", () => {
  const originalApiKey = process.env.EXPO_PUBLIC_GOOGLE_WEB_SERVICES_API_KEY;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.EXPO_PUBLIC_GOOGLE_WEB_SERVICES_API_KEY = "test-key";
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalApiKey === undefined) {
      delete process.env.EXPO_PUBLIC_GOOGLE_WEB_SERVICES_API_KEY;
    } else {
      process.env.EXPO_PUBLIC_GOOGLE_WEB_SERVICES_API_KEY = originalApiKey;
    }
  });

  test("reuses one token through selection and creates a new token next time", async () => {
    jest
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.25)
      .mockReturnValueOnce(0.5);
    const onChangeText = jest.fn();
    const onSelectLocation = jest.fn();

    fetch
      .mockResolvedValueOnce(
        autocompleteResponse(
          "place-one",
          "Kitchener City Hall, Kitchener, ON, Canada",
        ),
      )
      .mockResolvedValueOnce(
        autocompleteResponse(
          "place-one",
          "Kitchener City Hall, Kitchener, ON, Canada",
        ),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          id: "place-one",
          displayName: { text: "Kitchener City Hall" },
          formattedAddress: "200 King St W, Kitchener, ON, Canada",
          location: { latitude: 43.4517, longitude: -80.4923 },
        }),
      })
      .mockResolvedValueOnce(
        autocompleteResponse(
          "place-two",
          "Kitchener Memorial Auditorium, Kitchener, ON, Canada",
        ),
      );

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <AutocompleteInput
          value=""
          onChangeText={onChangeText}
          onSelectLocation={onSelectLocation}
          placeholder="Search"
        />,
      );
    });

    let input = renderer.root.findByType(TextInput);

    await act(async () => {
      input.props.onFocus();
      input.props.onChangeText("Kit");
    });
    await act(async () => {
      jest.advanceTimersByTime(400);
      await flushPromises();
    });

    const firstToken = JSON.parse(fetch.mock.calls[0][1].body).sessionToken;

    await act(async () => {
      input.props.onChangeText("Kitch");
    });
    await act(async () => {
      jest.advanceTimersByTime(400);
      await flushPromises();
    });

    const secondToken = JSON.parse(fetch.mock.calls[1][1].body).sessionToken;
    expect(secondToken).toBe(firstToken);

    const suggestion = renderer.root.find(
      (node) =>
        typeof node.props.onPress === "function" &&
        node.props.className?.includes("border-b"),
    );
    await act(async () => {
      await suggestion.props.onPress();
    });

    expect(fetch.mock.calls[2][0]).toContain(
      `sessionToken=${encodeURIComponent(firstToken)}`,
    );
    expect(onSelectLocation).toHaveBeenCalledWith(
      "200 King St W, Kitchener, ON, Canada",
      { latitude: 43.4517, longitude: -80.4923 },
      expect.objectContaining({
        name: "Kitchener City Hall",
        placeId: "place-one",
      }),
    );

    input = renderer.root.findByType(TextInput);
    await act(async () => {
      input.props.onFocus();
      input.props.onChangeText("Aud");
    });
    await act(async () => {
      jest.advanceTimersByTime(400);
      await flushPromises();
    });

    const nextToken = JSON.parse(fetch.mock.calls[3][1].body).sessionToken;
    expect(nextToken).not.toBe(firstToken);

    await act(async () => {
      renderer.unmount();
    });
  });
});
