import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import polyline from "@mapbox/polyline";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MapComponent from "../components/MapComponent";
import RouteSummaryCard from "../components/RouteSummaryCard";
import SuggestedStopsList from "../components/SuggestedStopsList";
import WNButton from "../components/WNButton";
import SelectedStopsList from "../components/SelectedStopsList";
import AddCustomStopCard from "../components/AddCustomStopCard";
import PremiumFeatureCard from "../components/PremiumFeatureCard";
import CollapsibleSection from "../components/CollapsibleSection";
import DemoDataIndicator from "../components/DemoDataIndicator";

import { buildRoute } from "../services/routeService";
import {
  fetchPoisForRoute,
  getLastPoiResultMetadata,
} from "../services/poiSearchService";

import { useRoutePlannerStore } from "../store/useRoutePlannerStore";
import { useEntitlementStore } from "../store/useEntitlementStore";
import { useSavedTripsStore } from "../store/useSavedTripsStore";
import {
  FEATURES,
  getFeatureLimits,
  getPremiumFeatureMessage,
} from "../config/featureAccess";
import {
  getCanonicalPoiCategoryIds,
  getPoiCategoryLabelById,
} from "../config/poiCategories";

import {
  getCustomStopSearchPoints,
  getRoutePointAtDistancePercentage,
  getSamplePointsAlongRoute,
} from "../utils/routeSampling";
import { attachRoutePositionToPois } from "../utils/routeDistance";
import {
  buildGoogleMapsDirectionsUrl,
  MAX_GOOGLE_MAPS_WAYPOINTS,
  prepareStopsForRouteHandoff,
} from "../utils/routeHandoff";
import { chooseDistributedStops } from "../utils/poiScoring";
import { isValidCoords } from "../utils/coordinates";
import { getStopId } from "../utils/stopUtils";
import { MAX_DISTANCE_FROM_ROUTE_METERS } from "../utils/poiDistancePolicy";
import { logger } from "../utils/logger";
import { getExternalApiUserMessage } from "../services/externalApiRequest";

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

function buildSavedTripTitle(routeParams) {
  const startingAddress = routeParams?.startingAddress || "Start";
  const destinationAddress = routeParams?.destinationAddress || "Destination";

  return `${startingAddress} to ${destinationAddress}`;
}

