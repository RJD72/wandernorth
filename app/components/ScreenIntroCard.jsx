import { Text, View } from "react-native";

export default function ScreenIntroCard({ title, description }) {
  return (
    <View className="mb-5 rounded-3xl bg-white/10 px-4 py-5">
      <Text className="text-3xl font-bold text-white">{title}</Text>

      <Text className="mt-2 text-base leading-6 text-white/80">
        {description}
      </Text>
    </View>
  );
}
