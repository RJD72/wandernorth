import { ActivityIndicator, Text, View } from "react-native";

export default function RouteBuildingScreen({
  title = "Building your route...",
  message = "This may take a moment.",
}) {
  return (
    <View className="flex-1 items-center justify-center bg-stone-50 px-6">
      <ActivityIndicator size="large" color="#1D3B2A" />

      <Text className="mt-4 text-lg font-semibold text-emerald-950">
        {title}
      </Text>

      {!!message && (
        <Text className="mt-2 text-center text-sm leading-5 text-stone-600">
          {message}
        </Text>
      )}
    </View>
  );
}
