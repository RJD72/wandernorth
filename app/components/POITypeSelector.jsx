import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  POI_CATEGORY_GROUPS,
  getPoiCategoryLabelById,
} from "../config/poiCategories";

const POI_TYPE_ICONS = {
  restaurant: "silverware-fork-knife",
  breakfast: "food-croissant",
  fast_food: "hamburger",
  pizza: "pizza",
  italian: "silverware-fork-knife",
  chinese: "silverware-fork-knife",
  sushi: "silverware-fork-knife",
  mexican: "silverware-fork-knife",
  thai: "silverware-fork-knife",
  indian: "silverware-fork-knife",
  seafood: "fish",
  steakhouse: "silverware-fork-knife",
  vegan_vegetarian: "leaf",
  cafe: "coffee",
  coffee: "coffee-outline",
  bakery: "bread-slice",
  donuts: "circle-slice-8",
  ice_cream: "ice-cream",
  park: "tree",
  beach: "beach",
  hiking: "hiking",
  scenic: "image-filter-hdr",
  campground: "tent",
  tourist_attraction: "map-marker",
  museum: "bank",
  historic: "home-city-outline",
  winery: "glass-wine",
  zoo: "paw",
  amusement: "ferris-wheel",
  gas_station: "gas-station",
  ev_charging: "ev-station",
  grocery: "cart",
  rest_stop: "parking",
  parking: "parking",
};

function getPoiTypeIcon(categoryId) {
  return POI_TYPE_ICONS[categoryId] || "map-marker-outline";
}

export default function POITypeSelector({
  selectedPoiTypes = [],
  onChange,
  label = "What do you want to see?",
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedSummary = useMemo(() => {
    if (selectedPoiTypes.length === 0) {
      return "Any type of stop";
    }

    const selectedLabels = selectedPoiTypes
      .map(getPoiCategoryLabelById)
      .filter(Boolean);
    const visibleLabels = selectedLabels.slice(0, 3);
    const hiddenCount = selectedLabels.length - visibleLabels.length;

    if (hiddenCount > 0) {
      return `${visibleLabels.join(", ")} +${hiddenCount}`;
    }

    return visibleLabels.join(", ");
  }, [selectedPoiTypes]);

  function handleTogglePoiType(id) {
    const isAlreadySelected = selectedPoiTypes.includes(id);

    if (isAlreadySelected) {
      onChange(
        selectedPoiTypes.filter((selectedId) => selectedId !== id),
      );
      return;
    }

    onChange([...selectedPoiTypes, id]);
  }

  function handleClearAll() {
    onChange([]);
  }

  return (
    <View className="w-full">
      <Text className="mb-2 text-sm font-semibold text-white">{label}</Text>

      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        className="flex-row items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-4"
      >
        <View className="mr-3 flex-1">
          <Text className="text-base font-medium text-emerald-950">
            {selectedSummary}
          </Text>

          <Text className="mt-1 text-xs text-stone-500">
            {selectedPoiTypes.length === 0
              ? "Search all available stop types"
              : `${selectedPoiTypes.length} selected`}
          </Text>
        </View>

        <MaterialCommunityIcons name="chevron-down" size={22} color="#1D3B2A" />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          onPress={() => setIsOpen(false)}
          className="flex-1 justify-end bg-black/40"
        >
          <Pressable className="max-h-[80%] rounded-t-3xl bg-white px-5 pb-8 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="mr-4 flex-1">
                <Text className="text-lg font-bold text-emerald-950">
                  Choose stop types
                </Text>

                <Text className="mt-1 text-sm text-stone-500">
                  Select one or more categories for your route.
                </Text>
              </View>

              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color="#1D3B2A"
                />
              </TouchableOpacity>
            </View>

            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-sm font-medium text-stone-600">
                {selectedPoiTypes.length === 0
                  ? "No filters selected"
                  : `${selectedPoiTypes.length} selected`}
              </Text>

              {selectedPoiTypes.length > 0 && (
                <Pressable onPress={handleClearAll}>
                  <Text className="text-sm font-semibold text-emerald-800">
                    Clear all
                  </Text>
                </Pressable>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {POI_CATEGORY_GROUPS.map((group) => (
                <View key={group.id} className="mb-4">
                  <Text className="mb-2 text-xs font-bold uppercase text-stone-500">
                    {group.label}
                  </Text>

                  {group.categories.map((poiType) => {
                    const isSelected = selectedPoiTypes.includes(poiType.id);

                    return (
                      <Pressable
                        key={poiType.id}
                        onPress={() => handleTogglePoiType(poiType.id)}
                        className={`mb-2 flex-row items-center justify-between rounded-2xl px-4 py-4 ${
                          isSelected ? "bg-emerald-100" : "bg-stone-50"
                        }`}
                      >
                        <View className="flex-row items-center">
                          <View
                            className={`mr-3 h-10 w-10 items-center justify-center rounded-full ${
                              isSelected ? "bg-emerald-800" : "bg-white"
                            }`}
                          >
                            <MaterialCommunityIcons
                              name={getPoiTypeIcon(poiType.id)}
                              size={20}
                              color={isSelected ? "white" : "#1D3B2A"}
                            />
                          </View>

                          <Text
                            className={`text-base ${
                              isSelected
                                ? "font-bold text-emerald-950"
                                : "font-medium text-stone-700"
                            }`}
                          >
                            {poiType.label}
                          </Text>
                        </View>

                        {isSelected ? (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={22}
                            color="#1D3B2A"
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="checkbox-blank-circle-outline"
                            size={22}
                            color="#A8A29E"
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            <Pressable
              onPress={() => setIsOpen(false)}
              className="mt-4 rounded-2xl bg-emerald-800 px-4 py-4"
            >
              <Text className="text-center text-base font-bold text-white">
                Done
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
