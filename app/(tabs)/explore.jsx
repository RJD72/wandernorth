import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import AutocompleteInput from "../components/AutoCompleteInput";
import WNButton from "../components/WNButton";
import StopCountDropdown from "../components/StopCountDropdown";
import POITypeSelector from "../components/POITypeSelector";
import ScreenIntroCard from "../components/ScreenIntroCard";
import CurrentLocationToggle from "../components/CurrentLocationToggle";
import RouteBuildingScreen from "../components/RouteBuildingScreen";
import WNTransportSelector from "../components/WNTransportSelector";
import PremiumFeatureCard from "../components/PremiumFeatureCard";
import PremiumStatusDevCard from "../components/PremiumStatusDevCard";

import { buildGoogleRoute } from "../services/googleRoutes";

import { useRoutePlannerStore } from "../store/useRoutePlannerStore";
import { useEntitlementStore } from "../store/useEntitlementStore";
import { useSavedTripsStore } from "../store/useSavedTripsStore";
import {
  FEATURES,
  canUseFeature,
  getPremiumFeatureMessage,
} from "../config/featureAccess";
import { isValidCoords } from "../utils/coordinates";
import {
  geocodeAddress,
  getCurrentLocationWithLabel,
} from "../services/locationService";
import { logger } from "../utils/logger";

const DIRECTIONS = [
  {
    key: "north",
    label: "North",
    shortLabel: "N",
    bearingDegrees: 0,
    icon: "arrow-up-bold",
  },
  {
    key: "east",
    label: "East",
    shortLabel: "E",
    bearingDegrees: 90,
    icon: "arrow-right-bold",
  },
  {
    key: "south",
    label: "South",
    shortLabel: "S",
    bearingDegrees: 180,
    icon: "arrow-down-bold",
  },
  {
    key: "west",
    label: "West",
    shortLabel: "W",
    bearingDegrees: 270,
    icon: "arrow-left-bold",
  },
];

const DRIVE_TIME_OPTIONS = [30, 45, 60, 90, 120, 180];

const EXPLORE_TRANSPORT_OPTIONS = [
  { key: "driving", label: "Drive", icon: "car" },
  { key: "bicycling", label: "Bike", icon: "bike" },
  { key: "walking", label: "Walk", icon: "walk" },
  {
    key: "transit",
    label: "Transit",
    icon: "train",
    disabled: true,
  },
];

const AVERAGE_SPEED_BY_MODE_KMH = {
  driving: 70,
  bicycling: 18,
  walking: 5,
  transit: 35,
};
const MAX_EXPLORE_CANDIDATES = 25;

function parseGoogleDurationSeconds(durationString) {
  if (typeof durationString !== "string") return null;

  const seconds = Number(durationString.replace("s", ""));

  return Number.isFinite(seconds) ? seconds : null;
}

function getExploreDestinationCandidates({
  startCoords,
  bearingDegrees,
  baseDistanceKm,
  targetTravelTimeMinutes,
}) {
  /**
   * Explore should mean "north-ish", "south-ish", etc.
   *
   * If exact north lands in water or wilderness, we try slight angles around it.
   */
  const bearingOffsets = [0, -15, 15, -30, 30];

  /**
   * Longer trips keep farther-distance options for regions where roads must
   * travel around lakes or other geographic barriers.
   */
  const distanceMultipliers =
    targetTravelTimeMinutes >= 90
      ? [1, 0.85, 1.15, 1.35, 1.55]
      : [1, 0.85, 1.15, 0.7, 1.3];

  const candidates = [];

  for (const distanceMultiplier of distanceMultipliers) {
    for (const bearingOffset of bearingOffsets) {
      const candidateBearing = bearingDegrees + bearingOffset;
      const candidateDistanceKm = baseDistanceKm * distanceMultiplier;

      candidates.push({
        bearingDegrees: candidateBearing,
        distanceKm: candidateDistanceKm,
        coords: getDestinationFromBearing({
          startCoords,
          bearingDegrees: candidateBearing,
          distanceKm: candidateDistanceKm,
        }),
      });
    }
  }

  return candidates.slice(0, MAX_EXPLORE_CANDIDATES);
}

function getSmallestBearingDifferenceDegrees(a, b) {
  // Todo: stop prettier from adding extra parentheses around % 360 - 180
  const difference = Math.abs(((((a - b) % 360) + 540) % 360) - 180);

  return difference;
}

function getAcceptableDurationDeltaSeconds(targetTravelTimeMinutes) {
  if (targetTravelTimeMinutes <= 45) return 8 * 60;
  if (targetTravelTimeMinutes <= 90) return 12 * 60;
  if (targetTravelTimeMinutes <= 120) return 15 * 60;

  return 18 * 60;
}

