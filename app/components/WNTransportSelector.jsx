import React from "react";
import { View, Text, Pressable } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

// Default transport modes shown when the caller does not provide a custom list.
// Each option drives both behavior (key) and presentation (label/icon).
const OPTIONS = [
  { key: "driving", label: "Car", icon: "car" },
  { key: "transit", label: "Transit", icon: "train" },
  { key: "walking", label: "Walk", icon: "walk" },
  { key: "bicycling", label: "Bike", icon: "bike" },
];

// Reusable segmented selector for transport type.
// Props:
// - value: currently selected option key
// - onChange: callback fired with next option key when a button is pressed
// - options: optional custom options array (falls back to OPTIONS above)
export default function WNTransportSelector({
  value,
  onChange,
  options = OPTIONS,
}) {
  return (
    // Outer container styles the selector as a rounded, dark panel.
    <View
      style={{
        backgroundColor: "#1D3B2A",
        borderRadius: 12,
        overflow: "hidden",
      }}
      className="mb-3 mt-2 px-3 py-3"
    >
      {/* Horizontal row containing one pressable button per option. */}
      <View className="flex-row items-center justify-between">
        {options.map((option) => {
          // Derived flags used to control both visual state and interaction.
          const isSelected = value === option.key;
          const isDisabled = option.disabled;

          return (
            <Pressable
              key={option.key}
              onPress={() => {
                // Guard callback invocation so disabled options are fully inert
                // even if onPress is somehow triggered.
                if (!isDisabled) onChange(option.key);
              }}
              disabled={isDisabled}
              style={{
                // Disabled options are visually de-emphasized.
                opacity: isDisabled ? 0.4 : 1,
                // Selected option gets a green highlight, others stay transparent.
                backgroundColor: isSelected ? "#16a34a" : "transparent",
                borderRadius: 16,
                // Minimum size keeps each touch target comfortably tappable.
                minWidth: 52,
                minHeight: 50,
                paddingHorizontal: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Icon communicates transport mode at a glance. */}
              <MaterialCommunityIcons
                name={option.icon}
                size={24}
                color="#FFFFFF"
              />
              <Text
                // Selected item uses a heavier text weight for added emphasis.
                className={`mt-1 text-xs text-white ${isSelected ? "font-semibold" : "font-normal"}`}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
