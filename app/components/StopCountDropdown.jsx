import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// The range of stop counts available for selection (0 = no extra stops, up to 10).
const stopOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * StopCountDropdown
 *
 * A custom dropdown component that lets the user select how many stops to
 * include on a route. Tapping the trigger button opens a bottom-sheet modal
 * with a scrollable list of options (0–10). The currently selected option is
 * highlighted and marked with a checkmark icon.
 *
 * Props:
 *   value    {number}   – The currently selected stop count (controlled).
 *   onChange {function} – Callback invoked with the new count when the user
 *                         makes a selection.
 *   label    {string}   – Optional label displayed above the trigger button.
 *                         Defaults to "Number of stops".
 */
export default function StopCountDropdown({
  value,
  onChange,
  label = "Number of stops",
}) {
  // Controls whether the selection modal is visible.
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Called when the user taps a stop option inside the modal.
   * Notifies the parent of the new value and closes the modal.
   */
  function handleSelectStop(count) {
    onChange(count);
    setIsOpen(false);
  }

  return (
    <View className="w-full">
      {/* Field label rendered above the trigger button */}
      <Text className="mb-2 text-sm font-semibold text-white">
        {label}
      </Text>

      {/* Trigger button — displays the current selection and opens the modal on press */}
      <Pressable
        onPress={() => setIsOpen(true)}
        className="flex-row items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-4"
      >
        {/* Display "No extra stops" for 0, otherwise "N stop(s)" */}
        <Text className="text-base font-medium text-emerald-950">
          {value === 0
            ? "No extra stops"
            : `${value} stop${value > 1 ? "s" : ""}`}
        </Text>

        {/* Chevron icon indicating this is an expandable control */}
        <Ionicons name="chevron-down" size={20} color="#1D3B2A" />
      </Pressable>

      {/* Selection modal — rendered as a transparent overlay with a bottom sheet */}
      <Modal
        visible={isOpen}
        transparent // Keeps the background partially visible
        animationType="fade" // Smoothly fades in/out
        onRequestClose={() => setIsOpen(false)} // Handles Android back-button press
      >
        {/* Full-screen pressable overlay — tapping outside the sheet closes the modal */}
        <Pressable
          onPress={() => setIsOpen(false)}
          className="flex-1 justify-end bg-black/40"
        >
          {/* Bottom sheet container — stopPropagation is implicit via a nested Pressable
              so taps inside the sheet don't bubble up and close the modal */}
          <Pressable className="max-h-[80%] rounded-t-3xl bg-white px-5 pb-8 pt-5">
            {/* Sheet header: title on the left, close button on the right */}
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-emerald-950">
                Choose number of stops
              </Text>

              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Ionicons name="close" size={24} color="#1D3B2A" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {/* Render a tappable row for each stop option */}
              {stopOptions.map((count) => {
                // Determine whether this option matches the current value.
                const isSelected = value === count;

                return (
                  <Pressable
                    key={count}
                    onPress={() => handleSelectStop(count)}
                    // Highlight the selected option with a forest tint; others get a neutral background.
                    className={`mb-2 flex-row items-center justify-between rounded-2xl px-4 py-4 ${
                      isSelected ? "bg-emerald-100" : "bg-stone-50"
                    }`}
                  >
                    {/* Option label — bold and forest-coloured when selected */}
                    <Text
                      className={`text-base ${
                        isSelected
                          ? "font-bold text-emerald-950"
                          : "font-medium text-stone-700"
                      }`}
                    >
                      {count === 0
                        ? "No extra stops"
                        : `${count} stop${count > 1 ? "s" : ""}`}
                    </Text>

                    {/* Checkmark icon — only rendered for the currently selected option */}
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#1D3B2A"
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
