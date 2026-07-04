import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function CurrentLocationToggle({
  useCurrentLocation,
  locating,
  onPress,
}) {
  return (
    <View className="mb-2 flex-row items-center justify-between px-2">
      <Text className="text-text-primary">
        {useCurrentLocation
          ? "Using current location"
          : "Use current location"}
      </Text>

      <Pressable
        onPress={onPress}
        className={`h-11 w-11 items-center justify-center rounded-full ${
          useCurrentLocation ? "bg-emerald-700" : "bg-white/15"
        }`}
      >
        {locating ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <MaterialCommunityIcons
            name={useCurrentLocation ? "crosshairs-gps" : "crosshairs"}
            size={24}
            color="white"
          />
        )}
      </Pressable>
    </View>
  );
}
