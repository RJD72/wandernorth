import { useState } from "react";
import { View, Text, Pressable } from "react-native";

// Radio button component that allows users to select one option from a list
export default function WNRadioButton() {
  // State to track which option is currently selected (defaults to "option1")
  const [selected, setSelected] = useState("option1");

  // Array of available radio button options
  const options = ["option1", "option2"];

  return (
    // Container with vertical spacing between radio buttons
    <View className="gap-3">
      {/* Loop through each option and render a radio button */}
      {options.map((option) => (
        <Pressable
          key={option}
          // Update selected state when radio button is pressed
          onPress={() => setSelected(option)}
          className="flex-row items-center gap-2"
        >
          {/* Outer circle of the radio button */}
          <View className="w-5 h-5 rounded-full border-2 border-green-500 items-center justify-center">
            {/* Inner filled circle - only shown when this option is selected */}
            {selected === option && (
              <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
            )}
          </View>
          {/* Label text for the radio button option */}
          <Text className="text-white">{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}
