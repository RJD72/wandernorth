import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import polyline from "@mapbox/polyline";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MapComponent from "../components/MapComponent";
import RouteSummaryCard from "../components/RouteSummaryCard";
import SuggestedStopsList from "../components/SuggestedStopsList";
import WNButton from "../components/WNButton";
import SelectedStopsList from "../components/SelectedStopsList";
import AddCustomStopCard from "../components/AddCustomStopCard";
import PremiumFeatureCard from "../components/PremiumFeatureCard";

import { buildGoogleRoute } from "../services/googleRoutes";
import {
  fetchPoisNearRoutePoints,
  normalizeSelectedPoiTypes,
} from "../services/poiService";

import { useRoutePlannerStore } from "../store/useRoutePlannerStore";
import { useEntitlementStore } from "../store/useEntitlementStore";
import {
  FEATURES,
  getFeatureLimits,
  getPremiumFeatureMessage,
} from "../config/featureAccess";

import { getSamplePointsAlongRoute } from "../utils/routeSampling";
import { attachRoutePositionToPois } from "../utils/routeDistance";
import { chooseDistributedStops } from "../utils/poiScoring";
import { isValidCoords } from "../utils/coordinates";
import { getStopCoords, getStopId } from "../utils/stopUtils";
import { MAX_DISTANCE_FROM_ROUTE_METERS } from "../utils/poiDistancePolicy";

const EMPTY_SELECTED_POI_TYPES = [];

function isCustomStop(stop) {
  return (
    stop?.source === "custom" ||
    stop?.category === "Custom Stop" ||
    String(stop?.id || "").startsWith("custom-")
  );
}

function getCustomStopCount(stops = []) {
  return stops.filter(isCustomStop).length;
}

function formatCoordinatesForGoogleMaps(coords) {
  return `${coords.latitude},${coords.longitude}`;
}

function buildGoogleMapsDirectionsUrl({
  origin,
  destination,
  selectedStops = [],
  travelMode,
}) {
  const sortedStops = [...selectedStops].sort((a, b) => {
    const aProgress = a.routeProgress ?? a.closestRouteIndex ?? 0;
    const bProgress = b.routeProgress ?? b.closestRouteIndex ?? 0;

    return aProgress - bProgress;
  });

  const waypoints = sortedStops
    .map(getStopCoords)
    .filter(Boolean)
    .map(formatCoordinatesForGoogleMaps)
    .join("|");

  const queryParams = [
    "api=1",
    `origin=${encodeURIComponent(formatCoordinatesForGoogleMaps(origin))}`,
    `destination=${encodeURIComponent(
      formatCoordinatesForGoogleMaps(destination),
    )}`,
    `travelmode=${encodeURIComponent(travelMode)}`,
  ];

  if (waypoints) {
    queryParams.push(`waypoints=${encodeURIComponent(waypoints)}`);
  }

  return `https://www.google.com/maps/dir/?${queryParams.join("&")}`;
}

