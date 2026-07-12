import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import PremiumFeatureCard from "../components/PremiumFeatureCard";
import PremiumStatusDevCard from "../components/PremiumStatusDevCard";

import { useEntitlementStore } from "../store/useEntitlementStore";
import { useSavedTripsStore } from "../store/useSavedTripsStore";
import {
  FEATURES,
  getFeatureLimits,
  getPremiumFeatureMessage,
} from "../config/featureAccess";
import { logger } from "../utils/logger";

function formatSavedDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatSource(source) {
  if (source === "navigate") return "Navigate";
  if (source === "explore") return "Explore";

  return "Unknown";
}

function formatTravelMode(travelMode) {
  if (!travelMode) return "Not available";

  return (
    String(travelMode).charAt(0).toUpperCase() + String(travelMode).slice(1)
  );
}

function SavedTripCard({ trip, onOpen, onDelete, onRename }) {
  const summary = trip.summary ?? {};
  const parsedSelectedStopCount = Number(summary.selectedStopCount ?? 0);
  const selectedStopCount = Number.isFinite(parsedSelectedStopCount)
    ? parsedSelectedStopCount
    : 0;

  return (
    <View className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-lg font-bold text-emerald-950">
            {trip.title || "Saved Trip"}
          </Text>
          <Text className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {formatSource(trip.source)}
          </Text>
        </View>

        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={onRename}
            accessibilityRole="button"
            accessibilityLabel={`Rename ${trip.title || "saved trip"}`}
            className="rounded-full bg-emerald-50 px-3 py-1"
          >
            <Text className="text-sm font-semibold text-emerald-950">
              Rename
            </Text>
          </Pressable>

          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${trip.title || "saved trip"}`}
            className="rounded-full bg-red-100 px-3 py-1"
          >
            <Text className="text-sm font-semibold text-red-700">Delete</Text>
          </Pressable>
        </View>
      </View>

      <View className="mt-4 gap-2">
        <View>
          <Text className="text-xs font-semibold uppercase text-stone-500">
            Start
          </Text>
          <Text className="mt-0.5 text-sm text-stone-800">
            {summary.startingAddress || "Not available"}
          </Text>
        </View>

        <View>
          <Text className="text-xs font-semibold uppercase text-stone-500">
            Destination
          </Text>
          <Text className="mt-0.5 text-sm text-stone-800">
            {summary.destinationAddress || "Not available"}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-x-5 gap-y-2 border-t border-stone-100 pt-3">
        <Text className="text-sm text-stone-600">
          {summary.distanceText || "Distance unavailable"}
        </Text>
        <Text className="text-sm text-stone-600">
          {summary.durationText || "Duration unavailable"}
        </Text>
        <Text className="text-sm text-stone-600">
          {formatTravelMode(summary.travelMode)}
        </Text>
        <Text className="text-sm text-stone-600">
          {selectedStopCount} {selectedStopCount === 1 ? "stop" : "stops"}
        </Text>
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-xs text-stone-500">
          Saved {formatSavedDate(trip.updatedAt || trip.createdAt)}
        </Text>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Reopen ${trip.title || "saved trip"}`}
          className="rounded-lg border border-emerald-800/30 bg-emerald-50 px-3 py-2"
        >
          <Text className="text-sm font-semibold text-emerald-950">
            Reopen Trip
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SavedTrips() {
  const router = useRouter();
  const { subscriptionTier, setPremiumForTesting } = useEntitlementStore();
  const {
    savedTrips,
    loadingSavedTrips,
    savedTripsError,
    savedTripsRecoveryRequired,
    loadTrips,
    removeTrip,
    clearTrips,
    setActiveSavedTrip,
    updateTrip,
  } = useSavedTripsStore();
  const [renameTrip, setRenameTrip] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameError, setRenameError] = useState(null);
  const [renamingTrip, setRenamingTrip] = useState(false);

  const featureLimits = getFeatureLimits(subscriptionTier);
  const canSaveTrips = featureLimits.canSaveTrips;
  const savedTripsPremiumCopy = getPremiumFeatureMessage(FEATURES.SAVE_TRIPS);

  useEffect(() => {
    if (canSaveTrips) {
      loadTrips();
    }
  }, [canSaveTrips, loadTrips]);

  function confirmDeleteTrip(trip) {
    Alert.alert(
      "Delete saved trip?",
      "This removes the trip from this device.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => removeTrip(trip.id),
        },
      ],
    );
  }

  function confirmClearAllTrips() {
    Alert.alert(
      "Clear all saved trips?",
      "This removes all saved trips from this device.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => clearTrips(),
        },
      ],
    );
  }

  function confirmResetCorruptedTrips() {
    Alert.alert(
      "Reset Saved Trips?",
      "This removes all saved trips stored on this device. Use this only to recover from corrupted Saved Trips data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Saved Trips",
          style: "destructive",
          onPress: () => clearTrips(),
        },
      ],
    );
  }

  function handleClosePremiumModal() {
    router.replace("/(tabs)/navigate");
  }

  function handleOpenSavedTrip(trip) {
    setActiveSavedTrip(trip);

    router.push({
      pathname: "/(screens)/route",
      params: {
        returnTo: "/(tabs)/saved-trips",
        savedTripId: trip.id,
        mode: "savedTrip",
      },
    });
  }

  function openRenameTripModal(trip) {
    setRenameTrip(trip);
    setRenameTitle(trip.title || "Saved Trip");
    setRenameError(null);
  }

  function closeRenameTripModal() {
    if (renamingTrip) return;

    setRenameTrip(null);
    setRenameTitle("");
    setRenameError(null);
  }

  async function handleRenameTrip() {
    const trimmedTitle = renameTitle.trim();

    if (!renameTrip) return;

    if (!trimmedTitle) {
      setRenameError("Enter a trip name.");
      return;
    }

    try {
      setRenamingTrip(true);
      setRenameError(null);

      const updatedTrip = await updateTrip(renameTrip.id, {
        title: trimmedTitle,
      });

      if (updatedTrip === null) {
        setRenameError("Unable to rename saved trip.");
        return;
      }

      setRenameTrip(null);
      setRenameTitle("");
      setRenameError(null);
    } catch (error) {
      logger.warn("[saved-trips] Rename trip error:", error);
      setRenameError("Unable to rename saved trip.");
    } finally {
      setRenamingTrip(false);
    }
  }

  if (!canSaveTrips) {
    return (
      <View className="flex-1 bg-background px-4 pt-6">
        <Text className="text-2xl font-bold text-white">Saved Trips</Text>
        <Text className="mt-2 text-sm leading-5 text-white/75">
          Save finished routes on this device and return to your adventure plans
          later.
        </Text>

        <PremiumStatusDevCard />

        <PremiumFeatureCard
          title={savedTripsPremiumCopy.title}
          message={savedTripsPremiumCopy.message}
          onClose={handleClosePremiumModal}
          showDevToggle
          onEnablePremiumForTesting={() => setPremiumForTesting(true)}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="px-4 pt-6">
          <Text className="text-2xl font-bold text-white">Saved Trips</Text>
          <Text className="mt-2 text-sm leading-5 text-white/75">
            Finished routes saved locally on this device.
          </Text>

          {!loadingSavedTrips && !savedTripsError && savedTrips.length > 0 && (
            <Pressable
              onPress={confirmClearAllTrips}
              accessibilityRole="button"
              accessibilityLabel="Clear all saved trips"
              className="mt-5 self-start rounded-full border border-red-300 bg-red-100 px-3 py-1"
            >
              <Text className="font-semibold text-red-700">
                Clear All Saved Trips
              </Text>
            </Pressable>
          )}

          {loadingSavedTrips && (
            <View className="mt-6 rounded-2xl bg-white p-4">
              <Text className="text-sm text-stone-600">
                Loading saved trips...
              </Text>
            </View>
          )}

          {!loadingSavedTrips && savedTripsError && (
            <View className="mt-6 rounded-2xl bg-red-50 p-4">
              <Text className="text-sm text-red-700">{savedTripsError}</Text>
              {savedTripsRecoveryRequired && (
                <Pressable
                  onPress={confirmResetCorruptedTrips}
                  className="mt-4 self-start rounded-lg bg-red-700 px-4 py-3"
                >
                  <Text className="font-semibold text-white">
                    Reset Saved Trips
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {!loadingSavedTrips &&
            !savedTripsError &&
            savedTrips.length === 0 && (
              <View className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
                <Text className="text-xl font-bold text-emerald-950">
                  No saved trips yet
                </Text>
                <Text className="mt-2 text-sm leading-5 text-stone-600">
                  Build a final route with at least one stop, then tap Save
                  Trip.
                </Text>
              </View>
            )}

          {!loadingSavedTrips && !savedTripsError && savedTrips.length > 0 && (
            <View className="mt-6">
              {savedTrips.map((trip) => (
                <SavedTripCard
                  key={trip.id}
                  trip={trip}
                  onOpen={() => handleOpenSavedTrip(trip)}
                  onDelete={() => confirmDeleteTrip(trip)}
                  onRename={() => openRenameTripModal(trip)}
                />
              ))}
            </View>
          )}

          <PremiumStatusDevCard />
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(renameTrip)}
        transparent
        animationType="fade"
        onRequestClose={closeRenameTripModal}
      >
        <View className="flex-1 justify-center bg-black/50 px-5">
          <View className="rounded-3xl bg-white p-5 shadow-lg">
            <Text className="text-xl font-bold text-emerald-950">
              Rename saved trip
            </Text>

            <Text className="mt-2 text-sm text-stone-600">
              Give this trip a name that will be easy to recognize later.
            </Text>

            <TextInput
              value={renameTitle}
              onChangeText={(text) => {
                setRenameTitle(text);
                setRenameError(null);
              }}
              placeholder="Trip name"
              autoFocus
              className="mt-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-base text-stone-900"
            />

            {renameError && (
              <Text className="mt-2 text-sm text-red-600">{renameError}</Text>
            )}

            <View className="mt-5 gap-3">
              <Pressable
                onPress={handleRenameTrip}
                disabled={renamingTrip}
                className={`rounded-xl px-4 py-3 ${
                  renamingTrip ? "bg-emerald-800/60" : "bg-emerald-800"
                }`}
              >
                <Text className="text-center font-semibold text-white">
                  {renamingTrip ? "Saving..." : "Save Name"}
                </Text>
              </Pressable>

              <Pressable
                onPress={closeRenameTripModal}
                disabled={renamingTrip}
                className="rounded-xl border border-stone-200 px-4 py-3"
              >
                <Text className="text-center font-semibold text-emerald-950">
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
