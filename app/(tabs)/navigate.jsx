import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import AutocompleteInput from "../components/AutoCompleteInput";
import WNButton from "../components/WNButton";
import StopCountDropdown from "../components/StopCountDropdown";
import POITypeSelector from "../components/POITypeSelector";
import WNTransportSelector from "../components/WNTransportSelector";

import { useRoutePlannerStore } from "../store/useRoutePlannerStore";

const TRANSPORT_OPTIONS = [
  { key: "driving", label: "Drive", icon: "car" },
  { key: "bicycling", label: "Bike", icon: "bike" },
  { key: "walking", label: "Walk", icon: "walk" },
  { key: "transit", label: "Transit", icon: "train" },
];

function isValidCoords(coords) {
  return (
    coords &&
    typeof coords.latitude === "number" &&
    typeof coords.longitude === "number" &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude)
  );
}

async function geocodeAddress(address) {
  if (!address?.trim()) return null;

  try {
    const results = await Location.geocodeAsync(address.trim());

    if (!results?.length) return null;

    return {
      latitude: results[0].latitude,
      longitude: results[0].longitude,
    };
  } catch (error) {
    console.log("Navigate geocode error:", error);
    return null;
  }
}

const Navigate = () => {
  const router = useRouter();

  const {
    startingAddress,
    destinationAddress,
    startingCoords,
    destinationCoords,
    selectedTravelMode,
    numStops,
    selectedPoiTypes,

    setStartingAddress,
    setDestinationAddress,
    setStartingCoords,
    setDestinationCoords,
    setSelectedTravelMode,
    setNumStops,
    setSelectedPoiTypes,
    resetRoutePlanner,
  } = useRoutePlannerStore();

  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [findingRoute, setFindingRoute] = useState(false);

  async function getCurrentLocation() {
    try {
      setLocating(true);
      setStartingAddress("Getting your location...");

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Please allow location access to use your current location.",
        );

        setStartingAddress("");
        setStartingCoords(null);
        return false;
      }

      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;

      const geo = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const firstResult = geo?.[0];

      const city =
        firstResult?.city ||
        firstResult?.subregion ||
        firstResult?.region ||
        "Current Location";

      const region = firstResult?.region || "";

      setStartingAddress(region ? `${city}, ${region}` : city);
      setStartingCoords({ latitude, longitude });

      return true;
    } catch (error) {
      console.log("Navigate location error:", error);

      Alert.alert(
        "Location error",
        "Unable to get your current location. Please try again or enter a starting point.",
      );

      setStartingAddress("");
      setStartingCoords(null);
      return false;
    } finally {
      setLocating(false);
    }
  }

  async function handleFindRoute() {
    try {
      setFindingRoute(true);

      let finalStartCoords = startingCoords;
      let finalDestinationCoords = destinationCoords;

      if (!isValidCoords(finalStartCoords)) {
        finalStartCoords = await geocodeAddress(startingAddress);

        if (!isValidCoords(finalStartCoords)) {
          Alert.alert(
            "Starting point needed",
            "Enter a valid starting point or use your current location.",
          );
          return;
        }

        setStartingCoords(finalStartCoords);
      }

      if (!isValidCoords(finalDestinationCoords)) {
        finalDestinationCoords = await geocodeAddress(destinationAddress);

        if (!isValidCoords(finalDestinationCoords)) {
          Alert.alert(
            "Destination needed",
            "Enter a valid destination before building your route.",
          );
          return;
        }

        setDestinationCoords(finalDestinationCoords);
      }

      router.push({
        pathname: "/(screens)/route",
        params: {
          returnTo: "/(tabs)/navigate",
        },
      });
    } finally {
      setFindingRoute(false);
    }
  }

  function handleReset() {
    resetRoutePlanner();
    setUseCurrentLocation(false);
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="px-2 pt-4">
        <View className="mb-5 rounded-3xl bg-white/10 px-4 py-5">
          <Text className="text-3xl font-bold text-white">Navigate</Text>

          <Text className="mt-2 text-base leading-6 text-white/80">
            Enter a starting point and destination, choose your travel mode, and
            Wander North will build a route with possible stops along the way.
          </Text>
        </View>

        <AutocompleteInput
          label="Starting Point"
          value={startingAddress}
          placeholder="Search a city, address, or landmark"
          editable={!useCurrentLocation}
          onChangeText={(text) => {
            setStartingAddress(text);
            setStartingCoords(null);
            setUseCurrentLocation(false);
          }}
          onSelectLocation={(address, coords) => {
            setStartingAddress(address);
            setStartingCoords(coords);
            setUseCurrentLocation(false);
          }}
        />

        <View className="mb-2 flex-row items-center justify-between px-2">
          <Text className="text-text-primary">
            {useCurrentLocation
              ? "Using current location"
              : "Use current location"}
          </Text>

          <Pressable
            onPress={async () => {
              if (useCurrentLocation) {
                setUseCurrentLocation(false);
                setStartingAddress("");
                setStartingCoords(null);
                return;
              }

              const ok = await getCurrentLocation();

              if (ok) {
                setUseCurrentLocation(true);
              }
            }}
            className={`h-11 w-11 items-center justify-center rounded-full ${
              useCurrentLocation ? "bg-emerald-700" : "bg-white/15"
            }`}
          >
            {locating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons
                name={useCurrentLocation ? "crosshairs-gps" : "crosshairs"}
                size={24}
                color="white"
              />
            )}
          </Pressable>
        </View>

        <AutocompleteInput
          label="Destination"
          value={destinationAddress}
          placeholder="Search a city, address, or landmark"
          onChangeText={(text) => {
            setDestinationAddress(text);
            setDestinationCoords(null);
          }}
          onSelectLocation={(address, coords) => {
            setDestinationAddress(address);
            setDestinationCoords(coords);
          }}
        />

        <View className="mt-5">
          <Text className="mb-2 ml-2 text-sm font-semibold text-white">
            Choose how you are travelling
          </Text>

          <WNTransportSelector
            value={selectedTravelMode}
            onChange={setSelectedTravelMode}
            options={TRANSPORT_OPTIONS}
          />
        </View>

        <View className="mt-5 rounded-2xl bg-white/10 p-4">
          <Text className="text-sm font-semibold text-white">
            Route preview
          </Text>

          <Text className="mt-1 text-sm leading-5 text-white/75">
            The full map, route line, and suggested stops will appear on the
            route screen after you build your route.
          </Text>
        </View>

        <View className="mt-5">
          <POITypeSelector
            selectedPoiTypes={selectedPoiTypes}
            onChange={setSelectedPoiTypes}
            label="What kind of stops should we look for?"
          />
        </View>

        <View className="mt-5">
          <StopCountDropdown value={numStops} onChange={setNumStops} />
        </View>

        <View className="mt-8 gap-4">
          <WNButton
            label={findingRoute ? "Building Route..." : "Build Route"}
            onPress={handleFindRoute}
            disabled={findingRoute || locating}
            variant="primary"
          />

          <WNButton
            label="Reset Navigate"
            onPress={handleReset}
            variant="secondary"
          />
        </View>
      </View>
    </ScrollView>
  );
};

export default Navigate;