function scoreExploreCandidate({
  candidate,
  directionConfig,
  durationDeltaSeconds,
  targetDurationSeconds,
}) {
  const bearingDifference = getSmallestBearingDifferenceDegrees(
    candidate.bearingDegrees,
    directionConfig.bearingDegrees,
  );

  const durationDeltaMinutes = durationDeltaSeconds / 60;

  /**
   * Duration matters most, but direction matters too.
   *
   * Example:
   * - A route 10 minutes off target but 75 degrees away from north should not beat
   *   a route 20 minutes off target that is only 15 degrees away from north
   */
  const durationPenalty = durationDeltaMinutes;

  /**
   * Direction penalty is weighted.
   * Every degree away from the chosen compass direction adds cost
   */
  const directionPenalty = bearingDifference * 0.75;

  /**
   * Strong penalty if we drift too far from the requested direction
   */
  const wideDriftPenalty = bearingDifference > 60 ? 40 : 0;

  return durationPenalty + directionPenalty + wideDriftPenalty;
}

async function findBestExploreDestination({
  startCoords,
  directionConfig,
  targetTravelTimeMinutes,
  estimatedStraightLineDistanceKm,
  travelMode,
}) {
  const targetDurationSeconds = targetTravelTimeMinutes * 60;

  const candidates = getExploreDestinationCandidates({
    startCoords,
    bearingDegrees: directionConfig.bearingDegrees,
    baseDistanceKm: estimatedStraightLineDistanceKm,
    targetTravelTimeMinutes,
  });

  const successfulCandidates = [];

  /**
   * Sequential on purpose.
   *
   * Parallel would be faster, but it could burn a lot of Google Routes calls at once.
   * For now, we try candidates one by one and stop if we find a good enough match.
   */
  for (const candidate of candidates) {
    try {
      const routePreview = await buildGoogleRoute({
        startingCoords: startCoords,
        destinationCoords: candidate.coords,
        travelMode,
      });

      const durationSeconds = parseGoogleDurationSeconds(routePreview.duration);

      const durationDeltaSeconds =
        typeof durationSeconds === "number"
          ? Math.abs(durationSeconds - targetDurationSeconds)
          : Infinity;

      const candidateScore = scoreExploreCandidate({
        candidate,
        directionConfig,
        durationDeltaSeconds,
        targetDurationSeconds,
      });

      const successfulCandidate = {
        ...candidate,
        routePreview,
        durationSeconds,
        durationDeltaSeconds,
        candidateScore,
      };

      successfulCandidates.push(successfulCandidate);

      logger.log("[Explore] Candidate route succeeded:", {
        direction: directionConfig.key,
        bearingDegrees: candidate.bearingDegrees,
        distanceKm: candidate.distanceKm,
        durationMinutes:
          typeof durationSeconds === "number"
            ? Math.round(durationSeconds / 60)
            : null,
        durationDeltaMinutes: Number.isFinite(durationDeltaSeconds)
          ? Math.round(durationDeltaSeconds / 60)
          : null,
        candidateScore: Math.round(candidateScore * 10) / 10,
        coords: candidate.coords,
      });

      const bearingDifference = getSmallestBearingDifferenceDegrees(
        candidate.bearingDegrees,
        directionConfig.bearingDegrees,
      );

      /**
       * Only return early if the route is close to the requested time
       * AND still respects the requested direction
       */
      const acceptableDurationDeltaSeconds = getAcceptableDurationDeltaSeconds(
        targetTravelTimeMinutes,
      );

      if (
        durationDeltaSeconds <= acceptableDurationDeltaSeconds &&
        bearingDifference <= 30
      ) {
        return successfulCandidate;
      }
    } catch (error) {
      logger.log("[Explore] Candidate route failed:", {
        direction: directionConfig.key,
        bearingDegrees: candidate.bearingDegrees,
        distanceKm: candidate.distanceKm,
        coords: candidate.coords,
        error: error.message,
      });
    }
  }

  if (successfulCandidates.length === 0) {
    return null;
  }

  /**
   * If no candidate was close enough, use the successful one closest to
   * the requested travel time.
   */
  return [...successfulCandidates].sort((a, b) => {
    return a.candidateScore - b.candidateScore;
  })[0];
}

/**
 * A straight-line destination should be shorter than the actual road distance.
 *
 * Example:
 * - User chooses 60 minutes.
 * - The selected travel mode provides an estimated average speed.
 * - The estimated travel distance is reduced by the straight-line factor.
 *
 * This gives Google Routes enough space to create a real route without
 * wildly overshooting the user's time budget.
 */
