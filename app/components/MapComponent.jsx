/**
 * MapComponent.jsx
 *
 * A React Native map component that displays routes between start and destination coordinates.
 * Supports multiple travel modes (driving, walking, bicycling, transit) via Google Directions API.
 * Users can switch between modes to compare travel times and distances.
 */

import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import MapView, {
  Marker,
  Polyline,
  Circle,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import polyline from "@mapbox/polyline"; // Decodes Google's compressed polyline format

const ROUTE_STYLES = {
  driving: {
    strokeColor: "#166534",
    strokeWidth: 5,
  },
  transit: { strokeColor: "#16a34a", strokeWidth: 5, lineDashPattern: [] },
  walking: { strokeColor: "#2563eb", strokeWidth: 5, lineDashPattern: [8, 6] },
  bicycling: {
    strokeColor: "#ca8a04",
    strokeWidth: 5,
    lineDashPattern: [2, 8],
  },
};

/**
 * TRAVEL_MODES
 *
 * Array of supported transportation modes for route calculation.
 * Each mode requires a separate API request to Google Directions API.
 *
 * Structure:
 * - key: Used internally and as Google Directions API parameter
 * - label: Human-readable name shown in the UI (currently unused but useful for future UI)
 * - icon: Material Community Icons name for visual representation
 */
const TRAVEL_MODES = [
  {
    key: "driving",
    fallbackLabel: "Car",
    icon: "car",
  },
  {
    key: "bicycling",
    fallbackLabel: "Bike",
    icon: "bike",
  },
  {
    key: "walking",
    fallbackLabel: "Walk",
    icon: "walk",
  },
  {
    key: "transit",
    fallbackLabel: "Transit",
    icon: "train",
  },
];

/**
 * formatDuration(seconds)
 *
 * Converts Google Directions API duration (in seconds) into human-readable format.
 *
 * Examples:
 * - 900 seconds  → "15 min"
 * - 3600 seconds → "1h"
 * - 5400 seconds → "1h 30m"
 * - null/0       → "--" (fallback for missing data)
 *
 * @param {number} seconds - Duration in seconds from Google API
 * @returns {string} Formatted duration string
 */
function formatDuration(seconds) {
  if (!seconds) return "--";

  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * formatLatLng(coords)
 *
 * Converts a coordinate object into Google Directions API format.
 * Google requires coordinates as "latitude,longitude" strings.
 *
 * @param {Object} coords - Coordinate object with latitude and longitude properties
 * @returns {string} Formatted string like "43.6532,-79.3832"
 */
function formatLatLng(coords) {
  return `${coords.latitude},${coords.longitude}`;
}

/**
 * MapComponent
 *
 * Main component that fetches and displays multi-modal routes on an interactive map.
 *
 * Features:
 * - Fetches 4 travel modes (driving, bicycling, walking, transit) simultaneously
 * - Displays transportation mode selector with real-time duration labels
 * - Allows users to switch between modes to compare routes
 * - Shows start, destination, and custom markers on map
 * - Displays travel radius circle around start location
 * - Automatically fits map camera to show the full route
 * - Handles API errors and missing routes gracefully
 *
 * @component
 * @param {Object} props
 * @param {Object} props.startCoords - Starting coordinate {latitude, longitude}
 * @param {Object} props.destCoords - Destination coordinate {latitude, longitude}
 * @param {boolean} [props.useCurrentLocation=false] - Show user's current location on map
 * @param {number} [props.travelRadius=10000] - Radius in meters for travel zone circle around start
 * @param {Array} [props.mapMarkers=[]] - Additional custom markers to display: [{latitude, longitude, title, description}, ...]
 * @param {boolean} [props.resetSignal] - External signal to reset map to default region
 * @param {Array} [props.routeCoords] - Optional pre-calculated route coordinates that override API routes
 *
 * @returns {JSX.Element} MapView with route visualization and mode selector
 */
const MapComponent = ({
  startCoords,
  destCoords,
  useCurrentLocation,
  travelRadius = 10000,
  mapMarkers = [],
  resetSignal,
  selectedTravelMode = "driving",
  onRoutesByModeChange,
  onSelectedTravelModeChange,

  /**
   * Optional external route coordinates.
   *
   * If you pass this in, it overrides the selected Google route.
   * This keeps your old behavior available while you are refactoring.
   */
  routeCoords: externalRouteCoords,
}) => {
  // ==================== REFS ====================

  // Reference to the MapView instance.
  // Used to programmatically control camera position (zoom, pan, fit to coordinates).
  const mapRef = useRef(null);

  // ==================== STATE ====================

  /**
   * routesByMode
   *
   * Stores the fetched route data for each travel mode.
   * This enables switching between modes without re-fetching from API.
   *
   * Shape:
   * {
   *   "driving": {
   *     mode: "driving",
   *     coords: [{latitude, longitude}, ...],  // Decoded polyline points
   *     durationSeconds: 1800,                  // Travel time in seconds
   *     distanceMeters: 23000,                  // Route distance in meters
   *     status: "OK",                           // Google API status
   *     error: null,                            // Error message if route failed
   *   },
   *   "walking": {...},
   *   "bicycling": {...},
   *   "transit": {...}
   * }
   */
  const [routesByMode, setRoutesByMode] = useState({});

  /**
   * loading
   *
   * Indicates whether API requests are in progress.
   * True while all 4 mode requests are being fetched.
   * False when all complete (success or failure).
   */
  const [loading, setLoading] = useState(false);

  /**
   * region
   *
   * Default map region for when component mounts or map is reset.
   * Centered on southern Ontario, Canada area.
   * Used as fallback if no coordinates are provided.
   */
  const [region] = useState({
    latitude: 43.9,
    longitude: -79.35,
    latitudeDelta: 5,
    longitudeDelta: 5,
  });

  const [isMapReady, setIsMapReady] = useState(false);

  // ==================== ASYNC FUNCTIONS ====================

  /**
   * fetchRouteForMode(mode)
   *
   * Fetches a single route from Google Directions API for a specific travel mode.
   * Always returns a structured object (never throws errors to caller).
   *
   * Error Handling Strategy:
   * - API key missing: Returns status "NO_API_KEY"
   * - No route found: Returns status "NO_ROUTE" with empty coords
   * - Malformed response: Returns status "MALFORMED_ROUTE"
   * - Network error: Returns status "FETCH_ERROR"
   * - Promise rejection: Handled at call site
   *
   * Route Decoding:
   * 1. Google returns compressed polyline string in overview_polyline.points
   * 2. We decode it to [lat, lng] coordinate pairs
   * 3. Convert to RN Maps format: {latitude, longitude}
   *
   * Duration Notes:
   * - For driving mode: Prefers duration_in_traffic (with real traffic) if available
   * - For other modes: Uses standard duration field
   *
   * @param {string} mode - Travel mode key: "driving", "bicycling", "walking", or "transit"
   * @returns {Promise<Object>} Route result object (never rejects, always resolves)
   */
  const fetchRouteForMode = async (mode) => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        return {
          mode,
          coords: [],
          durationSeconds: null,
          distanceMeters: null,
          status: "NO_API_KEY",
          error: "Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
        };
      }

      const origin = formatLatLng(startCoords);
      const destination = formatLatLng(destCoords);

      /**
       * Google Directions API endpoint with parameters:
       *
       * - origin/destination: Start and end points formatted as "lat,lng"
       * - mode: Travel mode (driving, bicycling, walking, transit)
       * - region=ca: Biases results toward Canada for better local results
       * - departure_time=now: Enables traffic-aware routing for driving/transit
       *   Note: For driving, returns duration_in_traffic if available
       * - key: API authentication
       *
       * Endpoint: https://maps.googleapis.com/maps/api/directions/json
       */
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${encodeURIComponent(origin)}` +
        `&destination=${encodeURIComponent(destination)}` +
        `&mode=${encodeURIComponent(mode)}` +
        `&region=ca` +
        `&departure_time=now` +
        `&key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url);
      const data = await res.json();

      // Check for API-level errors or empty results
      if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
        return {
          mode,
          coords: [],
          durationSeconds: null,
          distanceMeters: null,
          status: data.status || "NO_ROUTE",
          error: data.error_message || `No ${mode} route found`,
        };
      }

      const route = data.routes[0];
      const leg = route.legs?.[0]; // First leg of route (start to destination)

      // Validate that we have the required route data
      if (!route.overview_polyline?.points || !leg) {
        return {
          mode,
          coords: [],
          durationSeconds: null,
          distanceMeters: null,
          status: "MALFORMED_ROUTE",
          error: `Google returned an incomplete ${mode} route`,
        };
      }

      // Decode Google's compressed polyline format into coordinate pairs
      const decoded = polyline.decode(route.overview_polyline.points);

      // Convert [lat, lng] arrays to React Native Maps coordinate objects {latitude, longitude}
      const coords = decoded.map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
      }));

      /**
       * Duration selection logic:
       * 1. For driving: Use duration_in_traffic (real-time traffic) if available
       * 2. Fallback: Use standard duration field
       * 3. Fallback: null if neither exists
       */
      const durationSeconds =
        leg.duration_in_traffic?.value ?? leg.duration?.value ?? null;

      // Success case: return complete route data
      return {
        mode,
        coords,
        durationSeconds,
        distanceMeters: leg.distance?.value ?? null,
        status: data.status,
        error: null,
      };
    } catch (error) {
      console.log(`[MapComponent] ${mode} route error:`, error);

      // Network or parsing error
      return {
        mode,
        coords: [],
        durationSeconds: null,
        distanceMeters: null,
        status: "FETCH_ERROR",
        error: error.message,
      };
    }
  };

  // ==================== EFFECTS ====================

  /**
   * Effect: Fetch all routes when start or destination coordinates change
   *
   * Triggers:
   * - When startCoords or destCoords props are provided/updated
   *
   * Behavior:
   * 1. Return early if coordinates are not yet provided
   * 2. Set loading to true
   * 3. Fetch all 4 modes in parallel using Promise.allSettled
   *    (allSettled waits for all to complete, doesn't stop on first failure)
   * 4. Store results in routesByMode
   * 5. Auto-select first available mode if current selection has no route
   * 6. Set loading to false
   *
   * Why Promise.allSettled?
   * - One mode might fail while others succeed (e.g., transit unavailable)
   * - We don't want to lose other mode data if one request rejects
   */
  useEffect(() => {
    const fetchAllRoutes = async () => {
      if (externalRouteCoords?.length > 0) {
        setRoutesByMode({});
        setLoading(false);
        return;
      }

      if (!startCoords || !destCoords) {
        setRoutesByMode({});
        return;
      }

      setLoading(true);

      try {
        const results = await Promise.allSettled(
          TRAVEL_MODES.map((mode) => fetchRouteForMode(mode.key)),
        );

        const nextRoutesByMode = {};

        results.forEach((result, index) => {
          const fallbackMode = TRAVEL_MODES[index].key;

          if (result.status === "fulfilled") {
            nextRoutesByMode[result.value.mode] = result.value;
          } else {
            nextRoutesByMode[fallbackMode] = {
              mode: fallbackMode,
              coords: [],
              durationSeconds: null,
              distanceMeters: null,
              status: "PROMISE_REJECTED",
              error: result.reason?.message || "Route request failed",
            };
          }
        });

        setRoutesByMode(nextRoutesByMode);
        onRoutesByModeChange?.(nextRoutesByMode);

        const selectedRoute = nextRoutesByMode[selectedTravelMode];

        if (!selectedRoute || selectedRoute.coords.length === 0) {
          const firstAvailableMode = TRAVEL_MODES.find((mode) => {
            return nextRoutesByMode[mode.key]?.coords?.length > 0;
          });

          if (firstAvailableMode) {
            onSelectedTravelModeChange?.(firstAvailableMode.key);
          }
        }
      } catch (error) {
        console.log("[MapComponent] Fetch all routes error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllRoutes();
  }, [startCoords, destCoords, externalRouteCoords]);

  // ==================== COMPUTED VALUES ====================

  /**
   * selectedRoute
   *
   * The route object for the currently selected transportation mode.
   * Used to access duration, distance, and coordinates for display.
   */
  const selectedRoute = routesByMode[selectedTravelMode];

  /**
   * coordsToRender
   *
   * Determines which route coordinates to display on the map.
   *
   * Priority:
   * 1. External route coordinates (if provided and not empty)
   *    - Allows component consumer to provide pre-calculated routes
   * 2. Selected mode's route coordinates
   * 3. Empty array (no route to render)
   *
   * Wrapped in useMemo to prevent unnecessary re-renders of MapView
   * when route hasn't actually changed.
   */
  const routeCoords =
    externalRouteCoords?.length > 0
      ? externalRouteCoords
      : (selectedRoute?.coords ?? []);

  /**
   * Effect: Fit map camera to route when rendered coordinates change
   *
   * Triggers:
   * - When coordsToRender changes (route switched or external route provided)
   *
   * Behavior:
   * 1. Return early if no map ref or no coordinates
   * 2. Use fitToCoordinates to animate camera to show entire route
   * 3. edgePadding adds space around the route for visual breathing room
   * 4. animated: true smoothly transitions camera position
   *
   * This ensures the map always shows the full route when it changes.
   */
  useEffect(() => {
    if (!isMapReady) return;
    if (!mapRef.current) return;

    const coordinatesToFit =
      routeCoords.length > 0
        ? routeCoords
        : [startCoords, destCoords].filter(Boolean);

    if (coordinatesToFit.length < 2) return;

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinatesToFit, {
        edgePadding: {
          top: 80,
          right: 60,
          bottom: 80,
          left: 60,
        },
        animated: true,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [isMapReady, routeCoords, startCoords, destCoords]);

  /**
   * Effect: Handle external reset signal
   *
   * Triggers:
   * - When resetSignal prop becomes truthy (sent from parent component)
   *
   * Behavior:
   * 1. Clear all fetched routes
   * 2. Animate map back to default region
   *
   * Used to reset the map to initial state without re-fetching routes.
   */
  useEffect(() => {
    if (!resetSignal) return;

    setRoutesByMode({});

    if (mapRef.current) {
      mapRef.current.animateToRegion(region, 600);
    }
  }, [resetSignal, region]);

  const routeStyle = ROUTE_STYLES[selectedTravelMode] ?? ROUTE_STYLES.driving;

  // ==================== RENDER ====================

  return (
    <View
      style={{
        width: "100%",
        flex: 1,
        borderRadius: 12,
        overflow: "hidden",

        backgroundColor: "#F3F4F6",
      }}
    >
      {/* ============= MAP VIEW =============
          
          Core map component from react-native-maps.
          Displays markers, polylines (routes), and circles (travel radius).
      */}
      <MapView
        provider={PROVIDER_DEFAULT}
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        onMapReady={() => setIsMapReady(true)}
        // Shows blue dot for user's current location if enabled
        showsUserLocation={useCurrentLocation}
      >
        {/* ===== START LOCATION MARKER ===== 
            
            Shows starting point on map.
            Appears as a standard marker pin.
        */}
        {startCoords && <Marker coordinate={startCoords} title="Start" />}

        {/* ===== DESTINATION MARKER ===== 
            
            Shows destination point on map.
            Appears as a standard marker pin.
        */}
        {destCoords && <Marker coordinate={destCoords} title="Destination" />}

        {/* ===== CUSTOM MARKERS ===== 
            
            Renders any additional markers passed in via mapMarkers prop.
            Useful for showing waypoints, attractions, or other POIs.
            
            Each marker should have:
            - latitude: y coordinate
            - longitude: x coordinate
            - title: Name shown in popup (optional)
            - description: Details shown in popup (optional)
        */}
        {mapMarkers.map((m, i) => (
          <Marker
            key={m.id || `${m.name || m.title || "marker"}-${i}`}
            coordinate={{
              latitude: m.latitude,
              longitude: m.longitude,
            }}
            title={m.title || m.name || "Location"}
            description={m.description || m.address || m.category || ""}
          />
        ))}

        {/* ===== TRAVEL RADIUS CIRCLE ===== 
            
            Visualizes the accessible area around the starting point.
            Rendered as a semi-transparent circle.
            
            Only shown if:
            - startCoords exists
            - travelRadius > 0 (defaults to 10000 meters / 10km)
            
            Style:
            - Stroke: Semi-transparent dark green outline
            - Fill: Lighter green semi-transparent interior
        */}
        {startCoords && travelRadius > 0 && (
          <Circle
            center={startCoords}
            radius={travelRadius}
            strokeColor="rgba(44, 85, 48, 0.5)"
            fillColor="rgba(44, 85, 48, 0.2)"
          />
        )}

        {/* ===== SELECTED ROUTE POLYLINE ===== 
            
            Draws the active route on the map.
            Polyline connects all coordinates in sequence.
            
            Only shown if coordsToRender has coordinates.
            Updates when:
            - User switches travel mode
            - External route is provided
            - Route coordinates change
            
            Style:
            - Color: Dark green (#1D3B2A)
            - Width: 4 pixels (thick line for visibility)
        */}
        {routeCoords.length > 0 && (
          <Polyline
            key={`route-${selectedTravelMode}`} // Force re-render when mode changes
            coordinates={routeCoords}
            strokeColor={routeStyle.strokeColor}
            strokeWidth={routeStyle.strokeWidth}
            lineDashPattern={routeStyle.lineDashPattern}
          />
        )}
      </MapView>

      {/* ============= LOADING INDICATOR ============= 
          
          Shows while API requests are in progress.
          Displays spinner and "Loading routes..." text.
          Overlays map with semi-transparent white backdrop.
          
          Appears immediately when routes start fetching.
          Disappears when all requests complete (success or failure).
      */}
      {loading && (
        <View className="absolute inset-0 items-center justify-center bg-white/40">
          <ActivityIndicator size="large" color="#1D3B2A" />
          <Text className="mt-2.5 font-semibold text-[#1D3B2A]">
            Loading routes...
          </Text>
        </View>
      )}

      {/* ============= NO ROUTE ERROR MESSAGE ============= 
          
          Shown when:
          - Loading is complete (not loading)
          - Both start and destination coordinates are provided
          - No coordinates rendered (selected mode has no route)
          
          This indicates that the selected travel mode was not available
          for the requested route (e.g., transit unavailable in rural area).
          
          Message appears in bottom-left corner of map.
      */}
      {!loading && startCoords && destCoords && routeCoords.length === 0 && (
        <View className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/95 px-4 py-3 shadow">
          <Text className="text-center font-semibold text-[#1D3B2A]">
            No route found for the selected travel mode.
          </Text>
        </View>
      )}
    </View>
  );
};

export default MapComponent;
