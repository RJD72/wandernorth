import Constants from "expo-constants";
import { Alert, Linking, Pressable, Text, View } from "react-native";

import { logger } from "../utils/logger";

function getFeedbackUrl() {
  const value = process.env.EXPO_PUBLIC_BETA_FEEDBACK_URL?.trim();
  return value && /^(https:|mailto:)/i.test(value) ? value : null;
}

export default function BetaInfoCard() {
  const version =
    Constants.nativeAppVersion || Constants.expoConfig?.version || "unknown";
  const buildNumber =
    Constants.nativeBuildVersion ||
    String(Constants.expoConfig?.android?.versionCode || "unknown");
  const feedbackUrl = getFeedbackUrl();

  async function openFeedback() {
    try {
      const canOpen = await Linking.canOpenURL(feedbackUrl);
      if (!canOpen) throw new Error("Unsupported feedback URL.");
      await Linking.openURL(feedbackUrl);
    } catch (error) {
      logger.warn("Open beta feedback error:", error);
      Alert.alert(
        "Feedback unavailable",
        "The feedback link could not be opened on this device.",
      );
    }
  }

  return (
    <View className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4">
      <Text className="text-sm font-bold text-white">Beta build</Text>
      <Text className="mt-1 text-xs text-white/75">
        Version {version} · Android build {buildNumber}
      </Text>
      {feedbackUrl && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send beta feedback"
          onPress={openFeedback}
          className="mt-3 self-start rounded-lg bg-white px-3 py-2"
        >
          <Text className="text-sm font-semibold text-emerald-950">
            Send Beta Feedback
          </Text>
        </Pressable>
      )}
    </View>
  );
}