function formatCategoryTitle(category) {
  const categoryLabels = {
    restaurant: "Restaurants",
    cafe: "Cafes",
    bar: "Bars",
    park: "Parks",
    museum: "Museums",
    lodging: "Hotels",
    gas_station: "Gas Stations",
    tourist_attraction: "Tourist Attractions",
  };

  if (!category) return "Other Stops";

  return (
    categoryLabels[category] ??
    String(category)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
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
  const [allRoutePois, setAllRoutePois] = useState([]);

  const [selectedStops, setSelectedStops] = useState([]);

  const [finalRouteData, setFinalRouteData] = useState(null);
  const [finalRouteLoading, setFinalRouteLoading] = useState(false);
  const [finalRouteError, setFinalRouteError] = useState(null);
  const [premiumGate, setPremiumGate] = useState(null);

  const { activeRouteRequest } = useRoutePlannerStore();
  const { subscriptionTier, setPremiumForTesting } = useEntitlementStore();
  const routeRequest = activeRouteRequest;
  const numStops = routeRequest?.numStops ?? 3;
  const parsedStopCount = Number(numStops);
  const noAutoStopsRequested =
    Number.isFinite(parsedStopCount) && parsedStopCount === 0;
  const selectedPoiTypes =
    routeRequest?.selectedPoiTypes ?? EMPTY_SELECTED_POI_TYPES;
  const featureLimits = getFeatureLimits(subscriptionTier);
  const maxSuggestedStops = featureLimits.maxSuggestedStops;
  const maxCustomStops = featureLimits.maxCustomStops;
  const moreStopsPremiumCopy = getPremiumFeatureMessage(
    FEATURES.MORE_AUTOMATIC_STOPS,
  );
  const customStopsPremiumCopy = getPremiumFeatureMessage(
    FEATURES.MULTIPLE_CUSTOM_STOPS,
  );

  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  function closePremiumGate() {
    setPremiumGate(null);
  }

  function enablePremiumForTesting() {
    setPremiumForTesting(true);
    setPremiumGate(null);
  }

  function isAtSelectedStopLimit(stops = []) {
    return stops.length >= maxSuggestedStops;
  }

  function handleEditRoute() {
    if (typeof returnTo === "string") {
      router.replace(returnTo);
      return;
    }

    router.replace("/(tabs)/navigate");
  }

  async function handleOpenInGoogleMaps() {
    const url = buildGoogleMapsDirectionsUrl({
      origin: routeData.parsedParams.startingCoords,
      destination: routeData.parsedParams.destinationCoords,
      selectedStops,
      travelMode: routeData.parsedParams.travelMode,
    });

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log("Open Google Maps error:", error);
    }
  }

  function toggleSelectedStop(stop) {
    const stopId = getStopId(stop);

    setSelectedStops((currentStops) => {
      const alreadySelected = currentStops.some((currentStop) => {
        return getStopId(currentStop) === stopId;
      });

      if (alreadySelected) {
        setFinalRouteData(null);
        setFinalRouteError(null);

        return currentStops.filter((currentStop) => {
          return getStopId(currentStop) !== stopId;
        });
      }

      if (isAtSelectedStopLimit(currentStops)) {
        setPremiumGate("moreStops");
        return currentStops;
      }

      setFinalRouteData(null);
      setFinalRouteError(null);

      return [...currentStops, stop];
    });
  }

  function removeAllSelectedStops() {
    setFinalRouteData(null);
    setFinalRouteError(null);
    setSelectedStops([]);
    setPremiumGate(null);
  }

  function handleAddCustomStop(customStop) {
    if (!customStop) return;

    if (!routeData?.routeCoords?.length) {
      setFinalRouteError("Route data is not ready yet. Please try again");
      return;
    }

    const currentCustomStopCount = getCustomStopCount(selectedStops);

    if (currentCustomStopCount >= maxCustomStops) {
      setPremiumGate("customStops");
      return;
    }

    if (isAtSelectedStopLimit(selectedStops)) {
      setPremiumGate("moreStops");
      return;
    }

    const [routeAwareCustomStop] = attachRoutePositionToPois(
      [customStop],
      routeData.routeCoords,
    );

    setFinalRouteData(null);
    setFinalRouteError(null);

    setSelectedStops((currentStops) => {
      return [...currentStops, routeAwareCustomStop ?? customStop];
    });
  }

  const visibleSuggestedStops = suggestedStops.filter((stop) => {
    const stopId = getStopId(stop);

    return !selectedStops.some((selectedStop) => {
      return getStopId(selectedStop) === stopId;
    });
  });

  const visibleAllRoutePois = allRoutePois.filter((stop) => {
    const stopId = getStopId(stop);

    const alreadySelected = selectedStops.some((selectedStop) => {
      return getStopId(selectedStop) === stopId;
    });

    const alreadySuggested = suggestedStops.some((suggestedStop) => {
      return getStopId(suggestedStop) === stopId;
    });

    return !alreadySelected && !alreadySuggested;
  });

  const groupedVisibleAllRoutePois = Object.entries(
    visibleAllRoutePois.reduce((groups, stop) => {
      const category = stop.category ?? "other";

      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(stop);
      return groups;
    }, {}),
  )
    .map(([category, stops]) => ({
      category,
      title: formatCategoryTitle(category),
      stops: [...stops].sort((a, b) => {
        const aProgress = a.routeProgress ?? a.closestRouteIndex ?? 999;
        const bProgress = b.routeProgress ?? b.closestRouteIndex ?? 999;

        return aProgress - bProgress;
      }),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

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
        setAllRoutePois([]);
        setPremiumGate(null);

        // Guard clause: route computation requires both endpoints.
        // If either is missing, we show a user-friendly error and exit early.
        if (
          !routeRequest ||
          !isValidCoords(routeRequest.startingCoords) ||
          !isValidCoords(routeRequest.destinationCoords)
        ) {
          if (!isCurrent) return;

          setError(
            "Missing route details. Please go back and enter your starting point and destination.",
          );
          return;
        }

        // Build a single params object to keep service calls explicit and easy to log/debug.
        const parsedParams = { ...routeRequest };

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
  }, [routeRequest]);

  // Effect 2: Load POIs whenever a route is available.
  // Current implementation is a placeholder so the screen structure is ready
  // for a future real POI service integration.
  useEffect(() => {
    let isCurrent = true;

    async function loadSuggestedStops() {
      // Skip POI work until route geometry exists.
      if (!routeData?.routeCoords?.length) {
        setSuggestedStops([]);
        setAllRoutePois([]);
        setPoiError(null);
        setPoiLoading(false);
        return;
      }

      try {
        setPoiLoading(true);
        setPoiError(null);
        setSuggestedStops([]);
        setAllRoutePois([]);

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
          // Only include POIs within the accepted distance of the route.
          return (
            poi.closestRouteDistanceMeters <= MAX_DISTANCE_FROM_ROUTE_METERS
          );
        });

        console.log(
          "[route] Nearby POIs by progress:",
          nearbyRoutePois
            .map((poi) => ({
              name: poi.name,
              category: poi.category,
              routeProgress: poi.routeProgress,
              closestRouteIndex: poi.closestRouteIndex,
              distanceOffRoute: poi.closestRouteDistanceMeters,
              rating: poi.rating,
              reviews: poi.userRatingCount,
            }))
            .sort((a, b) => {
              const aProgress = a.routeProgress ?? a.closestRouteIndex ?? 0;
              const bProgress = b.routeProgress ?? b.closestRouteIndex ?? 0;
              return aProgress - bProgress;
            }),
        );

        setAllRoutePois(nearbyRoutePois);

        console.log("[route] All route POIs cached:", nearbyRoutePois.length);

        const distributedStops = chooseDistributedStops(
          nearbyRoutePois,
          numStops,
          {
            maxDistanceFromRouteMeters: MAX_DISTANCE_FROM_ROUTE_METERS,
            preferredCategories:
              normalizeSelectedPoiTypes(selectedPoiTypes),
          },
        );

        setSuggestedStops(distributedStops);

        console.log("[route] POI candidates:", nearbyRoutePois.length);
        console.log("[route] Distributed POIs:", distributedStops.length);
        console.log(
          "[route] Distributed POI details:",
          distributedStops.map((stop) => ({
            name: stop.name,
            category: stop.category,
            distanceOffRoute: stop.closestRouteDistanceMeters,
            routeProgress: stop.routeProgress,
            closestRouteIndex: stop.closestRouteIndex,
            rating: stop.rating,
            reviews: stop.userRatingCount,
          })),
        );
      } catch (error) {
        if (!isCurrent) return;

        console.log("Suggested stops error:", error);
        setSuggestedStops([]);
        setAllRoutePois([]);
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

    if (selectedStops.length > maxSuggestedStops) {
      setPremiumGate("moreStops");
      return;
    }

    if (getCustomStopCount(selectedStops) > maxCustomStops) {
      setPremiumGate("customStops");
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
  const mapMarkers = selectedStops;
  const routeMidpoint =
    routeData?.routeCoords?.[
      Math.floor((routeData?.routeCoords?.length ?? 0) / 2)
    ];
  const customStopLocationBias = routeMidpoint
    ? {
        latitude: routeMidpoint.latitude,
        longitude: routeMidpoint.longitude,
        radiusMeters: 50000,
      }
    : null;
  const customStopSearchPoints = routeData?.routeCoords?.length
    ? getSamplePointsAlongRoute(routeData.routeCoords)
    : [];

  // Render branch 1: full-page loader while initial route call runs.
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-50 px-6">
        <ActivityIndicator size="large" color="#1D3B2A" />
        <Text className="mt-4 text-lg text-emerald-950">
          Building your route...
        </Text>
      </View>
    );
  }

  // Render branch 2: full-page error if route could not be built.
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-50 px-6">
        <Text className="text-lg text-red-600">{error}</Text>
      </View>
    );
  }

  if (!routeData) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-50 px-6">
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
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-2 py-8"
        nestedScrollEnabled
        contentContainerStyle={{
          paddingBottom: selectedStops.length > 0 ? 150 : 90,
        }}
      >
        {/* Map panel showing the computed route polyline and any suggested stop markers. */}
        <View className=" h-[380px] w-full overflow-hidden">
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

        {finalRouteData && (
          <View className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
            <Text className="text-xl font-bold text-emerald-950">
              Final route ready
            </Text>

            <Text className="mt-2 text-base text-stone-600">
              Your selected stops have been added to the route.
            </Text>

            <Text className="mt-1 text-sm font-semibold text-emerald-950">
              {selectedStops.length} selected{" "}
              {selectedStops.length === 1 ? "stop" : "stops"} included.
            </Text>
          </View>
        )}

        <RouteSummaryCard
          startingAddress={routeData.parsedParams.startingAddress}
          destinationAddress={routeData.parsedParams.destinationAddress}
          travelMode={routeData.parsedParams.travelMode}
          distanceText={displayedRouteData.distanceText}
          durationText={displayedRouteData.durationText}
          numStops={numStops}
          selectedStopCount={selectedStops.length}
          selectedPoiTypes={selectedPoiTypes}
        />

        <SelectedStopsList
          selectedStops={selectedStops}
          onRemoveStop={toggleSelectedStop}
          onRemoveAllStops={removeAllSelectedStops}
          emptyMessage={
            noAutoStopsRequested
              ? "No stops selected yet. Search for a custom stop below to add one manually."
              : "No stops selected yet. Add suggested or custom stops to customize your route."
          }
        />

        {premiumGate === "moreStops" && (
          <PremiumFeatureCard
            title={moreStopsPremiumCopy.title}
            message={moreStopsPremiumCopy.message}
            onClose={closePremiumGate}
            showDevToggle
            onEnablePremiumForTesting={enablePremiumForTesting}
          />
        )}

        {premiumGate === "customStops" && (
          <PremiumFeatureCard
            title={customStopsPremiumCopy.title}
            message={customStopsPremiumCopy.message}
            onClose={closePremiumGate}
            showDevToggle
            onEnablePremiumForTesting={enablePremiumForTesting}
          />
        )}

        <AddCustomStopCard
          onAddStop={handleAddCustomStop}
          locationBias={customStopLocationBias}
          customSearchPoints={customStopSearchPoints}
        />

        {noAutoStopsRequested && (
          <View className="my-4 rounded-2xl bg-white p-4 shadow-sm">
            <Text className="text-xl font-bold text-emerald-950">
              No automatic stops requested
            </Text>

            <Text className="mt-2 text-stone-600">
              Wander North will not suggest stops for this route, but you can
              still add your own custom stops.
            </Text>
          </View>
        )}

        {!noAutoStopsRequested && (
          <>
            <SuggestedStopsList
              title="Top Suggestions"
              emptyMessage="No top suggestions found for this route."
              allSelectedMessage="All top suggestions have been selected"
              poiLoading={poiLoading}
              poiError={poiError}
              suggestedStops={visibleSuggestedStops}
              totalSuggestedStopCount={suggestedStops.length}
              selectedStops={selectedStops}
              onToggleStop={toggleSelectedStop}
            />

            <View className="mt-4 px-1">
              <Text className="text-2xl font-bold text-white">
                More Stops Along Route
              </Text>

              <Text className="mt-1 text-sm text-white">
                Browse additional stops by category.
              </Text>
            </View>

            {!poiLoading && groupedVisibleAllRoutePois.length === 0 && (
              <View className="my-4 rounded-2xl bg-white p-4 shadow-sm">
                <Text className="text-stone-600">
                  No additional stops available for this route.
                </Text>
              </View>
            )}

            {!poiLoading &&
              groupedVisibleAllRoutePois.map((group) => (
                <SuggestedStopsList
                  key={group.category}
                  title={group.title}
                  emptyMessage={`No ${group.title.toLowerCase()} found for this route.`}
                  allSelectedMessage={`All ${group.title.toLowerCase()} have been selected.`}
                  poiLoading={false}
                  poiError={null}
                  suggestedStops={group.stops}
                  totalSuggestedStopCount={group.stops.length}
                  selectedStops={selectedStops}
                  onToggleStop={toggleSelectedStop}
                  collapsible
                  defaultCollapsed
                  stopCountLabel={`${group.stops.length} stop${group.stops.length === 1 ? "" : "s"}`}
                />
              ))}
          </>
        )}
      </ScrollView>

      <View
        className="border-t border-stone-200 bg-white px-4 pt-3 shadow-lg"
        style={{ paddingBottom: Math.max(insets.bottom + 16, 24) }}
      >
        {finalRouteError && (
          <Text className="mb-2 text-sm text-red-600">{finalRouteError}</Text>
        )}

        {finalRouteData && (
          <View className="mb-3">
            <WNButton
              label="Open in Google Maps"
              onPress={handleOpenInGoogleMaps}
            />
          </View>
        )}

        {selectedStops.length > 0 && (
          <WNButton
            label={
              finalRouteLoading
                ? "Building Final Route..."
                : finalRouteData
                  ? "Rebuild Final Route"
                  : "Build Final Route"
            }
            onPress={handleBuildFinalRoute}
            disabled={finalRouteLoading}
          />
        )}

        <View className={selectedStops.length > 0 ? "mt-3" : ""}>
          <WNButton
            label="Edit Route"
            onPress={handleEditRoute}
            variant="secondary"
          />
        </View>
      </View>
    </View>
  );
};

export default Route;
