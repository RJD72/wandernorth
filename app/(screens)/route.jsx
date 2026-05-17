import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import polyline from "@mapbox/polyline";

import MapComponent from "../components/MapComponent";
import RouteSummaryCard from "../components/RouteSummaryCard";
import SuggestedStopsList from "../components/SuggestedStopsList";
import { buildGoogleRoute } from "../services/googleRoutes";
import { fetchPoisNearRoutePoints } from "../services/poiService";
import { useRoutePlannerStore } from "../store/useRoutePlannerStore";
import { getSamplePointsAlongRoute } from "../utils/routeSampling";
import { attachRoutePositionToPois } from "../utils/routeDistance";
import WNButton from "../components/WNButton";
import SelectedStopsList from "../components/SelectedStopsList";

function getStopId(stop) {
  return (
    stop.id ??
    stop.place_id ??
    stop.fsq_id ??
    stop.properties?.place_id ??
    stop.properties?.id ??
    stop.name
  );
}

function getStopCoords(stop) {
  if (!stop) return null;

  const latitude =
    stop.latitude ?? stop.location?.latitude ?? stop.location?.lat;
  const longitude =
    stop.longitude ?? stop.location?.longitude ?? stop.location?.lng;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return { latitude, longitude };
}

const Route = () => {
  // Primary route request lifecycle state.
  // - loading controls the initial screen state while route data is being built.
  // - routeData stores the normalized route payload used by the map and summary card.
  // - error stores route-level failures (missing inputs, API failures, parsing issues).
  const [loading, setLoading] = useState(true);
  const [routeData, setRouteData] = useState(null);
  const [error, setError] = useState(null);

  // Secondary state for POI (points of interest) suggestions that are loaded
  // after a route is successfully available.
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiError, setPoiError] = useState(null);
  const [suggestedStops, setSuggestedStops] = useState([]);

  const [selectedStops, setSelectedStops] = useState([]);

  const [finalRouteData, setFinalRouteData] = useState(null);
  const [finalRouteLoading, setFinalRouteLoading] = useState(false);
  const [finalRouteError, setFinalRouteError] = useState(null);

  // Route planning inputs are sourced from a shared Zustand store.
  // This screen assumes those values were collected on previous steps.
  const {
    startingAddress,
    destinationAddress,
    startingCoords,
    destinationCoords,
    selectedTravelMode,
    numStops,
    selectedPoiTypes,
  } = useRoutePlannerStore();

  const router = useRouter();

  const isValidCoord = (coord) => {
    return (
      coord &&
      typeof coord.latitude === "number" &&
      typeof coord.longitude === "number" &&
      Number.isFinite(coord.latitude) &&
      Number.isFinite(coord.longitude)
    );
  };

  function toggleSelectedStop(stop) {
    const stopId = getStopId(stop);

    setFinalRouteData(null);
    setFinalRouteError(null);

    setSelectedStops((currentStops) => {
      const alreadySelected = currentStops.some((currentStop) => {
        return getStopId(currentStop) === stopId;
      });

      if (alreadySelected) {
        return currentStops.filter((currentStop) => {
          return getStopId(currentStop) !== stopId;
        });
      }

      return [...currentStops, stop];
    });
  }

  const visibleSuggestedStops = suggestedStops.filter((stop) => {
    const stopId = getStopId(stop);

    return !selectedStops.some((selectedStop) => {
      return getStopId(selectedStop) === stopId;
    });
  });

  // Effect 1: Build or rebuild the route whenever inputs change.
  // Responsibility:
  // 1) Validate required coordinates.
  // 2) Call routing service with normalized params.
  // 3) Decode polyline so the map can render line segments.
  // 4) Save both API output and original inputs in routeData for display + traceability.
  useEffect(() => {
    let isCurrent = true; // Flag to prevent state updates if component unmounts during async calls.

    async function loadRoute() {
      try {
        setLoading(true);
        setError(null);
        setRouteData(null);
        setSuggestedStops([]);
        setSelectedStops([]);

        // Guard clause: route computation requires both endpoints.
        // If either is missing, we show a user-friendly error and exit early.
        if (!isValidCoord(startingCoords) || !isValidCoord(destinationCoords)) {
          if (!isCurrent) return;

          setError(
            "Missing route details. Please go back and enter your starting point and destination.",
          );
          return;
        }

        // Build a single params object to keep service calls explicit and easy to log/debug.
        const parsedParams = {
          startingAddress,
          destinationAddress,
          startingCoords,
          destinationCoords,
          travelMode: selectedTravelMode,
          numStops,
          selectedPoiTypes,
        };

        const result = await buildGoogleRoute(parsedParams);

        if (!isCurrent) return;

        // Google returns an encoded polyline string; decode into [{ latitude, longitude }]
        // to match what the map component expects.
        const routeCoords = polyline
          .decode(result.encodedPolyline)
          .map(([latitude, longitude]) => ({
            latitude,
            longitude,
          }));

        // Store the merged payload so downstream UI can read everything from one place.
        setRouteData({
          ...result,
          routeCoords,
          parsedParams,
        });
      } catch (error) {
        if (!isCurrent) return;
        console.log("Route build error", error);
        setError("Failed to build route. Please try again.");
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    }

    loadRoute();
    return () => {
      isCurrent = false;
    };
  }, [
    startingAddress,
    destinationAddress,
    startingCoords,
    destinationCoords,
    selectedTravelMode,
    numStops,
    selectedPoiTypes,
  ]);

  // Effect 2: Load POIs whenever a route is available.
  // Current implementation is a placeholder so the screen structure is ready
  // for a future real POI service integration.
  useEffect(() => {
    let isCurrent = true;

    async function loadSuggestedStops() {
      // Skip POI work until route geometry exists.
      if (!routeData?.routeCoords?.length) {
        setSuggestedStops([]);
        setPoiError(null);
        setPoiLoading(false);
        return;
      }

      try {
        setPoiLoading(true);
        setPoiError(null);
        setSuggestedStops([]);

        const routeSamplePoints = getSamplePointsAlongRoute(
          routeData.routeCoords,
        );

        const pois = await fetchPoisNearRoutePoints({
          // The POI service is designed to accept multiple route points and return a consolidated list of nearby POIs, which is more efficient than making separate calls for each point.
          routePoints: routeSamplePoints, // Array of numbers representing strategic points along the route for optimized POI searching.
          selectedPoiTypes, // Array of user-selected POI categories (e.g., ["restaurant", "park"]) that will be mapped to Google Place types within the service.
          numStops, // The desired number of stops, which can be used by the service to prioritize or limit results. This value is passed as-is and can be a number or numeric string; the service should handle coercion and validation.
        });

        if (!isCurrent) return;

        const routeAwarePois = attachRoutePositionToPois(
          // This function enriches each POI with metadata about its proximity and position along the route, which is essential for sorting and filtering POIs based on how relevant they are to the user's journey.
          pois,
          routeData.routeCoords,
        );

        const nearbyRoutePois = routeAwarePois.filter((poi) => {
          if (typeof poi.closestRouteDistanceMeters !== "number") return false; // Exclude POIs with unknown distance to route.
          return poi.closestRouteDistanceMeters <= 3000; // Only include POIs within 3 km of the route.
        });

        const parsedStopCount = Number(numStops);
        const stopLimit = Number.isFinite(parsedStopCount)
          ? Math.max(0, parsedStopCount)
          : 3; // Default to 3 stops if numStops is invalid.
        setSuggestedStops(nearbyRoutePois.slice(0, stopLimit)); // Take top N stops, defaulting to 3 if numStops is invalid.
      } catch (error) {
        if (!isCurrent) return;

        console.log("Suggested stops error:", error);
        setPoiError("Unable to load suggested stops.");
      } finally {
        if (isCurrent) {
          setPoiLoading(false);
        }
      }
    }
    loadSuggestedStops();
    return () => {
      isCurrent = false;
    };
  }, [routeData, selectedPoiTypes, numStops]);

  async function handleBuildFinalRoute() {
    if (selectedStops.length === 0) {
      setFinalRouteError(
        "Choose at least one stop before building the final route.",
      );
      return;
    }

    // Sort selected stops by their position along the original route before
    // sending them to Google as waypoints.
    //
    // Without this, Google receives stops in the order the user tapped them.
    // Example: Stop 3 → Stop 1 → Stop 2.
    // That can create a final route that backtracks.
    const sortedSelectedStops = [...selectedStops].sort((a, b) => {
      const aProgress = a.routeProgress ?? a.closestRouteIndex ?? 0;
      const bProgress = b.routeProgress ?? b.closestRouteIndex ?? 0;

      return aProgress - bProgress;
    });

    // Convert sorted stops into waypoint coordinates for the final route request.
    const waypointCoords = sortedSelectedStops
      .map(getStopCoords)
      .filter(Boolean);

    if (waypointCoords.length !== selectedStops.length) {
      setFinalRouteError("One or more selected stops is missing coordinates.");
      return;
    }

    try {
      setFinalRouteLoading(true);
      setFinalRouteError(null);

      const result = await buildGoogleRoute({
        startingAddress: routeData.parsedParams.startingAddress,
        destinationAddress: routeData.parsedParams.destinationAddress,
        startingCoords: routeData.parsedParams.startingCoords,
        destinationCoords: routeData.parsedParams.destinationCoords,
        travelMode: routeData.parsedParams.travelMode,
        selectedPoiTypes: routeData.parsedParams.selectedPoiTypes,
        numStops: selectedStops.length,
        waypoints: waypointCoords,
      });

      const routeCoords = polyline
        .decode(result.encodedPolyline)
        .map(([latitude, longitude]) => ({
          latitude,
          longitude,
        }));

      setFinalRouteData({
        ...result,
        routeCoords,
        selectedStops,
      });
    } catch (error) {
      console.log("Final route build error:", error);
      setFinalRouteError("Failed to build final route with selected stops.");
    } finally {
      setFinalRouteLoading(false);
    }
  }

  const displayedRouteData = finalRouteData ?? routeData;
  const mapMarkers = finalRouteData ? selectedStops : visibleSuggestedStops;

  // Render branch 1: full-page loader while initial route call runs.
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-wn-cream px-6">
        <ActivityIndicator size="large" color="#1D3B2A" />
        <Text className="mt-4 text-lg text-wn-darkGreen">
          Building your route...
        </Text>
      </View>
    );
  }

  // Render branch 2: full-page error if route could not be built.
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-wn-cream px-6">
        <Text className="text-lg text-red-600">{error}</Text>
      </View>
    );
  }

  if (!routeData) {
    return (
      <View className="flex-1 items-center justify-center bg-wn-cream px-6">
        <Text className="text-lg text-red-600">
          Route data is unavailable. Please go back and try again.
        </Text>
      </View>
    );
  }

  // Extract finalized route inputs from the saved params object.
  // This guarantees the map uses the exact values that generated routeData.
  const finalStartingCoords = routeData.parsedParams.startingCoords;
  const finalDestinationCoords = routeData.parsedParams.destinationCoords;
  const finalTravelMode = routeData.parsedParams.travelMode;

  // Main success view: route metrics, map visualization, route summary, and POI section.
  return (
    <ScrollView className="flex-1 bg-background px-2 py-8">
      {/* Map panel showing the computed route polyline and any suggested stop markers. */}
      <View className=" h-[480px] w-full overflow-hidden">
        <MapComponent
          startCoords={finalStartingCoords}
          destCoords={finalDestinationCoords}
          useCurrentLocation={false}
          travelRadius={0}
          mapMarkers={mapMarkers}
          selectedTravelMode={finalTravelMode}
          routeCoords={displayedRouteData.routeCoords}
        />
      </View>

      {/* RouteSummaryCard repeats key route configuration + output in a compact card. */}
      <View className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <RouteSummaryCard
          startingAddress={routeData.parsedParams.startingAddress}
          destinationAddress={routeData.parsedParams.destinationAddress}
          travelMode={routeData.parsedParams.travelMode}
          distanceText={displayedRouteData.distanceText}
          durationText={displayedRouteData.durationText}
          numStops={routeData.parsedParams.numStops}
          stopCount={suggestedStops.length}
          selectedStopCount={selectedStops.length}
          selectedPoiTypes={routeData.parsedParams.selectedPoiTypes}
        />
      </View>

      <SelectedStopsList
        selectedStops={selectedStops}
        onRemoveStop={toggleSelectedStop}
      />

      <SuggestedStopsList
        poiLoading={poiLoading}
        poiError={poiError}
        suggestedStops={visibleSuggestedStops}
        totalSuggestedStopCount={suggestedStops.length}
        selectedStops={selectedStops}
        onToggleStop={toggleSelectedStop}
      />

      <View className="mt-4 mb-2">
        <WNButton label="Edit Route" onPress={() => router.back()} />
      </View>

      {selectedStops.length > 0 && (
        <View className="mt-4 mb-10">
          <WNButton
            label={
              finalRouteLoading
                ? "Building Final Route..."
                : "Build Final Route"
            }
            onPress={handleBuildFinalRoute}
            disabled={finalRouteLoading}
          />

          {finalRouteError && (
            <Text className="mt-2 text-sm text-red-600">{finalRouteError}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
};

export default Route;
