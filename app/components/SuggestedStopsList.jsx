import { useRef, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { fetchGooglePlaceDetailsForStop } from "../services/googlePlaces";
import {
  asText,
  getDistanceOffRouteText,
  getStopAddress,
  getStopCategory,
  getStopId,
  getStopTitle,
} from "../utils/stopUtils";
import { logger } from "../utils/logger";

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

function isGooglePlacesPhotoUrl(imageUrl) {
  return (
    typeof imageUrl === "string" && imageUrl.includes("places.googleapis.com")
  );
}

function getUniqueImageUrls(imageUrls = []) {
  return [...new Set(imageUrls.filter(Boolean))];
}

function PlacePhotoArea({ imageUrls = [], googleMapsUri }) {
  const [failedImageUrl, setFailedImageUrl] = useState(null);
  const usableImageUrl = getUniqueImageUrls(imageUrls).find((imageUrl) => {
    return !isGooglePlacesPhotoUrl(imageUrl) && imageUrl !== failedImageUrl;
  });

  async function openGoogleMaps() {
    if (!googleMapsUri) return;

    try {
      await Linking.openURL(googleMapsUri);
    } catch (error) {
      logger.warn("Open Google Maps place details error:", error);
    }
  }

  if (usableImageUrl) {
    return (
      <Image
        source={{ uri: usableImageUrl }}
        className="h-48 w-full rounded-2xl bg-emerald-50"
        resizeMode="cover"
        onError={(error) => {
          setFailedImageUrl(usableImageUrl);
          logger.warn("Place photo image load error:", error?.nativeEvent);
        }}
      />
    );
  }

  return (
    <View className="w-full items-center justify-center rounded-2xl bg-stone-100 px-4 py-6">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-white">
        <MaterialCommunityIcons
          name="image-off-outline"
          size={24}
          color="#57534e"
        />
      </View>

      <Text className="mt-3 text-base font-bold text-stone-900">
        Photo unavailable
      </Text>

      <Text className="mt-1 text-center text-sm text-stone-600">
        View on Google Maps for more details.
      </Text>

      {googleMapsUri ? (
        <Pressable
          onPress={openGoogleMaps}
          accessibilityRole="button"
          className="mt-4 rounded-full bg-emerald-50 px-4 py-2"
        >
          <Text className="text-sm font-bold text-emerald-950">
            Open in Google Maps
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const SuggestedStopsList = ({
  title = "Suggested Stops",
  emptyMessage = "No stops found for this route.",
  allSelectedMessage = "All suggested stops have been selected.",
  poiLoading,
  poiError,
  suggestedStops,
  totalSuggestedStopCount = 0,
  selectedStops,
  onToggleStop = () => {},
  collapsible = false,
  defaultCollapsed = false,
  stopCountLabel = null,
}) => {
  const safeSuggestedStops = Array.isArray(suggestedStops)
    ? suggestedStops
    : [];

  const safeSelectedStops = Array.isArray(selectedStops) ? selectedStops : [];

  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const resolvedStopCountLabel =
    stopCountLabel ??
    `${safeSuggestedStops.length} stop${safeSuggestedStops.length === 1 ? "" : "s"}`;

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

      logger.log("Google place details error:", error);
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

  const modalImageUrls = getUniqueImageUrls([
    ...(activeStopDetails?.imageUrls ?? []),
    getStopImage(activeStop),
  ]);

  const modalGoogleMapsUri =
    activeStopDetails?.googleMapsUri ?? activeStop?.googleMapsUri ?? null;

  const modalRating = activeStopDetails?.rating ?? activeStop?.rating ?? null;

  const modalUserRatingCount =
    activeStopDetails?.userRatingCount ?? activeStop?.userRatingCount ?? null;

  return (
    <View className="my-4 rounded-2xl bg-white p-4 shadow-sm">
      {collapsible ? (
        <Pressable
          onPress={() => setIsCollapsed((current) => !current)}
          className="flex-row items-center justify-between"
        >
          <View className="flex-1 pr-3">
            <Text className="text-xl font-bold text-emerald-950">{title}</Text>
            <Text className="mt-1 text-sm text-stone-600">
              {resolvedStopCountLabel}
            </Text>
          </View>

          <MaterialCommunityIcons
            name={isCollapsed ? "chevron-down" : "chevron-up"}
            size={26}
            color="#1D3B2A"
          />
        </Pressable>
      ) : (
        <Text className="text-xl font-bold text-emerald-950">{title}</Text>
      )}

      {!isCollapsed && (
        <>
          {poiLoading && (
            <Text className="mt-3 text-stone-600">
              Finding suggested stops near your route...
            </Text>
          )}

          {poiError && <Text className="mt-3 text-red-600">{poiError}</Text>}

          {!poiLoading && !poiError && safeSuggestedStops.length === 0 && (
            <Text className="mt-3 text-stone-600">
              {totalSuggestedStopCount > 0 ? allSelectedMessage : emptyMessage}
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
                      ? "border-emerald-800 bg-emerald-50"
                      : "border-stone-200 bg-white"
                  }`}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="font-semibold text-stone-900">
                        {index + 1}. {getStopTitle(stop)}
                      </Text>

                      <Text className="mt-1 text-sm text-stone-600">
                        {getStopCategory(stop)}
                      </Text>

                      <Text className="mt-1 text-sm text-stone-600">
                        {getStopAddress(stop)}
                      </Text>

                      <Text className="mt-1 text-sm font-medium text-emerald-950">
                        {getDistanceOffRouteText(stop)}
                      </Text>

                      <Text className="mt-2 text-xs text-stone-600">
                        Tap for photos and details
                      </Text>
                    </View>

                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation?.();
                        onToggleStop(stop);
                      }}
                      className={`rounded-full px-3 py-1 ${
                        selected ? "bg-emerald-800" : "bg-emerald-50"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          selected ? "text-white" : "text-emerald-950"
                        }`}
                      >
                        {selected ? "Remove" : "Add"}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
        </>
      )}

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
                <PlacePhotoArea
                  imageUrls={modalImageUrls}
                  googleMapsUri={modalGoogleMapsUri}
                />

                {detailsLoading && (
                  <Text className="mt-3 text-sm text-stone-600">
                    Loading extra stop details...
                  </Text>
                )}

                {detailsError && (
                  <Text className="mt-3 text-sm text-red-600">
                    {detailsError}
                  </Text>
                )}

                <Text className="mt-4 text-2xl font-bold text-emerald-950">
                  {modalTitle}
                </Text>

                <Text className="mt-2 text-base font-semibold text-stone-900">
                  {getStopCategory(activeStop)}
                </Text>

                <Text className="mt-3 text-base text-stone-600">
                  {modalAddress}
                </Text>

                {modalRating && (
                  <Text className="mt-2 text-sm text-stone-600">
                    Rating: {modalRating} / 5
                    {modalUserRatingCount
                      ? ` · ${modalUserRatingCount} reviews`
                      : ""}
                  </Text>
                )}

                <Text className="mt-3 text-base font-semibold text-emerald-950">
                  {getDistanceOffRouteText(activeStop)}
                </Text>

                <Text className="mt-5 text-lg font-bold text-stone-900">
                  About this stop
                </Text>

                <Text className="mt-2 text-base leading-6 text-stone-600">
                  {modalDescription}
                </Text>

                <View className="mt-6 flex-row gap-3 pb-8">
                  <Pressable
                    onPress={handleAddStopFromModal}
                    className={`flex-1 rounded-xl px-4 py-3 ${
                      activeStopIsSelected ? "bg-stone-200" : "bg-emerald-50"
                    }`}
                  >
                    <Text
                      className={`text-center font-bold ${
                        activeStopIsSelected
                          ? "text-stone-900"
                          : "text-emerald-950"
                      }`}
                    >
                      {activeStopIsSelected ? "Already Added" : "Add Stop"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={closeModal}
                    className="flex-1 rounded-xl bg-stone-200 px-4 py-3"
                  >
                    <Text className="text-center font-bold text-stone-900">
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
