import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import AutocompleteInput from "../components/AutoCompleteInput";
import WNButton from "../components/WNButton";
import StopCountDropdown from "../components/StopCountDropdown";
import POITypeSelector from "../components/POITypeSelector";
import WNTransportSelector from "../components/WNTransportSelector";
import ScreenIntroCard from "../components/ScreenIntroCard";
import CurrentLocationToggle from "../components/CurrentLocationToggle";
import RouteBuildingScreen from "../components/RouteBuildingScreen";
import PremiumFeatureCard from "../components/PremiumFeatureCard";
import PremiumStatusDevCard from "../components/PremiumStatusDevCard";

import { useRoutePlannerStore } from "../store/useRoutePlannerStore";
import { useEntitlementStore } from "../store/useEntitlementStore";
import { useSavedTripsStore } from "../store/useSavedTripsStore";
import {
  FEATURES,
  getFeatureLimits,
  getPremiumFeatureMessage,
} from "../config/featureAccess";
import { isValidCoords } from "../utils/coordinates";
import {
  geocodeAddress,
  getCurrentLocationWithLabel,
} from "../services/locationService";
import { canBuildGoogleRoute } from "../services/googleRoutes";

const TRANSPORT_OPTIONS = [
  { key: "driving", label: "Drive", icon: "car" },
  { key: "bicycling", label: "Bike", icon: "bike" },
  { key: "walking", label: "Walk", icon: "walk" },
  { key: "transit", label: "Transit", icon: "train" },
];

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
    setActiveRouteRequest,
    resetRoutePlanner,
  } = useRoutePlannerStore();
  const { subscriptionTier, setPremiumForTesting } = useEntitlementStore();
  const { clearActiveSavedTrip } = useSavedTripsStore();

  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [findingRoute, setFindingRoute] = useState(false);
  const [transitAvailable, setTransitAvailable] = useState(null);
  const [checkingTransit, setCheckingTransit] = useState(false);
  const [showMoreStopsPaywall, setShowMoreStopsPaywall] = useState(false);

  const featureLimits = getFeatureLimits(subscriptionTier);
  const maxSuggestedStops = featureLimits.maxSuggestedStops;
  const requestedStopCount = Number(numStops);
  const isOverFreeStopLimit =
    Number.isFinite(requestedStopCount) &&
    requestedStopCount > maxSuggestedStops;
  const moreStopsPremiumCopy = getPremiumFeatureMessage(
    FEATURES.MORE_AUTOMATIC_STOPS,
  );

  useEffect(() => {
    let isCurrent = true;

    async function checkTransitAvailability() {
      if (
        !isValidCoords(startingCoords) ||
        !isValidCoords(destinationCoords)
      ) {
        setTransitAvailable(null);
        setCheckingTransit(false);
        return;
      }

      try {
        setCheckingTransit(true);

        const available = await canBuildGoogleRoute({
          startingCoords,
          destinationCoords,
          travelMode: "transit",
        });

        if (!isCurrent) return;

        setTransitAvailable(available);
      } finally {
        if (isCurrent) {
          setCheckingTransit(false);
        }
      }
    }

    checkTransitAvailability();

    return () => {
      isCurrent = false;
    };
  }, [startingCoords, destinationCoords]);

  useEffect(() => {
    if (transitAvailable === false && selectedTravelMode === "transit") {
      setSelectedTravelMode("driving");
    }
  }, [transitAvailable, selectedTravelMode, setSelectedTravelMode]);

  const transportOptions = useMemo(() => {
    return TRANSPORT_OPTIONS.map((option) => {
      if (option.key !== "transit") return option;

      return {
        ...option,
        disabled: transitAvailable === false || checkingTransit,
      };
    });
  }, [transitAvailable, checkingTransit]);

  async function getCurrentLocation() {
    try {
      setLocating(true);
      setStartingAddress("Getting your location...");

      const result = await getCurrentLocationWithLabel();

      if (!result.ok) {
        if (result.reason === "permission-denied") {
          Alert.alert(
            "Location permission needed",
            "Please allow location access to use your current location.",
          );
        } else {
          Alert.alert(
            "Location error",
            "Unable to get your current location. Please try again or enter a starting point.",
          );
        }

        setStartingAddress("");
        setStartingCoords(null);
        return false;
      }

      setStartingAddress(result.addressLabel);
      setStartingCoords(result.coords);

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
    if (isOverFreeStopLimit) {
      setShowMoreStopsPaywall(true);
      return;
    }

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

      if (selectedTravelMode === "transit") {
        const transitRouteAvailable = await canBuildGoogleRoute({
          startingCoords: finalStartCoords,
          destinationCoords: finalDestinationCoords,
          travelMode: "transit",
        });

        if (!transitRouteAvailable) {
          setTransitAvailable(false);
          setSelectedTravelMode("driving");

          Alert.alert(
            "Transit unavailable",
            "Transit is not available for this route. Please choose another travel mode.",
          );

          return;
        }
      }

      clearActiveSavedTrip();
      setActiveRouteRequest({
        source: "navigate",
        startingAddress,
        destinationAddress,
        startingCoords: finalStartCoords,
        destinationCoords: finalDestinationCoords,
        travelMode: selectedTravelMode,
        numStops,
        selectedPoiTypes,
      });

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
    setShowMoreStopsPaywall(false);
  }

  if (findingRoute) {
    return (
      <RouteBuildingScreen
        title="Preparing your route"
        message="Checking your start and destination before building the route."
      />
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="px-2 pt-4">
        <ScreenIntroCard
          title="Navigate"
          description="Enter a starting point and destination, choose your travel mode, and Wander North will build a route with possible stops along the way."
        />

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

        <CurrentLocationToggle
          useCurrentLocation={useCurrentLocation}
          locating={locating}
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
        />

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
            Choose how you are traveling
          </Text>

          <WNTransportSelector
            value={selectedTravelMode}
            onChange={setSelectedTravelMode}
            options={transportOptions}
          />

          {checkingTransit && (
            <Text className="ml-2 mt-1 text-xs text-white/70">
              Checking transit availability for this route...
            </Text>
          )}

          {!checkingTransit && transitAvailable === false && (
            <Text className="ml-2 mt-1 text-xs text-white/70">
              Transit is unavailable for this route, so Drive is selected
              instead.
            </Text>
          )}
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

          <Text className="ml-2 mt-1 text-xs text-white/70">
            {Number.isFinite(maxSuggestedStops)
              ? `Free routes include up to ${maxSuggestedStops} automatic stops.`
              : "Premium route planning is enabled."}
          </Text>
        </View>

        {showMoreStopsPaywall && (
          <PremiumFeatureCard
            title={moreStopsPremiumCopy.title}
            message={moreStopsPremiumCopy.message}
            onClose={() => setShowMoreStopsPaywall(false)}
            showDevToggle
            onEnablePremiumForTesting={() => {
              setPremiumForTesting(true);
              setShowMoreStopsPaywall(false);
            }}
          />
        )}

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

        <PremiumStatusDevCard />
      </View>

    </ScrollView>
  );
};

export default Navigate;
