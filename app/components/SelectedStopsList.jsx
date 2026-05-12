import { Pressable, Text, View } from "react-native";

function getStopId(stop) {
  if (!stop) return undefined;

  return (
    stop.id ??
    stop.place_id ??
    stop.fsq_id ??
    stop.properties?.place_id ??
    stop.properties?.id ??
    stop.name
  );
}

function getStopTitle(stop) {
  if (!stop) return "Unnamed stop";

  return stop.name ?? stop.title ?? "Unnamed stop";
}

function getStopCategory(stop) {
  if (!stop) return "Suggested stop";

  return stop.category ?? stop.type ?? stop.poiType ?? "Suggested stop";
}

function getStopAddress(stop) {
  if (!stop) return "Address not available";

  return (
    stop.address ??
    stop.formattedAddress ??
    stop.vicinity ??
    stop.location?.address ??
    "Address not available"
  );
}

export default function SelectedStopsList({
  selectedStops = [],
  onRemoveStop,
}) {
  return (
    <View className="my-4 rounded-2xl bg-white p-4 shadow-sm">
      <Text className="text-xl font-bold text-wn-forest">Selected Stops</Text>

      {selectedStops.length === 0 && (
        <Text className="mt-3 text-wn-text">
          No stops selected yet. Add a few suggested stops to customize your
          route.
        </Text>
      )}

      {selectedStops.map((stop, index) => {
        const stopId = getStopId(stop);

        return (
          <View
            key={stopId ?? `${getStopTitle(stop)}-${index}`}
            className="mt-3 rounded-xl border border-wn-border bg-wn-green-50 p-3"
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="font-semibold text-wn-charcoal">
                  {index + 1}. {getStopTitle(stop)}
                </Text>

                <Text className="mt-1 text-sm text-wn-text">
                  {getStopCategory(stop)}
                </Text>

                <Text className="mt-1 text-sm text-wn-text">
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
