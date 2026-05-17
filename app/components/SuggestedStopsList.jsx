import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { fetchGooglePlaceDetailsForStop } from "../services/googlePlaces";

function asText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function getStopId(stop) {
  if (!stop) return undefined;

  return (
    stop.id ??
    stop.place_id ??
    stop.placeId ??
    stop.googlePlaceId ??
    stop.fsq_id ??
    stop.properties?.place_id ??
    stop.properties?.placeId ??
    stop.properties?.googlePlaceId ??
    stop.properties?.id ??
    stop.name
  );
}

function getStopTitle(stop) {
  if (!stop) return "Unnamed stop";

  return (
    asText(stop.name) ||
    asText(stop.title) ||
    asText(stop.displayName?.text) ||
    asText(stop.displayName) ||
    "Unnamed stop"
  );
}

function getStopCategory(stop) {
  if (!stop) return "Suggested stop";

  return stop.category ?? stop.type ?? stop.poiType ?? "Suggested stop";
}

function getStopAddress(stop) {
  if (!stop) return "Address not available";

  return (
    stop.address ??
    stop.formattedAddress ??
    stop.formatted_address ??
    stop.vicinity ??
    stop.location?.address ??
    stop.properties?.address ??
    "Address not available"
  );
}

function getStopDescription(stop) {
  if (!stop) return "No description available.";

  const existingDescription =
    asText(stop.description) ||
    asText(stop.summary) ||
    asText(stop.editorialSummary?.text) ||
    asText(stop.editorial_summary?.overview);

  if (existingDescription) return existingDescription;

  const title = getStopTitle(stop);
  const category = getStopCategory(stop);

  return `${title} is a suggested ${category} near your route. Google does not provide a description for this stop.`;
}

function getStopImage(stop) {
  if (!stop) return null;

  return (
    stop.imageUrl ??
    stop.photoUrl ??
    stop.image ??
    stop.photos?.[0]?.url ??
    stop.photos?.[0]?.photoUrl ??
    stop.imageUrls?.[0] ??
    null
  );
}

function getDistanceOffRouteText(stop) {
  if (!stop) return "Distance off route unavailable";

  const distanceMeters =
    stop.closestRouteDistanceMeters ??
    stop.distanceOffRouteMeters ??
    stop.distanceFromRouteMeters;

  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) {
    return "Distance off route unavailable";
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m off route`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km off route`;
}

