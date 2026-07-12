import { Text, View } from "react-native";
import { isDemoModeEnabled } from "../config/demoMode";
export default function DemoDataIndicator() {
  if (!__DEV__ || !isDemoModeEnabled) return null;
  return (
    <View className="mb-3 self-start rounded-full bg-amber-100 px-3 py-1">
      <Text className="text-xs font-semibold text-amber-900">
        Demo data active
      </Text>
    </View>
  );
}
