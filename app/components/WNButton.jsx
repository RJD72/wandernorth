import React from "react";
import { Pressable, Text } from "react-native";

const VARIANTS = {
  primary: {
    button: "bg-emerald-800 border border-emerald-800",
    text: "text-white",
  },
  secondary: {
    button: "bg-white border border-emerald-800/30",
    text: "text-emerald-950",
  },
  danger: {
    button: "bg-red-600 border border-red-600",
    text: "text-white",
  },
  ghost: {
    button: "bg-transparent border border-transparent",
    text: "text-emerald-900",
  },
};

export default function WNButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  className = "",
  textClassName = "",
}) {
  const styles = VARIANTS[variant] ?? VARIANTS.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
      className={`rounded-lg px-4 py-3 ${styles.button} ${className}`}
    >
      <Text
        className={`text-center font-semibold ${styles.text} ${textClassName}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