function formatCategoryTitle(category) {
  if (!category) return "Other Stops";

  return getPoiCategoryLabelById(category);
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
  const [poiNotice, setPoiNotice] = useState(null);
  const [suggestedStops, setSuggestedStops] = useState([]);
  const [allRoutePois, setAllRoutePois] = useState([]);
  const lastPoiRouteIdentityRef = useRef(null);

  const [selectedStops, setSelectedStops] = useState([]);

  const [routeActionError, setRouteActionError] = useState(null);
  const [premiumGate, setPremiumGate] = useState(null);
  const [savingTrip, setSavingTrip] = useState(false);
  const [savedTripMessage, setSavedTripMessage] = useState(null);
  const [saveTripError, setSaveTripError] = useState(null);
  const [hasUnsavedSavedTripChanges, setHasUnsavedSavedTripChanges] =
    useState(false);

  const router = useRouter();
  const { returnTo, savedTripId, mode } = useLocalSearchParams();
  const normalizedSavedTripId = Array.isArray(savedTripId)
    ? savedTripId[0]
    : savedTripId;
  const { activeRouteRequest } = useRoutePlannerStore();
  const { subscriptionTier, setPremiumForTesting } = useEntitlementStore();
  const {
    addTrip,
    updateTrip,
    savedTripsError,
    clearSavedTripsError,
    activeSavedTrip,
    loadTripById,
  } = useSavedTripsStore();
  const requestedSavedTripMode = mode === "savedTrip";
  const isSavedTripMode = Boolean(
    requestedSavedTripMode && activeSavedTrip?.id === normalizedSavedTripId,
  );
  const isLegacySavedTransitTrip = Boolean(
    isSavedTripMode && activeSavedTrip?.routeRequest?.travelMode === "transit",
  );
  const routeRequest = isSavedTripMode
    ? activeSavedTrip.routeRequest
    : activeRouteRequest;
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
  const saveTripsPremiumCopy = getPremiumFeatureMessage(FEATURES.SAVE_TRIPS);

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

  function clearSaveTripStatus() {
    setSavedTripMessage(null);
    setSaveTripError(null);
    clearSavedTripsError();
  }

  function goBackFromRoute() {
    if (typeof returnTo === "string") {
      router.replace(returnTo);
      return;
    }

    router.replace("/(tabs)/navigate");
  }

  function handleEditRoute() {
    if (isSavedTripMode && hasUnsavedSavedTripChanges) {
      Alert.alert(
        "Discard changes?",
        "You have changes that have not been saved. Update this saved trip before leaving, or discard your changes.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Discard Changes",
            style: "destructive",
            onPress: goBackFromRoute,
          },
        ],
      );

      return;
    }

    goBackFromRoute();
  }

  async function handleOpenInGoogleMaps() {
    setRouteActionError(null);

    const { orderedStops, invalidStops } = prepareStopsForRouteHandoff(
      selectedStops,
      routeData?.routeCoords,
    );
    if (invalidStops.length > 0) {
      const message =
        "One or more selected stops is missing valid coordinates. Remove or reselect the affected stop before opening Google Maps.";
      setRouteActionError(message);
      Alert.alert("Cannot open Google Maps", message);
      return;
    }
    if (orderedStops.length > MAX_GOOGLE_MAPS_WAYPOINTS) {
      const message = `Google Maps supports up to ${MAX_GOOGLE_MAPS_WAYPOINTS} Wander North stops. Remove a stop and try again.`;
      setRouteActionError(message);
      Alert.alert("Too many stops", message);
      return;
    }

    try {
      const url = buildGoogleMapsDirectionsUrl({
        origin: routeData?.parsedParams?.startingCoords,
        destination: routeData?.parsedParams?.destinationCoords,
        orderedStops,
        travelMode: routeData?.parsedParams?.travelMode,
      });
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert(
          "Google Maps unavailable",
          "This route could not be opened on this device.",
        );
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      logger.log("Open Google Maps error:", error);
      Alert.alert(
        "Google Maps unavailable",
        "This route could not be opened. Please try again.",
      );
    }
  }

  function toggleSelectedStop(stop) {
    if (isLegacySavedTransitTrip) {
      setRouteActionError(
        "This saved trip uses Transit, which is no longer available for new route planning. You can still view the saved route.",
      );
      return;
    }

    const stopId = getStopId(stop);

    clearSaveTripStatus();

    setSelectedStops((currentStops) => {
      const alreadySelected = currentStops.some((currentStop) => {
        return getStopId(currentStop) === stopId;
      });

      if (alreadySelected) {
        setRouteActionError(null);

        if (isSavedTripMode) {
          setHasUnsavedSavedTripChanges(true);
        }

        return currentStops.filter((currentStop) => {
          return getStopId(currentStop) !== stopId;
        });
      }

      if (isAtSelectedStopLimit(currentStops)) {
        setPremiumGate("moreStops");
        return currentStops;
      }

      setRouteActionError(null);

      if (isSavedTripMode) {
        setHasUnsavedSavedTripChanges(true);
      }

      return [...currentStops, stop];
    });
  }

  function removeAllSelectedStops() {
    if (isLegacySavedTransitTrip) {
      setRouteActionError(
        "This saved trip uses Transit, which is no longer available for new route planning. You can still view the saved route.",
      );
      return;
    }

    clearSaveTripStatus();
    setRouteActionError(null);
    setSelectedStops([]);
    setPremiumGate(null);

    if (isSavedTripMode) {
      setHasUnsavedSavedTripChanges(true);
    }
  }

  function handleAddCustomStop(customStop) {
    if (!customStop) return;

    if (isLegacySavedTransitTrip) {
      setRouteActionError(
        "This saved trip uses Transit, which is no longer available for new route planning. You can still view the saved route.",
      );
      return;
    }

    clearSaveTripStatus();

    if (!routeData?.routeCoords?.length) {
      setRouteActionError("Route data is not ready yet. Please try again");
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

    const {
      orderedStops: preparedCustomStops,
      invalidStops: invalidCustomStops,
    } = prepareStopsForRouteHandoff([customStop], routeData.routeCoords);
    if (invalidCustomStops.length > 0) {
      setRouteActionError(
        "This custom stop is missing valid coordinates. Select it again and retry.",
      );
      return;
    }
    const [routeAwareCustomStop] = preparedCustomStops;

    setRouteActionError(null);

    if (isSavedTripMode) {
      setHasUnsavedSavedTripChanges(true);
    }

    setSelectedStops((currentStops) => {
      return [...currentStops, routeAwareCustomStop];
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
      stops: prepareStopsForRouteHandoff(stops, routeData?.routeCoords)
        .orderedStops,
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
        setRouteActionError(null);
        setSuggestedStops([]);
        setSelectedStops([]);
        setAllRoutePois([]);
        setPremiumGate(null);
        setSavingTrip(false);
        setHasUnsavedSavedTripChanges(false);
        clearSaveTripStatus();

        if (requestedSavedTripMode) {
          const savedTrip =
            activeSavedTrip?.id === normalizedSavedTripId
              ? activeSavedTrip
              : await loadTripById(normalizedSavedTripId);

          if (!isCurrent) return;

          if (!savedTrip) {
            setError(
              "This saved trip could not be found or loaded. Return to Saved Trips and try again.",
            );
            return;
          }

          const savedRouteRequest = savedTrip.routeRequest;
          const savedRoute = savedTrip.route;
          const savedEncodedPolyline = savedRoute?.encodedPolyline;

          if (
            !savedRouteRequest ||
            typeof savedEncodedPolyline !== "string" ||
            !savedEncodedPolyline.trim()
          ) {
            setError(
              "Unable to reopen this saved trip. The saved route data is incomplete.",
            );
            return;
          }

          const routeCoords = polyline
            .decode(savedEncodedPolyline)
            .map(([latitude, longitude]) => ({
              latitude,
              longitude,
            }));

          if (routeCoords.length === 0) {
            setError(
              "Unable to reopen this saved trip. The saved route data is incomplete.",
            );
            return;
          }

          const savedSelectedStops = Array.isArray(savedTrip.selectedStops)
            ? savedTrip.selectedStops
            : [];
          const preparedSavedStops = prepareStopsForRouteHandoff(
            savedSelectedStops,
            routeCoords,
          );
          const refreshedSavedStops = [
            ...preparedSavedStops.orderedStops,
            ...preparedSavedStops.invalidStops,
          ];

          setRouteData({
            ...savedRoute,
            routeCoords,
            parsedParams: savedRouteRequest,
          });
          setSelectedStops(refreshedSavedStops);
          setHasUnsavedSavedTripChanges(false);
          return;
        }

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
        const { prefetchedRoute, ...requestWithoutPrefetch } = routeRequest;
        const parsedParams = {
          ...requestWithoutPrefetch,
          purpose: "preview",
        };

        const result =
          routeRequest.source === "explore" &&
          typeof prefetchedRoute?.encodedPolyline === "string"
            ? prefetchedRoute
            : await buildRoute(parsedParams);

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
        logger.log("Route build error", error);
        setError(
          requestedSavedTripMode
            ? "Unable to reopen this saved trip. The saved route data is incomplete."
            : getExternalApiUserMessage(error),
        );
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
    activeSavedTrip,
    isSavedTripMode,
    loadTripById,
    normalizedSavedTripId,
    requestedSavedTripMode,
    routeRequest,
  ]);

  // Effect 2: Load POIs whenever a route is available.
  // Current implementation is a placeholder so the screen structure is ready
  // for a future real POI service integration.
  useEffect(() => {
    let isCurrent = true;

    async function loadSuggestedStops() {
      if (requestedSavedTripMode) {
        lastPoiRouteIdentityRef.current = null;
        setSuggestedStops([]);
        setAllRoutePois([]);
        setPoiLoading(false);
        setPoiError(null);
        return;
      }

      // Skip POI work until route geometry exists.
      if (!routeData?.routeCoords?.length) {
        lastPoiRouteIdentityRef.current = null;
        setSuggestedStops([]);
        setAllRoutePois([]);
        setPoiError(null);
        setPoiLoading(false);
        return;
      }

      try {
        setPoiLoading(true);
        setPoiError(null);
        setPoiNotice(null);

        const routeIdentity =
          routeData.encodedPolyline ||
          routeData.routeCoords
            .map(({ latitude, longitude }) => `${latitude},${longitude}`)
            .join(";");
        const routeChanged = lastPoiRouteIdentityRef.current !== routeIdentity;
        if (routeChanged) {
          lastPoiRouteIdentityRef.current = routeIdentity;
          setSuggestedStops([]);
          setAllRoutePois([]);
        }

        const routeSamplePoints = getSamplePointsAlongRoute(
          routeData.routeCoords,
        );

        const pois = await fetchPoisForRoute({
          // The POI service is designed to accept multiple route points and return a consolidated list of nearby POIs, which is more efficient than making separate calls for each point.
          routePoints: routeSamplePoints, // Array of numbers representing strategic points along the route for optimized POI searching.
          selectedPoiTypes, // Array of user-selected POI categories (e.g., ["restaurant", "park"]) that will be mapped to Google Place types within the service.
          numStops, // The desired number of stops, which can be used by the service to prioritize or limit results. This value is passed as-is and can be a number or numeric string; the service should handle coercion and validation.
        });
        if (!isCurrent) return;

        const searchMetadata = getLastPoiResultMetadata();
        if (searchMetadata?.partial) {
          setPoiNotice(
            "Some place providers were unavailable, so these results may be limited.",
          );
        } else if (
          Array.isArray(selectedPoiTypes) &&
          selectedPoiTypes.length >
            Math.max(
              0,
              ...Object.values(
                searchMetadata?.searchedTypesByProvider || {},
              ).map((types) => types.length),
            )
        ) {
          setPoiNotice(
            "To control beta API use, the selected categories were prioritized in a bounded search.",
          );
        }

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

        logger.log(
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
            .sort(
              (a, b) =>
                (a.routeProgress ?? Number.POSITIVE_INFINITY) -
                (b.routeProgress ?? Number.POSITIVE_INFINITY),
            ),
        );

        setAllRoutePois(nearbyRoutePois);

        logger.log("[route] Route POIs loaded:", {
          poiCount: nearbyRoutePois.length,
          cacheSummary: searchMetadata?.cacheSummary ?? null,
        });

        const distributedStops = chooseDistributedStops(
          nearbyRoutePois,
          numStops,
          {
            maxDistanceFromRouteMeters: MAX_DISTANCE_FROM_ROUTE_METERS,
            preferredCategories: getCanonicalPoiCategoryIds(selectedPoiTypes),
          },
        );

        setSuggestedStops(distributedStops);

        logger.log("[route] POI candidates:", nearbyRoutePois.length);
        logger.log("[route] Distributed POIs:", distributedStops.length);
        logger.log(
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

        logger.log("Suggested stops error:", error);
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
  }, [requestedSavedTripMode, routeData, selectedPoiTypes, numStops]);

  async function handleSaveTrip() {
    clearSaveTripStatus();

    if (!featureLimits.canSaveTrips) {
      setPremiumGate("saveTrips");
      return null;
    }

    if (!routeData) {
      setSaveTripError("Route data is not ready yet. Please try again.");
      return null;
    }

    if (selectedStops.length === 0) {
      setSaveTripError("Add at least one stop before saving this trip.");
      return null;
    }

    const { orderedStops, invalidStops } = prepareStopsForRouteHandoff(
      selectedStops,
      routeData.routeCoords,
    );
    if (invalidStops.length > 0) {
      setSaveTripError(
        "One or more selected stops is missing valid coordinates. Remove or reselect the affected stop before saving.",
      );
      return null;
    }

    const routeToSave = routeData;
    const savedTripPayload = {
      title: isSavedTripMode
        ? activeSavedTrip?.title || buildSavedTripTitle(routeData.parsedParams)
        : buildSavedTripTitle(routeData.parsedParams),
      source: routeData.parsedParams?.source ?? "unknown",
      routeRequest: {
        ...routeData.parsedParams,
      },
      summary: {
        startingAddress: routeData.parsedParams?.startingAddress ?? "",
        destinationAddress: routeData.parsedParams?.destinationAddress ?? "",
        travelMode: routeData.parsedParams?.travelMode ?? "driving",
        distanceMeters: routeToSave.distanceMeters ?? null,
        distanceText: routeToSave.distanceText ?? null,
        duration: routeToSave.duration ?? null,
        durationText: routeToSave.durationText ?? null,
        selectedStopCount: orderedStops.length,
        isFinalRoute: false,
      },
      route: {
        encodedPolyline: routeToSave.encodedPolyline ?? null,
        distanceMeters: routeToSave.distanceMeters ?? null,
        distanceText: routeToSave.distanceText ?? null,
        duration: routeToSave.duration ?? null,
        durationText: routeToSave.durationText ?? null,
        isFinalRoute: false,
      },
      selectedStops: orderedStops,
      selectedPoiTypes,
      numStops,
    };

    try {
      setSavingTrip(true);

      const savedTrip = isSavedTripMode
        ? await updateTrip(activeSavedTrip.id, savedTripPayload)
        : await addTrip(savedTripPayload);

      if (savedTrip === null) {
        const currentSavedTripsError =
          useSavedTripsStore.getState().savedTripsError;

        setSaveTripError(
          currentSavedTripsError ||
            savedTripsError ||
            (isSavedTripMode
              ? "Unable to update saved trip."
              : "Unable to save trip."),
        );
        return null;
      }

      if (isSavedTripMode) {
        setHasUnsavedSavedTripChanges(false);
        setSavedTripMessage("Saved trip updated.");
      } else {
        setSavedTripMessage("Trip saved locally.");
      }

      return savedTrip;
    } catch (error) {
      logger.warn("[route] Save/update trip error:", error);
      setSaveTripError(
        isSavedTripMode
          ? "Unable to update saved trip."
          : "Unable to save trip.",
      );
      return null;
    } finally {
      setSavingTrip(false);
    }
  }

  const preparedSelectedStops = useMemo(
    () =>
      prepareStopsForRouteHandoff(selectedStops, routeData?.routeCoords ?? []),
    [routeData?.routeCoords, selectedStops],
  );
  const orderedSelectedStops = useMemo(
    () => [
      ...preparedSelectedStops.orderedStops,
      ...preparedSelectedStops.invalidStops,
    ],
    [preparedSelectedStops],
  );
  const displayedRouteData = routeData;
  const mapMarkers = orderedSelectedStops;
  const customStopSearchPoints = useMemo(
    () => getCustomStopSearchPoints(routeData?.routeCoords),
    [routeData?.routeCoords],
  );
  const routeMidpoint = useMemo(
    () => getRoutePointAtDistancePercentage(routeData?.routeCoords, 0.5),
    [routeData?.routeCoords],
  );
  const customStopLocationBias = routeMidpoint
    ? {
        latitude: routeMidpoint.latitude,
        longitude: routeMidpoint.longitude,
        radiusMeters: 50000,
      }
    : null;
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
        <Text className="mb-4 text-center text-lg text-red-600">{error}</Text>
        {requestedSavedTripMode && (
          <WNButton
            label="Back to Saved Trips"
            onPress={() => router.replace("/(tabs)/saved-trips")}
          />
        )}
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
          paddingBottom: Math.max(insets.bottom + 40, 64),
        }}
      >
        <DemoDataIndicator />
        {isLegacySavedTransitTrip && (
          <View className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <Text className="font-semibold text-amber-950">
              This saved trip uses Transit, which is no longer available for new
              route planning. You can still view the saved route.
            </Text>
          </View>
        )}
        <CollapsibleSection
          title="Map"
          subtitle="View the route line and selected stop markers."
        >
          <View className="h-[380px] w-full overflow-hidden rounded-2xl">
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
        </CollapsibleSection>

        <CollapsibleSection
          title="Route Summary"
          subtitle={`${
            displayedRouteData.distanceText || "Distance unavailable"
          } · ${displayedRouteData.durationText || "Duration unavailable"}`}
        >
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
        </CollapsibleSection>

        <CollapsibleSection
          title="Selected Stops"
          subtitle={`${selectedStops.length} selected ${
            selectedStops.length === 1 ? "stop" : "stops"
          }`}
        >
          <SelectedStopsList
            selectedStops={orderedSelectedStops}
            onRemoveStop={toggleSelectedStop}
            onRemoveAllStops={removeAllSelectedStops}
            emptyMessage={
              noAutoStopsRequested
                ? "No stops selected yet. Search for a custom stop below to add one manually."
                : "No stops selected yet. Add suggested or custom stops to customize your route."
            }
          />
        </CollapsibleSection>

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

        {premiumGate === "saveTrips" && (
          <PremiumFeatureCard
            title={saveTripsPremiumCopy.title}
            message={saveTripsPremiumCopy.message}
            onClose={closePremiumGate}
            showDevToggle
            onEnablePremiumForTesting={enablePremiumForTesting}
          />
        )}

        <CollapsibleSection
          title="Add Custom Stop"
          subtitle="Search for a specific place to add to this route."
          defaultCollapsed={!isSavedTripMode}
        >
          <AddCustomStopCard
            onAddStop={handleAddCustomStop}
            locationBias={customStopLocationBias}
            customSearchPoints={customStopSearchPoints}
            routeCoords={routeData?.routeCoords ?? []}
          />
        </CollapsibleSection>

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
            <CollapsibleSection
              title="Top Suggestions"
              subtitle={
                poiLoading
                  ? "Loading suggested stops..."
                  : `${visibleSuggestedStops.length} available`
              }
            >
              <SuggestedStopsList
                title="Top Suggestions"
                emptyMessage="No top suggestions found for this route."
                allSelectedMessage="All top suggestions have been selected"
                poiLoading={poiLoading}
                poiError={poiError}
                poiNotice={poiNotice}
                suggestedStops={visibleSuggestedStops}
                totalSuggestedStopCount={suggestedStops.length}
                selectedStops={selectedStops}
                onToggleStop={toggleSelectedStop}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="More Stops Along Route"
              subtitle="Browse additional stops by category."
              defaultCollapsed
            >
              {!poiLoading && groupedVisibleAllRoutePois.length === 0 && (
                <View className="rounded-2xl bg-stone-50 p-4">
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
                    stopCountLabel={`${group.stops.length} stop${
                      group.stops.length === 1 ? "" : "s"
                    }`}
                  />
                ))}
            </CollapsibleSection>
          </>
        )}

        <CollapsibleSection
          title="Trip Actions"
          subtitle="Save, update, or open this route."
        >
          {routeActionError && (
            <Text className="mb-2 text-sm text-red-600">
              {routeActionError}
            </Text>
          )}

          {selectedStops.length > 0 && (
            <View className="mb-3">
              <Text className="mb-2 text-sm text-stone-600">
                Stops are ordered along your route. Google Maps will calculate
                the roads between them.
              </Text>
              <WNButton
                label="Open in Google Maps"
                onPress={handleOpenInGoogleMaps}
              />
            </View>
          )}

          {(saveTripError || savedTripsError) && (
            <Text className="mb-2 text-sm text-red-600">
              {saveTripError || savedTripsError}
            </Text>
          )}

          {savedTripMessage && (
            <Text className="mb-2 text-sm font-semibold text-emerald-700">
              {savedTripMessage}
            </Text>
          )}

          {isSavedTripMode &&
            !hasUnsavedSavedTripChanges &&
            !savedTripMessage && (
              <Text className="mb-2 text-sm text-stone-500">
                Make a change to update this saved trip.
              </Text>
            )}

          <View className="mb-3">
            <WNButton
              label={
                savingTrip
                  ? isSavedTripMode
                    ? "Updating Trip..."
                    : "Saving Trip..."
                  : isSavedTripMode
                    ? "Update Saved Trip"
                    : "Save Trip"
              }
              onPress={handleSaveTrip}
              disabled={
                savingTrip || (isSavedTripMode && !hasUnsavedSavedTripChanges)
              }
              variant="secondary"
            />
          </View>

          <WNButton
            label={isSavedTripMode ? "Back to Saved Trips" : "Edit Route"}
            onPress={handleEditRoute}
            variant="secondary"
          />
        </CollapsibleSection>
      </ScrollView>
    </View>
  );
};

export default Route;
