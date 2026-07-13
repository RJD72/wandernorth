import { create } from "zustand";

import {
  clearSavedTrips,
  deleteSavedTrip,
  loadSavedTrips,
  loadSavedTripById,
  saveTrip,
  updateSavedTrip,
} from "../services/savedTripsService";
import { logger } from "../utils/logger";

function getSavedTripsMessage(error, fallback) {
  if (
    error?.code === "corrupt-storage" ||
    error?.code === "unsupported-storage"
  )
    return "Saved Trips data on this device is corrupted. Reset Saved Trips to recover.";
  if (error?.code === "trip-not-found")
    return "This saved trip could not be found on this device.";
  if (error?.code === "invalid-title")
    return "Enter a title for this saved trip.";
  if (error?.code === "invalid-trip-payload")
    return "This trip is incomplete and could not be saved.";
  return fallback;
}

export const useSavedTripsStore = create((set) => ({
  savedTrips: [],
  loadingSavedTrips: false,
  savedTripsError: null,
  savedTripsRecoveryRequired: false,
  activeSavedTrip: null,

  setActiveSavedTrip: (activeSavedTrip) => set({ activeSavedTrip }),

  clearActiveSavedTrip: () => set({ activeSavedTrip: null }),

  loadTrips: async () => {
    set({
      loadingSavedTrips: true,
      savedTripsError: null,
    });

    try {
      const savedTrips = await loadSavedTrips();
      set({ savedTrips, savedTripsRecoveryRequired: false });
      return savedTrips;
    } catch (error) {
      logger.warn("[useSavedTripsStore] loadTrips error:", error);
      set({
        savedTrips: [],
        savedTripsError: getSavedTripsMessage(
          error,
          "Unable to load saved trips.",
        ),
        savedTripsRecoveryRequired: [
          "corrupt-storage",
          "unsupported-storage",
        ].includes(error?.code),
      });
      return [];
    } finally {
      set({ loadingSavedTrips: false });
    }
  },

  loadTripById: async (tripId) => {
    set({ savedTripsError: null });
    try {
      const trip = await loadSavedTripById(tripId);
      set((state) => ({
        activeSavedTrip: trip,
        savedTrips: state.savedTrips.some((item) => item.id === trip.id)
          ? state.savedTrips.map((item) => (item.id === trip.id ? trip : item))
          : state.savedTrips,
      }));
      return trip;
    } catch (error) {
      logger.warn("[useSavedTripsStore] loadTripById error code:", error?.code);
      set({
        savedTripsError: getSavedTripsMessage(
          error,
          "Unable to reopen saved trip.",
        ),
      });
      return null;
    }
  },

  addTrip: async (trip) => {
    set({ savedTripsError: null });

    try {
      const savedTrip = await saveTrip(trip);

      if (savedTrip === null) {
        set({ savedTripsError: "Unable to save trip." });
        return null;
      }

      const savedTrips = await loadSavedTrips();
      set((state) => ({
        savedTrips,
        activeSavedTrip:
          state.activeSavedTrip?.id === savedTrip.id
            ? savedTrip
            : state.activeSavedTrip,
      }));
      return savedTrip;
    } catch (error) {
      logger.warn("[useSavedTripsStore] addTrip error:", error);
      set({
        savedTripsError: getSavedTripsMessage(error, "Unable to save trip."),
      });
      return null;
    }
  },

  removeTrip: async (tripId) => {
    set({ savedTripsError: null });

    try {
      const didDeleteTrip = await deleteSavedTrip(tripId);

      if (!didDeleteTrip) {
        set({ savedTripsError: "Unable to delete saved trip." });
        return false;
      }

      set((state) => ({
        savedTrips: state.savedTrips.filter((trip) => trip.id !== tripId),
        activeSavedTrip:
          state.activeSavedTrip?.id === tripId ? null : state.activeSavedTrip,
      }));
      return true;
    } catch (error) {
      logger.warn("[useSavedTripsStore] removeTrip error:", error);
      set({
        savedTripsError: getSavedTripsMessage(
          error,
          "Unable to delete saved trip.",
        ),
      });
      return false;
    }
  },

  updateTrip: async (tripId, updates) => {
    set({ savedTripsError: null });

    try {
      const updatedTrip = await updateSavedTrip(tripId, updates);

      if (updatedTrip === null) {
        set({ savedTripsError: "Unable to update saved trip." });
        return null;
      }

      const savedTrips = await loadSavedTrips();
      set((state) => ({
        savedTrips,
        activeSavedTrip:
          state.activeSavedTrip?.id === updatedTrip.id
            ? updatedTrip
            : state.activeSavedTrip,
      }));
      return updatedTrip;
    } catch (error) {
      logger.warn("[useSavedTripsStore] updateTrip error:", error);
      set({
        savedTripsError: getSavedTripsMessage(
          error,
          "Unable to update saved trip.",
        ),
      });
      return null;
    }
  },

  clearTrips: async () => {
    set({ savedTripsError: null });

    try {
      const didClearTrips = await clearSavedTrips();

      if (!didClearTrips) {
        set({ savedTripsError: "Unable to clear saved trips." });
        return false;
      }

      set({
        savedTrips: [],
        activeSavedTrip: null,
        savedTripsRecoveryRequired: false,
      });
      return true;
    } catch (error) {
      logger.warn("[useSavedTripsStore] clearTrips error:", error);
      set({ savedTripsError: "Unable to clear saved trips." });
      return false;
    }
  },

  clearSavedTripsError: () =>
    set({
      savedTripsError: null,
      savedTripsRecoveryRequired: false,
    }),
}));
