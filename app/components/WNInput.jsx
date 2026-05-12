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
      ...rest
    },
    ref,
  ) => {
    return (
      <View className={`mb-4 ${className}`}>
        {label && (
          <Text className="text-text-primary ml-2 mb-2 font-medium">
            {label}
          </Text>
        )}

        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#6BA488"
          className={`
            border border-forestLight bg-white rounded-xl px-4 py-3 text-charcoal text-base ${inputClassName}
          `}
          {...rest}
        />
      </View>
    );
  },
);

export default WNInput;
