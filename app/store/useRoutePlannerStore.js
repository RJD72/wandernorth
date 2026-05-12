// ---------------------------------------------------------------------------
// useRoutePlannerStore.js
// ---------------------------------------------------------------------------
// Global state store for the route planner feature, built with Zustand.
//
// Zustand is a lightweight state-management library. `create` returns a
// custom React hook (`useRoutePlannerStore`) that any component can call to
// read state or dispatch actions — no Provider wrapper required.
//
// This store holds everything the user configures before requesting a route:
//   - Origin / destination addresses and their resolved coordinates
//   - Travel mode (driving, walking, etc.)
//   - How many point-of-interest stops to include
//   - Which categories of points-of-interest the user wants
// ---------------------------------------------------------------------------

import { create } from "zustand";

export const useRoutePlannerStore = create((set) => ({
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  // Human-readable address strings shown in the search inputs.
  // These are display values only — the actual coordinates used for API calls
  // are stored separately in startingCoords / destinationCoords below.
  startingAddress: "",
  destinationAddress: "",

  // Resolved geographic coordinates for the origin and destination.
  // Null until the user selects a location from the autocomplete results.
  // Shape: { latitude: number, longitude: number }
  startingCoords: null,
  destinationCoords: null,

  // The user's chosen travel mode. Consumed by buildGoogleRoute() which maps
  // this to the Google Routes API enum value.
  // Allowed values: "driving" | "walking" | "bicycling" | "transit"
  selectedTravelMode: "driving",

  // How many POI stops to suggest along the route.
  // Defaults to 3; adjustable via the StopCountDropdown component.
  numStops: 3,

  // Array of POI category strings selected by the user (e.g. ["cafe", "park"]).
  // An empty array means no filter — all POI types are considered.
  selectedPoiTypes: [],

  // ---------------------------------------------------------------------------
  // Actions
  // Each action is a thin wrapper around Zustand's `set` function which merges
  // the provided value into the store's state. Components should always use
  // these setters rather than mutating state directly.
  // ---------------------------------------------------------------------------

  // Update the displayed origin address string (e.g. after the user types or
  // selects an autocomplete suggestion)
  setStartingAddress: (startingAddress) => set({ startingAddress }),

  // Update the displayed destination address string
  setDestinationAddress: (destinationAddress) => set({ destinationAddress }),

  // Store the resolved lat/lng for the origin once geocoding is complete
  setStartingCoords: (startingCoords) => set({ startingCoords }),

  // Store the resolved lat/lng for the destination once geocoding is complete
  setDestinationCoords: (destinationCoords) => set({ destinationCoords }),

  // Change the travel mode (e.g. when the user taps a different mode button)
  setSelectedTravelMode: (selectedTravelMode) => set({ selectedTravelMode }),

  // Update the desired number of stops along the route
  setNumStops: (numStops) => set({ numStops }),

  // Replace the entire list of selected POI type filters
  setSelectedPoiTypes: (selectedPoiTypes) => set({ selectedPoiTypes }),

  // ---------------------------------------------------------------------------
  // resetRoutePlanner
  // ---------------------------------------------------------------------------
  // Resets all fields back to their initial default values.
  // Call this when the user wants to start a new route from scratch, or when
  // navigating away from the planner screen to avoid stale state on re-entry.
  // ---------------------------------------------------------------------------
  resetRoutePlanner: () =>
    set({
      startingAddress: "",
      destinationAddress: "",
      startingCoords: null,
      destinationCoords: null,
      selectedTravelMode: "driving",
      numStops: 3,
      selectedPoiTypes: [],
    }),
}));
