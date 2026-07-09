import { create } from "zustand";

import {
  clearSavedTrips,
  deleteSavedTrip,
  loadSavedTrips,
  saveTrip,
  updateSavedTrip,
} from "../services/savedTripsService";
import { logger } from "../utils/logger";

export const useSavedTripsStore = create((set) => ({
  savedTrips: [],
  loadingSavedTrips: false,
  savedTripsError: null,
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
      set({ savedTrips });
      return savedTrips;
    } catch (error) {
      logger.warn("[useSavedTripsStore] loadTrips error:", error);
      set({ savedTripsError: "Unable to load saved trips." });
      return [];
    } finally {
      set({ loadingSavedTrips: false });
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
      set({ savedTrips });
      return savedTrip;
    } catch (error) {
      logger.warn("[useSavedTripsStore] addTrip error:", error);
      set({ savedTripsError: "Unable to save trip." });
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
      set({ savedTripsError: "Unable to delete saved trip." });
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
      set({ savedTripsError: "Unable to update saved trip." });
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

      set({ savedTrips: [], activeSavedTrip: null });
      return true;
    } catch (error) {
      logger.warn("[useSavedTripsStore] clearTrips error:", error);
      set({ savedTripsError: "Unable to clear saved trips." });
      return false;
    }
  },

  clearSavedTripsError: () => set({ savedTripsError: null }),
}));
