import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useEntitlementStore } from "../store/useEntitlementStore";
import { isPremiumTier } from "../config/featureAccess";

export default function PremiumStatusDevCard() {
  const { subscriptionTier, setPremiumForTesting } = useEntitlementStore();
  const premium = isPremiumTier(subscriptionTier);

  if (!__DEV__) return null;

  return (
    <View className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4">
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons name="tools" size={18} color="white" />
        <Text className="text-sm font-bold text-white">Testing Mode</Text>
      </View>

      <Text className="mt-2 text-sm text-white/75">
        Current mode: {premium ? "Premium Testing" : "Free"}
      </Text>

      <Pressable
        onPress={() => setPremiumForTesting(!premium)}
        className="mt-3 rounded-xl bg-white px-4 py-3"
      >
        <Text className="text-center font-semibold text-emerald-950">
          {premium ? "Return to Free Testing" : "Enable Premium Testing"}
        </Text>
      </Pressable>
    </View>
  );
}