const SuggestedStopsList = ({
  poiLoading,
  poiError,
  suggestedStops,
  totalSuggestedStopCount = 0,
  selectedStops,
  onToggleStop = () => {},
}) => {
  const safeSuggestedStops = Array.isArray(suggestedStops)
    ? suggestedStops
    : [];

  const safeSelectedStops = Array.isArray(selectedStops) ? selectedStops : [];

  const [activeStop, setActiveStop] = useState(null);
  const [activeStopDetails, setActiveStopDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [detailsByStopId, setDetailsByStopId] = useState({});

  const latestDetailsRequestId = useRef(0);

  function isStopSelected(stop) {
    const stopId = getStopId(stop);

    if (!stopId) return false;

    return safeSelectedStops.some((selectedStop) => {
      return getStopId(selectedStop) === stopId;
    });
  }

  function closeModal() {
    latestDetailsRequestId.current += 1;

    setActiveStop(null);
    setActiveStopDetails(null);
    setDetailsLoading(false);
    setDetailsError(null);
  }

  function handleAddStopFromModal() {
    if (!activeStop) return;

    if (!isStopSelected(activeStop)) {
      onToggleStop(activeStop);
    }

    closeModal();
  }

  async function handleOpenStopDetails(stop) {
    const stopId = getStopId(stop);
    const requestId = latestDetailsRequestId.current + 1;

    latestDetailsRequestId.current = requestId;

    setActiveStop(stop);
    setActiveStopDetails(null);
    setDetailsError(null);

    if (stopId && detailsByStopId[stopId]) {
      setActiveStopDetails(detailsByStopId[stopId]);
      setDetailsLoading(false);
      return;
    }

    try {
      setDetailsLoading(true);

      const details = await fetchGooglePlaceDetailsForStop(stop);

      if (latestDetailsRequestId.current !== requestId) {
        return;
      }

      setActiveStopDetails(details);

      if (stopId) {
        setDetailsByStopId((currentDetails) => ({
          ...currentDetails,
          [stopId]: details,
        }));
      }
    } catch (error) {
      if (latestDetailsRequestId.current !== requestId) {
        return;
      }

      console.log("Google place details error:", error);
      setDetailsError("Could not load extra details for this stop.");
    } finally {
      if (latestDetailsRequestId.current === requestId) {
        setDetailsLoading(false);
      }
    }
  }

  const activeStopIsSelected = activeStop ? isStopSelected(activeStop) : false;

  const modalTitle = activeStopDetails?.title ?? getStopTitle(activeStop);

  const modalAddress = activeStopDetails?.address ?? getStopAddress(activeStop);

  const modalDescription =
    activeStopDetails?.description ?? getStopDescription(activeStop);

  const modalImageUrl =
    activeStopDetails?.imageUrls?.[0] ?? getStopImage(activeStop);

  const modalRating = activeStopDetails?.rating ?? activeStop?.rating ?? null;

  const modalUserRatingCount =
    activeStopDetails?.userRatingCount ?? activeStop?.userRatingCount ?? null;

  const modalGoogleMapsUri =
    activeStopDetails?.googleMapsUri ?? activeStop?.googleMapsUri ?? null;

  return (
    <View className="my-4 rounded-2xl bg-white p-4 shadow-sm">
      <Text className="text-xl font-bold text-wn-forest">Suggested Stops</Text>

      {poiLoading && (
        <Text className="mt-3 text-wn-text">
          Finding suggested stops near your route...
        </Text>
      )}

      {poiError && <Text className="mt-3 text-red-600">{poiError}</Text>}

      {!poiLoading && !poiError && safeSuggestedStops.length === 0 && (
        <Text className="mt-3 text-wn-text">
          {totalSuggestedStopCount > 0
            ? "All suggested stops have been selected."
            : "No suggested stops found for this route."}
        </Text>
      )}

      {!poiLoading &&
        !poiError &&
        safeSuggestedStops.map((stop, index) => {
          if (!stop) return null;

          const selected = isStopSelected(stop);
          const stopId = getStopId(stop);

          return (
            <Pressable
              key={stopId ?? `${getStopTitle(stop)}-${index}`}
              onPress={() => handleOpenStopDetails(stop)}
              className={`mt-3 rounded-xl border p-3 ${
                selected
                  ? "border-wn-forest bg-wn-green-50"
                  : "border-wn-border bg-white"
              }`}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="font-semibold text-wn-charcoal">
                    {index + 1}. {getStopTitle(stop)}
                  </Text>

                  <Text className="mt-1 text-sm text-wn-text">
                    {getStopCategory(stop)}
                  </Text>

                  <Text className="mt-1 text-sm text-wn-text">
                    {getStopAddress(stop)}
                  </Text>

                  <Text className="mt-1 text-sm font-medium text-wn-forest">
                    {getDistanceOffRouteText(stop)}
                  </Text>

                  <Text className="mt-2 text-xs text-wn-text">
                    Tap for photos and details
                  </Text>
                </View>

                <Pressable
                  onPress={(event) => {
                    event.stopPropagation?.();
                    onToggleStop(stop);
                  }}
                  className={`rounded-full px-3 py-1 ${
                    selected ? "bg-wn-forest" : "bg-wn-green-50"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selected ? "text-white" : "text-wn-forest"
                    }`}
                  >
                    {selected ? "Remove" : "Add"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          );
        })}

      <Modal
        visible={!!activeStop}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[85%] rounded-t-3xl bg-white">
            {activeStop && (
              <ScrollView className="p-5">
                {activeStopDetails?.imageUrls?.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-4"
                  >
                    {activeStopDetails.imageUrls.map((imageUrl, index) => (
                      <Image
                        key={`${imageUrl}-${index}`}
                        source={{ uri: imageUrl }}
                        className="mr-3 h-48 w-72 rounded-2xl bg-wn-green-50"
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                ) : modalImageUrl ? (
                  <Image
                    source={{ uri: modalImageUrl }}
                    className="h-48 w-full rounded-2xl bg-wn-green-50"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-32 w-full items-center justify-center rounded-2xl bg-wn-green-50">
                    {detailsLoading ? (
                      <ActivityIndicator />
                    ) : (
                      <Text className="text-wn-text">No image available</Text>
                    )}
                  </View>
                )}

                {detailsLoading && (
                  <Text className="mt-3 text-sm text-wn-text">
                    Loading extra stop details...
                  </Text>
                )}

                {detailsError && (
                  <Text className="mt-3 text-sm text-red-600">
                    {detailsError}
                  </Text>
                )}

                <Text className="mt-4 text-2xl font-bold text-wn-forest">
                  {modalTitle}
                </Text>

                <Text className="mt-2 text-base font-semibold text-wn-charcoal">
                  {getStopCategory(activeStop)}
                </Text>

                <Text className="mt-3 text-base text-wn-text">
                  {modalAddress}
                </Text>

                {modalRating && (
                  <Text className="mt-2 text-sm text-wn-text">
                    Rating: {modalRating} / 5
                    {modalUserRatingCount
                      ? ` · ${modalUserRatingCount} reviews`
                      : ""}
                  </Text>
                )}

                <Text className="mt-3 text-base font-semibold text-wn-forest">
                  {getDistanceOffRouteText(activeStop)}
                </Text>

                <Text className="mt-5 text-lg font-bold text-wn-charcoal">
                  About this stop
                </Text>

                <Text className="mt-2 text-base leading-6 text-wn-text">
                  {modalDescription}
                </Text>

                <View className="mt-6 flex-row gap-3 pb-8">
                  <Pressable
                    onPress={handleAddStopFromModal}
                    className={`flex-1 rounded-xl px-4 py-3 ${
                      activeStopIsSelected ? "bg-wn-border" : "bg-wn-green-50"
                    }`}
                  >
                    <Text
                      className={`text-center font-bold ${
                        activeStopIsSelected
                          ? "text-wn-charcoal"
                          : "text-wn-forest"
                      }`}
                    >
                      {activeStopIsSelected ? "Already Added" : "Add Stop"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={closeModal}
                    className="flex-1 rounded-xl bg-wn-border px-4 py-3"
                  >
                    <Text className="text-center font-bold text-wn-charcoal">
                      Close
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SuggestedStopsList;
