import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function RouteSummaryCard({
  startingAddress,
  destinationAddress,
  travelMode,
  distanceText,
  durationText,
  numStops,
  selectedStopCount,
  selectedPoiTypes = [],
}) {
  const formattedPoiTypes =
    selectedPoiTypes.length > 0
      ? selectedPoiTypes.join(", ")
      : "No preferences selected";

  return (
    <View className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <Text className="mb-4 text-xl font-bold text-emerald-950">
        Route Summary
      </Text>

      <View className="mb-3 flex-row items-start">
        <MaterialCommunityIcons
          name="map-marker-outline"
          size={22}
          color="#1D3B2A"
        />
        <View className="ml-3 flex-1">
          <Text className="text-xs font-semibold uppercase text-stone-500">
            Starting Point
          </Text>
          <Text className="text-base text-stone-900">{startingAddress}</Text>
        </View>
      </View>

      <View className="mb-3 flex-row items-start">
        <MaterialCommunityIcons
          name="flag-checkered"
          size={22}
          color="#1D3B2A"
        />
        <View className="ml-3 flex-1">
          <Text className="text-xs font-semibold uppercase text-stone-500">
            Destination
          </Text>
          <Text className="text-base text-stone-900">{destinationAddress}</Text>
        </View>
      </View>

      <View className="mt-2 flex-row justify-between rounded-xl bg-emerald-50 p-3">
        <View>
          <Text className="text-xs font-semibold uppercase text-stone-500">
            Distance
          </Text>
          <Text className="text-base font-bold text-stone-900">
            {distanceText || "Not available"}
          </Text>
        </View>

        <View>
          <Text className="text-xs font-semibold uppercase text-stone-500">
            Duration
          </Text>
          <Text className="text-base font-bold text-stone-900">
            {durationText || "Not available"}
          </Text>
        </View>

        <View>
          <Text className="text-xs font-semibold uppercase text-stone-500">
            Mode
          </Text>
          <Text className="text-base font-bold capitalize text-stone-900">
            {travelMode}
          </Text>
        </View>
      </View>

      <View className="mt-4 border-t border-stone-200 pt-4">
        <Text className="text-xs font-semibold uppercase text-stone-500">
          Trip Preferences
        </Text>

        <Text className="mt-1 text-stone-900">
          Requested stops: {numStops}
        </Text>

        <Text className="mt-1 text-stone-900">
          Selected stops: {selectedStopCount}
        </Text>

        <Text className="mt-1 capitalize text-stone-900">
          POI Types: {formattedPoiTypes}
        </Text>
      </View>
    </View>
  );
}
