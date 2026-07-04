import { Modal, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function PremiumFeatureCard({
  title,
  message,
  onClose,
  showDevToggle = false,
  onEnablePremiumForTesting,
  visible = true,
}) {
  const canClose = typeof onClose === "function";
  const canEnablePremiumForTesting =
    showDevToggle && typeof onEnablePremiumForTesting === "function";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={canClose ? onClose : () => {}}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-5">
        <Pressable
          className="absolute inset-0"
          onPress={onClose}
          disabled={!canClose}
          accessibilityLabel={
            canClose ? "Close Premium feature message" : undefined
          }
        />

        <View
          className="w-full max-w-[420px] rounded-3xl bg-white p-5 shadow-lg"
          accessibilityViewIsModal
        >
          <View className="flex-row items-start justify-between">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
              <MaterialCommunityIcons
                name="lock-outline"
                size={24}
                color="#1D3B2A"
              />
            </View>

            {canClose && (
              <Pressable
                onPress={onClose}
                accessibilityLabel="Close Premium feature message"
                className="h-10 w-10 items-center justify-center rounded-full bg-stone-100"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color="#1D3B2A"
                />
              </Pressable>
            )}
          </View>

          <Text className="mt-3 text-xl font-bold text-emerald-950">
            {title}
          </Text>
          <Text className="mt-2 text-sm leading-5 text-stone-600">
            {message}
          </Text>

          <Pressable
            disabled
            className="mt-4 rounded-xl bg-emerald-800 px-4 py-3 opacity-50"
          >
            <Text className="text-center font-semibold text-white">
              Premium coming soon
            </Text>
          </Pressable>

          {canEnablePremiumForTesting && (
            <Pressable
              onPress={onEnablePremiumForTesting}
              className="mt-3 rounded-xl border border-emerald-800/30 bg-white px-4 py-3"
            >
              <Text className="text-center font-semibold text-emerald-950">
                Enable Premium for Testing
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