const STRAIGHT_LINE_ROUTE_FACTOR = 0.65;

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

function normalizeLongitude(longitude) {
  return ((longitude + 540) % 360) - 180;
}

/**
 * Projects a destination coordinate from a starting point, bearing, and distance.
 *
 * This is not a final navigation algorithm.
 * It is a practical MVP move: create an approximate destination point so the
 * existing Route screen can build a real Google route and fetch POIs.
 */
function getDestinationFromBearing({
  startCoords,
  bearingDegrees,
  distanceKm,
}) {
  const earthRadiusKm = 6371;

  const bearing = toRadians(bearingDegrees);
  const angularDistance = distanceKm / earthRadiusKm;

  const startLatitude = toRadians(startCoords.latitude);
  const startLongitude = toRadians(startCoords.longitude);

  const destinationLatitude = Math.asin(
    Math.sin(startLatitude) * Math.cos(angularDistance) +
      Math.cos(startLatitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );

  const destinationLongitude =
    startLongitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(startLatitude),
      Math.cos(angularDistance) -
        Math.sin(startLatitude) * Math.sin(destinationLatitude),
    );

  return {
    latitude: toDegrees(destinationLatitude),
    longitude: normalizeLongitude(toDegrees(destinationLongitude)),
  };
}

function DirectionSelector({ value, onChange }) {
  return (
    <View className="mt-4">
      <Text className="mb-2 ml-2 text-sm font-semibold text-white">
        Pick a direction
      </Text>

      <View className="flex-row flex-wrap gap-3">
        {DIRECTIONS.map((direction) => {
          const selected = value === direction.key;

          return (
            <Pressable
              key={direction.key}
              onPress={() => onChange(direction.key)}
              className={`w-[47%] rounded-2xl border px-4 py-4 ${
                selected
                  ? "border-emerald-800 bg-white"
                  : "border-white/20 bg-white/10"
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text
                    className={`text-lg font-bold ${
                      selected ? "text-emerald-950" : "text-white"
                    }`}
                  >
                    {direction.label}
                  </Text>

                  <Text
                    className={`mt-1 text-xs ${
                      selected ? "text-stone-600" : "text-white/70"
                    }`}
                  >
                    Explore toward {direction.shortLabel}
                  </Text>
                </View>

                <View
                  className={`h-10 w-10 items-center justify-center rounded-full ${
                    selected ? "bg-emerald-800" : "bg-white/20"
                  }`}
                >
                  <MaterialCommunityIcons
                    name={direction.icon}
                    size={24}
                    color="white"
                  />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DriveTimeSelector({ value, onChange }) {
  return (
    <View className="mt-5">
      <Text className="mb-2 ml-2 text-sm font-semibold text-white">
        How long are you willing to travel?
      </Text>

      <View className="flex-row flex-wrap gap-3">
        {DRIVE_TIME_OPTIONS.map((minutes) => {
          const selected = value === minutes;

          return (
            <Pressable
              key={minutes}
              onPress={() => onChange(minutes)}
              className={`rounded-full border px-4 py-3 ${
                selected
                  ? "border-emerald-800 bg-white"
                  : "border-white/20 bg-white/10"
              }`}
            >
              <Text
                className={`font-semibold ${
                  selected ? "text-emerald-950" : "text-white"
                }`}
              >
                {minutes < 60
                  ? `${minutes} min`
                  : `${minutes / 60} hr${minutes > 60 ? "s" : ""}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const Explore = () => {
  const router = useRouter();

  const {
    startingAddress,
    startingCoords,
    selectedTravelMode,
    numStops,
    selectedPoiTypes,

    setStartingAddress,
    setStartingCoords,
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
  const [selectedDirection, setSelectedDirection] = useState("north");
  const [driveTimeMinutes, setDriveTimeMinutes] = useState(60);
  const [buildingAdventure, setBuildingAdventure] = useState(false);
  const [showExplorePaywall, setShowExplorePaywall] = useState(false);

  const canUseExplore = canUseFeature(
    subscriptionTier,
    FEATURES.EXPLORE,
  );
  const explorePremiumCopy = getPremiumFeatureMessage(FEATURES.EXPLORE);

  useEffect(() => {
    if (selectedTravelMode === "transit") {
      setSelectedTravelMode("driving");
    }
  }, [selectedTravelMode, setSelectedTravelMode]);

  const selectedDirectionConfig = useMemo(() => {
    return (
      DIRECTIONS.find((direction) => direction.key === selectedDirection) ??
      DIRECTIONS[0]
    );
  }, [selectedDirection]);

  const estimatedStraightLineDistanceKm = useMemo(() => {
    const selectedAverageSpeedKmh =
      AVERAGE_SPEED_BY_MODE_KMH[selectedTravelMode] ??
      AVERAGE_SPEED_BY_MODE_KMH.driving;
    const estimatedTravelDistanceKm =
      (driveTimeMinutes / 60) * selectedAverageSpeedKmh;

    return estimatedTravelDistanceKm * STRAIGHT_LINE_ROUTE_FACTOR;
  }, [driveTimeMinutes, selectedTravelMode]);

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
      logger.log("Explore location error:", error);

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

  async function handleFindAdventure() {
    if (!canUseExplore) {
      setShowExplorePaywall(true);
      return;
    }

    try {
      setBuildingAdventure(true);

      let finalStartCoords = startingCoords;

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

      const adventureDestination = await findBestExploreDestination({
        startCoords: finalStartCoords,
        directionConfig: selectedDirectionConfig,
        targetTravelTimeMinutes: driveTimeMinutes,
        estimatedStraightLineDistanceKm,
        travelMode: selectedTravelMode,
      });

      if (!adventureDestination?.coords) {
        Alert.alert(
          "Adventure route error",
          `Unable to find a routable ${selectedDirectionConfig.label.toLowerCase()} adventure from this starting point. Try a shorter travel time or a different direction.`,
        );
        return;
      }

      const adventureDestinationCoords = adventureDestination.coords;

      const matchedMinutes =
        typeof adventureDestination.durationSeconds === "number"
          ? Math.round(adventureDestination.durationSeconds / 60)
          : driveTimeMinutes;

      const destinationLabel = `${selectedDirectionConfig.label} adventure · about ${matchedMinutes} min from ${
        startingAddress || "your start"
      }`;

      clearActiveSavedTrip();
      setActiveRouteRequest({
        source: "explore",
        startingAddress,
        destinationAddress: destinationLabel,
        startingCoords: finalStartCoords,
        destinationCoords: adventureDestinationCoords,
        travelMode: selectedTravelMode,
        numStops,
        selectedPoiTypes,
      });

      router.push({
        pathname: "/(screens)/route",
        params: {
          returnTo: "/(tabs)/explore",
        },
      });
    } finally {
      setBuildingAdventure(false);
    }
  }

  function handleReset() {
    resetRoutePlanner();
    setUseCurrentLocation(false);
    setSelectedTravelMode("driving");
    setSelectedDirection("north");
    setDriveTimeMinutes(60);
  }

  if (buildingAdventure) {
    return (
      <RouteBuildingScreen
        title="Finding your adventure"
        message="Searching for a destination that matches your direction and travel time."
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
          title="Explore"
          description="Pick a starting point, choose a direction, set a travel-time budget, and Wander North will build a route with possible stops along the way."
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

        <View className="mt-5">
          <Text className="mb-2 ml-2 text-sm font-semibold text-white">
            Choose how you are traveling
          </Text>

          <WNTransportSelector
            value={selectedTravelMode}
            onChange={setSelectedTravelMode}
            options={EXPLORE_TRANSPORT_OPTIONS}
          />

          <Text className="ml-2 mt-1 text-xs text-white/70">
            Transit adventures are unavailable until a destination is known.
          </Text>
        </View>

        <DirectionSelector
          value={selectedDirection}
          onChange={setSelectedDirection}
        />

        <DriveTimeSelector
          value={driveTimeMinutes}
          onChange={setDriveTimeMinutes}
        />

        <View className="mt-5 rounded-2xl bg-white/10 p-4">
          <Text className="text-sm font-semibold text-white">
            Estimated explore target
          </Text>

          <Text className="mt-1 text-sm leading-5 text-white/75">
            {selectedDirectionConfig.label}, about {driveTimeMinutes} minutes
            away. The generated destination is roughly{" "}
            {estimatedStraightLineDistanceKm.toFixed(1)} km as the crow flies,
            then Google builds the real route.
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

        {showExplorePaywall && (
          <PremiumFeatureCard
            title={explorePremiumCopy.title}
            message={explorePremiumCopy.message}
            onClose={() => setShowExplorePaywall(false)}
            showDevToggle
            onEnablePremiumForTesting={() => {
              setPremiumForTesting(true);
              setShowExplorePaywall(false);
            }}
          />
        )}

        <View className="mt-8 gap-4">
          <WNButton
            label={
              buildingAdventure ? "Building Adventure..." : "Find Adventure"
            }
            onPress={handleFindAdventure}
            disabled={buildingAdventure || locating}
            variant="primary"
          />

          <WNButton
            label="Reset Explore"
            onPress={handleReset}
            variant="secondary"
          />
        </View>

        <PremiumStatusDevCard />
      </View>

    </ScrollView>
  );
};

export default Explore;
