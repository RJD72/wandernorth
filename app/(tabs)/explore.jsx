import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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

import { buildGoogleRoute } from "../services/googleRoutes";

import { useRoutePlannerStore } from "../store/useRoutePlannerStore";

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

const AVERAGE_DRIVE_SPEED_KMH = 70;

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
    console.log("Explore geocode error:", error);
    return null;
  }
}

function parseGoogleDurationSeconds(durationString) {
  if (typeof durationString !== "string") return null;

  const seconds = Number(durationString.replace("s", ""));

  return Number.isFinite(seconds) ? seconds : null;
}

function getExploreDestinationCandidates({
  startCoords,
  bearingDegrees,
  baseDistanceKm,
}) {
  /**
   * Explore should mean "north-ish", "south-ish", etc.
   *
   * If exact north lands in water or wilderness, we try slight angles around it.
   */
  const bearingOffsets = [0, -15, 15, -30, 30, -45, 45, -60, 60, -75, 75];

  /**
   * For long Explore trips, especially around lakes, we need to test farther
   * distances. A 3-hour route may require a destination much farther away than
   * the first straight-line estimate.
   */
  const distanceMultipliers = [1, 0.85, 0.7, 1.15, 1.3, 1.45, 1.6];

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

  return candidates;
}

function getSmallestBearingDifferenceDegrees(a, b) {
  // Todo: stop prettier from adding extra parentheses around % 360 - 180
  const difference = Math.abs(((((a - b) % 360) + 540) % 360) - 180);

  return difference;
}

function getAcceptableDurationDeltaSeconds(targetDriveTimeMinutes) {
  if (targetDriveTimeMinutes <= 45) return 8 * 60;
  if (targetDriveTimeMinutes <= 90) return 12 * 60;
  if (targetDriveTimeMinutes <= 120) return 15 * 60;

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
  targetDriveTimeMinutes,
  estimatedStraightLineDistanceKm,
}) {
  const targetDurationSeconds = targetDriveTimeMinutes * 60;

  const candidates = getExploreDestinationCandidates({
    startCoords,
    bearingDegrees: directionConfig.bearingDegrees,
    baseDistanceKm: estimatedStraightLineDistanceKm,
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
        travelMode: "driving",
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

      console.log("[Explore] Candidate route succeeded:", {
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
        targetDriveTimeMinutes,
      );

      if (
        durationDeltaSeconds <= acceptableDurationDeltaSeconds &&
        bearingDifference <= 30
      ) {
        return successfulCandidate;
      }
    } catch (error) {
      console.log("[Explore] Candidate route failed:", {
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
   * the requested drive time.
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
 * - Estimated road distance at 70 km/h is 70 km.
 * - Straight-line target becomes 70 * 0.65 = 45.5 km.
 *
 * This gives Google Routes enough space to create a real road route without
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

function isValidCoords(coords) {
  return (
    coords &&
    typeof coords.latitude === "number" &&
    typeof coords.longitude === "number" &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude)
  );
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
        How long are you willing to drive?
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
  const [selectedDirection, setSelectedDirection] = useState("north");
  const [driveTimeMinutes, setDriveTimeMinutes] = useState(60);
  const [buildingAdventure, setBuildingAdventure] = useState(false);

  const selectedDirectionConfig = useMemo(() => {
    return (
      DIRECTIONS.find((direction) => direction.key === selectedDirection) ??
      DIRECTIONS[0]
    );
  }, [selectedDirection]);

  const estimatedStraightLineDistanceKm = useMemo(() => {
    const estimatedRoadDistanceKm =
      (driveTimeMinutes / 60) * AVERAGE_DRIVE_SPEED_KMH;

    return estimatedRoadDistanceKm * STRAIGHT_LINE_ROUTE_FACTOR;
  }, [driveTimeMinutes]);

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
      console.log("Explore location error:", error);

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
        targetDriveTimeMinutes: driveTimeMinutes,
        estimatedStraightLineDistanceKm,
      });

      if (!adventureDestination?.coords) {
        Alert.alert(
          "Adventure route error",
          `Unable to find a routable ${selectedDirectionConfig.label.toLowerCase()} adventure from this starting point. Try a shorter drive time or a different direction.`,
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

      setDestinationAddress(destinationLabel);
      setDestinationCoords(adventureDestinationCoords);

      setSelectedTravelMode("driving");

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
    setSelectedDirection("north");
    setDriveTimeMinutes(60);
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="px-2 pt-4">
        <View className="mb-5 rounded-3xl bg-white/10 px-4 py-5">
          <Text className="text-3xl font-bold text-white">Explore</Text>

          <Text className="mt-2 text-base leading-6 text-white/80">
            Pick a starting point, choose a direction, set a drive-time budget,
            and Wander North will build a route with possible stops along the
            way.
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
            then Google builds the real road route.
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
      </View>
    </ScrollView>
  );
};

export default Explore;
