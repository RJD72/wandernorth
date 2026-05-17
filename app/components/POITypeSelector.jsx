import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Static list of all supported Point of Interest types.
 *
 * id:
 * The value your app stores and passes into the route/POI logic.
 *
 * label:
 * The user-friendly label shown in the UI.
 *
 * icon:
 * The MaterialCommunityIcons icon name shown beside each option.
 */
const POI_TYPES = [
  { id: "restaurant", label: "Restaurant", icon: "silverware-fork-knife" },
  { id: "cafe", label: "Cafe", icon: "coffee" },
  { id: "bar", label: "Bar", icon: "glass-cocktail" },
  { id: "hotel", label: "Hotel", icon: "bed" },
  { id: "attraction", label: "Attraction", icon: "star" },
  { id: "park", label: "Park", icon: "tree" },
  { id: "museum", label: "Museum", icon: "bank" },
  { id: "tourist_attraction", label: "Tourist Attraction", icon: "map-marker" },
  { id: "gas_station", label: "Gas Station", icon: "gas-station" },
];

/**
 * POITypeSelector
 *
 * A controlled multi-select bottom-sheet component used to choose which
 * types of POIs the user wants along their route.
 *
 * This component does NOT own the selected POI state permanently.
 * The parent screen owns selectedPoiTypes and passes it in as a prop.
 *
 * Props:
 *   selectedPoiTypes {string[]}
 *     Array of currently selected POI type ids.
 *     Example: ["restaurant", "park", "scenic"]
 *
 *   onChange {(nextSelectedTypes: string[]) => void}
 *     Called whenever the selected POI list changes.
 *
 *   label {string}
 *     Optional label shown above the dropdown trigger.
 */
