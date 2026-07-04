import { TextInput, View, Text } from "react-native";
import { forwardRef } from "react";

/**
 * Wander North Input
 * ------------------
 * A reusable text input component with label.
 *
 * Props:
 * - label: string (optional label above input)
 * - value: string
 * - onChangeText: function
 * - placeholder: string
 * - className: extra tailwind for the outer container
 * - inputClassName: extra tailwind for the TextInput itself
 * - withBottomMargin: whether the outer container includes its default margin
 * - rightElement: optional React node rendered inside the right side of the input
 * - ...rest: any extra TextInput props (keyboardType, autoCapitalize, etc.)
 */
const WNInput = forwardRef(
  (
    {
      label,
      value,
      onChangeText,
      placeholder,
      className = "",
      inputClassName = "",
      withBottomMargin = true,
      rightElement = null,
      ...rest
    },
    ref,
  ) => {
    return (
      <View
        className={`${withBottomMargin ? "mb-4" : ""} ${className}`}
      >
        {label && (
          <Text className="text-text-primary ml-2 mb-2 font-medium">
            {label}
          </Text>
        )}

        <View className="relative">
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#6BA488"
            className={`
              rounded-xl border border-emerald-300 bg-white px-4 py-3 text-base text-stone-900
              ${rightElement ? "pr-12" : ""}
              ${inputClassName}
            `}
            {...rest}
          />

          {rightElement && (
            <View className="absolute bottom-0 right-3 top-0 justify-center">
              {rightElement}
            </View>
          )}
        </View>
      </View>
    );
  },
);

export default WNInput;
