import { Pressable, Text, View } from "react-native";
import {
  getStopAddress,
  getStopCategory,
  getStopId,
  getStopTitle,
} from "../utils/stopUtils";

export default function SelectedStopsList({
  selectedStops = [],
  onRemoveStop,
  onRemoveAllStops,
  emptyMessage = "No stops selected yet. Add suggested or custom stops to customize your route.",
}) {
  return (
    <View className="my-4 rounded-2xl bg-white p-4 shadow-sm">
      <View
        className={`${selectedStops.length > 0 ? "flex-row items-center justify-between" : ""}`}
      >
        <Text className="text-xl font-bold text-emerald-950">
          Selected Stops
        </Text>

        {selectedStops.length === 0 && (
          <Text className="mt-3 text-stone-600">{emptyMessage}</Text>
        )}

        {selectedStops.length > 0 && (
          <Pressable
            onPress={onRemoveAllStops}
            className="mt-3 rounded-full bg-red-100 px-3 py-1"
          >
            <Text className="text-sm font-semibold text-red-700">
              Remove All
            </Text>
          </Pressable>
        )}
      </View>

      {selectedStops.map((stop, index) => {
        const stopId = getStopId(stop);

        return (
          <View
            key={stopId ?? `${getStopTitle(stop)}-${index}`}
            className="mt-3 rounded-xl border border-stone-200 bg-emerald-50 p-3"
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="font-semibold text-stone-900">
                  {index + 1}. {getStopTitle(stop)}
                </Text>

                <Text className="mt-1 text-sm text-stone-600">
                  {getStopCategory(stop)}
                </Text>

                <Text className="mt-1 text-sm text-stone-600">
                  {getStopAddress(stop)}
                </Text>
              </View>

              <Pressable
                onPress={() => onRemoveStop(stop)}
                className="rounded-full bg-red-100 px-3 py-1"
              >
                <Text className="text-sm font-semibold text-red-700">
                  Remove
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}