export default function POITypeSelector({
  selectedPoiTypes = [],
  onChange,
  label = "What do you want to see?",
}) {
  // Controls whether the selection bottom sheet is currently visible.
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Builds the short summary shown inside the closed dropdown field.
   *
   * Examples:
   *   No types selected         -> "Any type of stop"
   *   1 selected                -> "Restaurant"
   *   3 selected                -> "Restaurant, Park, Scenic"
   *   More than 3 selected      -> "Restaurant, Park, Scenic +2"
   */
  const selectedSummary = useMemo(() => {
    if (selectedPoiTypes.length === 0) {
      return "Any type of stop";
    }

    // Map selected ids to their labels using the POI_TYPES array.
    const selectedLabels = POI_TYPES.filter((poiType) =>
      selectedPoiTypes.includes(poiType.id),
    ).map((poiType) => poiType.label);

    const visibleLabels = selectedLabels.slice(0, 3);
    const hiddenCount = selectedLabels.length - visibleLabels.length;

    if (hiddenCount > 0) {
      return `${visibleLabels.join(", ")} +${hiddenCount}`;
    }

    return visibleLabels.join(", ");
  }, [selectedPoiTypes]);

  /**
   * Adds or removes a POI type from the selectedPoiTypes array.
   *
   * Important:
   * We do not mutate selectedPoiTypes directly.
   * We create a new array and pass it back to the parent through onChange.
   */
  function handleTogglePoiType(id) {
    // Check whether the tapped type is already in the active selection.
    const isAlreadySelected = selectedPoiTypes.includes(id);

    if (isAlreadySelected) {
      // Build a new array without the deselected id and notify the parent.
      const nextSelectedTypes = selectedPoiTypes.filter(
        (selectedId) => selectedId !== id,
      );

      onChange(nextSelectedTypes);
      return;
    }

    // Build a new array with the newly selected id appended and notify the parent.
    const nextSelectedTypes = [...selectedPoiTypes, id];

    onChange(nextSelectedTypes);
  }

  /**
   * Clears all selected POI types.
   * This means the route engine can treat the search as "any POI type".
   */
  function handleClearAll() {
    onChange([]);
  }

  return (
    <View className="w-full">
      {/* Field label */}
      <Text className="mb-2 text-sm font-semibold text-forest-900">
        {label}
      </Text>

      {/* Closed dropdown trigger — tapping opens the bottom-sheet modal */}
      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button" // Screen readers announce this as a button
        accessibilityState={{ expanded: isOpen }} // Communicates open/closed state to assistive tech
        className="flex-row items-center justify-between rounded-2xl border border-forest-200 bg-white px-4 py-4"
      >
        <View className="mr-3 flex-1">
          {/* Primary line: compact summary of selected types (computed by selectedSummary memo) */}
          <Text className="text-base font-medium text-forest-900">
            {selectedSummary}
          </Text>

          {/* Secondary line: contextual hint — either a generic prompt or a count badge */}
          <Text className="mt-1 text-xs text-stone-500">
            {selectedPoiTypes.length === 0
              ? "Search all available stop types"
              : `${selectedPoiTypes.length} selected`}
          </Text>
        </View>

        {/* Chevron indicates this is an expandable control */}
        <MaterialCommunityIcons name="chevron-down" size={22} color="#1D3B2A" />
      </Pressable>

      {/* Bottom-sheet modal — rendered as a transparent full-screen overlay */}
      <Modal
        visible={isOpen}
        transparent // Keeps the background content partially visible
        animationType="fade" // Smoothly fades the overlay in/out
        onRequestClose={() => setIsOpen(false)} // Handles Android hardware back-button press
      >
        {/* Full-screen pressable overlay — tapping outside the sheet dismisses it */}
        <Pressable
          onPress={() => setIsOpen(false)}
          className="flex-1 justify-end bg-black/40"
        >
          {/*
           * Bottom sheet container — the nested Pressable stops touch events from
           * bubbling up to the overlay, so tapping inside the sheet doesn't close it.
           * max-h-[80%] prevents the sheet from covering the entire screen on short lists.
           */}
          <Pressable className="max-h-[80%] rounded-t-3xl bg-white px-5 pb-8 pt-5">
            {/* Header */}
            <View className="mb-4 flex-row items-center justify-between">
              <View className="mr-4 flex-1">
                <Text className="text-lg font-bold text-forest-900">
                  Choose stop types
                </Text>

                <Text className="mt-1 text-sm text-stone-500">
                  Select one or more categories for your route.
                </Text>
              </View>

              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color="#1D3B2A"
                />
              </TouchableOpacity>
            </View>

            {/* Action row — shows live selection count and a conditional "Clear all" shortcut */}
            <View className="mb-4 flex-row items-center justify-between">
              {/* Live count label updates as the user toggles options */}
              <Text className="text-sm font-medium text-stone-600">
                {selectedPoiTypes.length === 0
                  ? "No filters selected"
                  : `${selectedPoiTypes.length} selected`}
              </Text>

              {/* "Clear all" is only rendered when at least one type is selected */}
              {selectedPoiTypes.length > 0 && (
                <Pressable onPress={handleClearAll}>
                  <Text className="text-sm font-semibold text-forest-800">
                    Clear all
                  </Text>
                </Pressable>
              )}
            </View>

            {/*
             * Scrollable options list — iterates over the static POI_TYPES array.
             * showsVerticalScrollIndicator is hidden to keep the UI clean;
             * the max-h on the parent sheet ensures the list remains scrollable.
             */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {POI_TYPES.map((poiType) => {
                // Determine whether this option is part of the active selection.
                const isSelected = selectedPoiTypes.includes(poiType.id);

                return (
                  <Pressable
                    key={poiType.id}
                    onPress={() => handleTogglePoiType(poiType.id)}
                    // Highlight the row with a forest tint when selected; neutral otherwise.
                    className={`mb-2 flex-row items-center justify-between rounded-2xl px-4 py-4 ${
                      isSelected ? "bg-forest-100" : "bg-stone-50"
                    }`}
                  >
                    <View className="flex-row items-center">
                      {/*
                       * Icon badge — filled dark when selected, white background when not.
                       * The icon colour inverts to maintain contrast in both states.
                       */}
                      <View
                        className={`mr-3 h-10 w-10 items-center justify-center rounded-full ${
                          isSelected ? "bg-forest-800" : "bg-white"
                        }`}
                      >
                        <MaterialCommunityIcons
                          name={poiType.icon}
                          size={20}
                          color={isSelected ? "white" : "#1D3B2A"}
                        />
                      </View>

                      {/* Option label — bold and forest-coloured when selected */}
                      <Text
                        className={`text-base ${
                          isSelected
                            ? "font-bold text-forest-900"
                            : "font-medium text-stone-700"
                        }`}
                      >
                        {poiType.label}
                      </Text>
                    </View>

                    {/*
                     * Right-hand selection indicator:
                     *   Selected   → filled check-circle in forest colour
                     *   Unselected → outline circle in muted stone colour
                     */}
                    {isSelected ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={22}
                        color="#1D3B2A"
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="checkbox-blank-circle-outline"
                        size={22}
                        color="#A8A29E"
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/*
             * Done button — closes the sheet and confirms the current selection.
             * No additional state update is needed here because onChange is called
             * immediately on each toggle, keeping the parent state always in sync.
             */}
            <Pressable
              onPress={() => setIsOpen(false)}
              className="mt-4 rounded-2xl bg-forest-800 px-4 py-4"
            >
              <Text className="text-center text-base font-bold text-white">
                Done
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
