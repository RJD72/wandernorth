import { ActivityIndicator, Modal, Text, View } from "react-native";

export default function RouteBuildingOverlay({ visible, title, message }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View className="flex-1 items-center justify-center bg-black/70 px-6">
        <View className="w-full max-w-sm items-center rounded-3xl bg-white px-6 py-8 shadow-lg">
          <ActivityIndicator size="large" color="#166534" />

          <Text className="mt-5 text-center text-xl font-bold text-emerald-900">
            {title}
          </Text>

          <Text className="mt-2 text-center text-base leading-6 text-emerald-950/75">
            {message}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
