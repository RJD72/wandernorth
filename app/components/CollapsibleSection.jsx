import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function CollapsibleSection({
  title,
  subtitle,
  defaultCollapsed = false,
  children,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <View className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
      <Pressable
        onPress={() => setCollapsed((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${title}`}
        className="flex-row items-center justify-between px-4 py-4"
      >
        <View className="flex-1 pr-3">
          <Text className="text-lg font-bold text-emerald-950">{title}</Text>

          {subtitle ? (
            <Text className="mt-1 text-sm text-stone-600">{subtitle}</Text>
          ) : null}
        </View>

        <Text className="text-xl font-bold text-emerald-950">
          {collapsed ? "+" : "−"}
        </Text>
      </Pressable>

      {!collapsed && <View className="px-4 pb-4">{children}</View>}
    </View>
  );
}
