/**
 * MapComponent receives route geometry and markers from its parent and renders
 * them. Route fetching and polyline decoding belong to the parent route flow.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "react-native";
import MapView, {
  Marker,
  Polyline,
  Circle,
  PROVIDER_DEFAULT,
} from "react-native-maps";

const ROUTE_STYLES = {
  driving: {
    strokeColor: "#166534",
    strokeWidth: 5,
  },
  transit: {
    strokeColor: "#16a34a",
    strokeWidth: 5,
    lineDashPattern: [5, 10],
  },
  walking: { strokeColor: "#2563eb", strokeWidth: 5, lineDashPattern: [8, 6] },
  bicycling: {
    strokeColor: "#ca8a04",
    strokeWidth: 5,
    lineDashPattern: [2, 8],
  },
};

const DEFAULT_REGION = {
  latitude: 43.9,
  longitude: -79.35,
  latitudeDelta: 5,
  longitudeDelta: 5,
};

function isValidCoordinate(coord) {
  return (
    coord &&
    typeof coord.latitude === "number" &&
    typeof coord.longitude === "number" &&
    Number.isFinite(coord.latitude) &&
    Number.isFinite(coord.longitude)
  );
}

function getMarkerCoords(marker) {
  if (!marker) return null;

  const latitude =
    marker.latitude ??
    marker.lat ??
    marker.location?.latitude ??
    marker.location?.lat;

  const longitude =
    marker.longitude ??
    marker.lng ??
    marker.location?.longitude ??
    marker.location?.lng;

  const numericLatitude = Number(latitude);
  const numericLongitude = Number(longitude);

  if (!Number.isFinite(numericLatitude) || !Number.isFinite(numericLongitude)) {
    return null;
  }

  return {
    latitude: numericLatitude,
    longitude: numericLongitude,
  };
}

const MapComponent = ({
  startCoords,
  destCoords,
  useCurrentLocation,
  travelRadius = 10000,
  mapMarkers = [],
  resetSignal,
  selectedTravelMode = "driving",
  routeCoords = [],
}) => {
  const mapRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const validStartCoords = isValidCoordinate(startCoords) ? startCoords : null;
  const validDestCoords = isValidCoordinate(destCoords) ? destCoords : null;

  const safeRouteCoords = useMemo(
    () =>
      Array.isArray(routeCoords) ? routeCoords.filter(isValidCoordinate) : [],
    [routeCoords],
  );

  const resolvedMarkers = useMemo(
    () =>
      (Array.isArray(mapMarkers) ? mapMarkers : [])
        .map((marker, index) => ({
          marker,
          index,
          coords: getMarkerCoords(marker),
        }))
        .filter(({ coords }) => Boolean(coords)),
    [mapMarkers],
  );

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;

    const markerCoords = resolvedMarkers.map(({ coords }) => coords);
    const coordinatesToFit = [
      ...(safeRouteCoords.length > 0
        ? safeRouteCoords
        : [validStartCoords, validDestCoords].filter(Boolean)),
      ...markerCoords,
    ];

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
  }, [
    isMapReady,
    resolvedMarkers,
    safeRouteCoords,
    validStartCoords,
    validDestCoords,
  ]);

  useEffect(() => {
    if (!resetSignal) return;

    mapRef.current?.animateToRegion(DEFAULT_REGION, 600);
  }, [resetSignal]);

  const routeStyle = ROUTE_STYLES[selectedTravelMode] ?? ROUTE_STYLES.driving;

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
      <MapView
        provider={PROVIDER_DEFAULT}
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={DEFAULT_REGION}
        onMapReady={() => setIsMapReady(true)}
        showsUserLocation={useCurrentLocation}
      >
        {validStartCoords && (
          <Marker coordinate={validStartCoords} title="Start" />
        )}

        {validDestCoords && (
          <Marker coordinate={validDestCoords} title="Destination" />
        )}

        {resolvedMarkers.map(({ marker, coords, index }) => (
          <Marker
            key={marker.id || marker.googlePlaceId || index}
            coordinate={coords}
            title={marker.name || "Stop"}
            description={marker.address || marker.category || ""}
          />
        ))}

        {validStartCoords && travelRadius > 0 && (
          <Circle
            center={validStartCoords}
            radius={travelRadius}
            strokeColor="rgba(44, 85, 48, 0.5)"
            fillColor="rgba(44, 85, 48, 0.2)"
          />
        )}

        {safeRouteCoords.length > 0 && (
          <Polyline
            key={`route-${selectedTravelMode}`}
            coordinates={safeRouteCoords}
            strokeColor={routeStyle.strokeColor}
            strokeWidth={routeStyle.strokeWidth}
            lineDashPattern={routeStyle.lineDashPattern}
          />
        )}
      </MapView>

      {validStartCoords && validDestCoords && safeRouteCoords.length === 0 && (
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
