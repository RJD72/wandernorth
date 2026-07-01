import { useState } from "react";
import { Text, View } from "react-native";

import AutocompleteInput from "./AutoCompleteInput";
import WNButton from "./WNButton";

function isValidCoords(coords) {
  return (
    coords &&
    typeof coords.latitude === "number" &&
    typeof coords.longitude === "number" &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude)
  );
}

export default function AddCustomStopCard({ onAddStop = () => {} }) {
  const [customStopAddress, setCustomStopAddress] = useState("");
  const [customStopCoords, setCustomStopCoords] = useState(null);
  const [error, setError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  function handleAddCustomStop() {
    if (!customStopAddress.trim()) {
      setError("Search for a custom stop first.");
      return;
    }

    if (!isValidCoords(customStopCoords)) {
      setError("Select a stop from the search results before adding it.");
      return;
    }

    const trimmedAddress = customStopAddress.trim();

    onAddStop({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: trimmedAddress,
      category: "Custom Stop",
      address: trimmedAddress,
      latitude: customStopCoords.latitude,
      longitude: customStopCoords.longitude,
      source: "custom",
    });

    setCustomStopAddress("");
    setCustomStopCoords(null);
    setError(null);
  }

  return (
    <View
      style={{ zIndex: 1000, elevation: 1000, position: "relative" }}
      className="my-4 rounded-2xl bg-white p-4 shadow-sm"
    >
      <Text className="text-xl font-bold text-wn-forest">Add Custom Stop</Text>

      <Text className="mt-1 text-sm text-wn-text">
        Search for a place, address, town, or landmark and add it to your route.
      </Text>

      <View style={{ zIndex: 1001, elevation: 1001 }} className="">
        <AutocompleteInput
          label="Custom stop"
          value={customStopAddress}
          placeholder="Search a stop to add"
          onDropdownVisibleChange={setDropdownOpen}
          onChangeText={(text) => {
            setCustomStopAddress(text);
            setCustomStopCoords(null);
            setError(null);
          }}
          onSelectLocation={(address, coords) => {
            setCustomStopAddress(address);
            setCustomStopCoords(coords);
            setError(null);
          }}
        />
      </View>

      {dropdownOpen && <View style={{ height: 250 }} />}

      {error && <Text className="mt-2 text-sm text-red-600">{error}</Text>}

      <View className="mt-2">
        <WNButton
          label="Add Custom Stop"
          onPress={handleAddCustomStop}
          variant="secondary"
        />
      </View>
    </View>
  );
}
