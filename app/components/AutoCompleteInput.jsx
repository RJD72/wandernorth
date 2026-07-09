import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Keyboard,
} from "react-native";
import WNInput from "./WNInput";
import { logger } from "../utils/logger";
import { get } from "react-native/Libraries/TurboModule/TurboModuleRegistry";

const MAX_CUSTOM_TEXT_SEARCH_POINTS = 5;
const CUSTOM_TEXT_SEARCH_RADIUS_METERS = 12000;

function getAndroidRestrictionHeaders() {
  const androidPackageName = process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME;
  const androidCertSha1 = process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1;

  if (!androidPackageName || !androidCertSha1) {
    return {};
  }

  return {
    "X-Android-Package": androidPackageName,
    "X-Android-Cert": androidCertSha1,
  };
}

function isValidSearchPoint(point) {
  return (
    point &&
    typeof point.latitude === "number" &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude)
  );
}

function normalizeTextSearchPlace(place) {
  const title = place?.displayName?.text;

  if (!place?.id || !title) return null;

  return {
    place_id: place.id,
    description: place.formattedAddress
      ? `${title} · ${place.formattedAddress}`
      : title,
    source: "text-search",
  };
}

function mergePredictions(...predictionGroups) {
  const seenPlaceIds = new Set();

  return predictionGroups.flat().filter((prediction) => {
    if (!prediction?.place_id || seenPlaceIds.has(prediction.place_id)) {
      return false;
    }

    seenPlaceIds.add(prediction.place_id);
    return true;
  });
}

async function fetchRouteTextSearchPredictions({
  inputText,
  searchPoints,
  apiKey,
}) {
  const routeSearchPoints = searchPoints
    .filter(isValidSearchPoint)
    .slice(0, MAX_CUSTOM_TEXT_SEARCH_POINTS);

  const searchResults = await Promise.allSettled(
    routeSearchPoints.map(async (point) => {
      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            ...getAndroidRestrictionHeaders(),
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType",
          },
          body: JSON.stringify({
            textQuery: inputText,
            locationBias: {
              circle: {
                center: {
                  latitude: point.latitude,
                  longitude: point.longitude,
                },
                radius: CUSTOM_TEXT_SEARCH_RADIUS_METERS,
              },
            },
            regionCode: "CA",
            maxResultCount: 5,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Places Text Search failed: ${response.status}`);
      }

      const data = await response.json();

      return (data.places ?? []).map(normalizeTextSearchPlace).filter(Boolean);
    }),
  );

  return searchResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

/**
 * AutocompleteInput Component
 *
 * A location search component that provides real-time autocomplete suggestions
 * using the Google Maps Places API. Features debounced input, place detail fetching,
 * and coordinate extraction.
 */
export default function AutocompleteInput({
  label,
  value,
  onChangeText,
  onSelectLocation,
  placeholder,
  editable = true,
  rightElement = null,
  onDropdownVisibleChange = () => {}, // Callback to notify parent when dropdown visibility changes
  autocompleteTypes = "geocode",
  locationBias = null,
  strictBounds = false,
  dropdownMode = "absolute",
  customSearchPoints = [],
}) {
  // ============ STATE MANAGEMENT ============

  // Controls loading state while fetching predictions
  const [loading, setLoading] = useState(false);

  // Stores array of autocomplete predictions from Google API
  const [predictions, setPredictions] = useState([]);

  // Controls visibility of the dropdown suggestions list
  const [showList, setShowList] = useState(false);

  // Local input value, synced with parent via useEffect
  const [input, setInput] = useState(value || "");

  // Flag to track if user is actively typing (used for debouncing)
  const [isTyping, setIsTyping] = useState(false);

  // ============ CONFIGURATION ============

  // Retrieve Google Maps API key from environment config
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Reference to the TextInput inside WNInput for focus/blur control
  const inputRef = useRef(null);
  const latestPredictionRequestId = useRef(0);

  // ============ EFFECTS ============
  useEffect(() => {
    onDropdownVisibleChange(showList); // Notify parent whenever dropdown visibility changes
  }, [showList]);

  /**
   * Sync local input state with parent value prop
   * Ensures component updates when parent changes the value externally
   */
  useEffect(() => {
    setInput(value || ""); // Value is a prop from parent, so we update local state whenever it changes. This allows the parent to programmatically set the input value (e.g. clearing it after selection) and ensures our component reflects that change. We also default to an empty string if value is undefined to avoid uncontrolled input issues.
  }, [value]);

  /**
   * Debounced prediction fetching on input change
   * Only fetches predictions while user is typing and input is 2+ characters
   * 300ms debounce prevents excessive API calls
   */
  /** Mental Model
   * Wait until the user pauses typing for 300ms before making an API call. This allows users to type without triggering an API call on every keystroke, which would waste API quota and lead to a poor user experience. The dropdown will only show when the user is actively typing and has entered enough characters to yield useful results. If the user deletes characters and the input becomes too short, we clear the predictions and hide the dropdown immediately to avoid showing irrelevant suggestions.
   */
  useEffect(() => {
    if (!isTyping) return; // Only fetch when user is actively typing. Stops dropdown from reopening after selection when input is programmatically updated.

    // Clear predictions if input is too short
    // Don't waste API calls on very short input that won't yield useful results
    if (!input || input.length < 2) {
      latestPredictionRequestId.current += 1;
      setPredictions([]);
      setShowList(false);
      setLoading(false);
      return;
    }

    // Debounce timer: wait 300ms after user stops typing before fetching
    // This allows users to type without triggering an API call on every keystroke and wasting API quota
    const timer = setTimeout(() => {
      fetchPredictions(input);
    }, 300);

    // Cleanup previous timer if input changes before timeout completes
    return () => clearTimeout(timer);
  }, [input, isTyping]);

  // ============ API CALLS ============

  /**
   * Fetch autocomplete predictions from Google Places API
   * Filters results to Canadian locations (geocode type only)
   *
   * Mental Model: When the user types into the input, we want to provide real-time suggestions for locations. We call the Google Places Autocomplete API with the user's input, restricting results to geocoded addresses in Canada. The API returns a list of predictions based on the input, which we display in a dropdown below the input field. If the API returns results, we show them; if there are no results or an error occurs, we clear the predictions and hide the dropdown to avoid showing irrelevant suggestions.
   * @param {string} inputText - The user's input text to search for
   */
  const fetchPredictions = async (inputText) => {
    const requestId = latestPredictionRequestId.current + 1;
    latestPredictionRequestId.current = requestId;

    try {
      setLoading(true);

      // Build URL with encoded input and API filters
      let url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
        `input=${encodeURIComponent(inputText)}` + // Takes user input & makes it safe for URL (e.g. spaces become %20)
        `&components=country:ca`; // Restrict results to Canadian locations

      if (typeof autocompleteTypes === "string" && autocompleteTypes.trim()) {
        url += `&types=${encodeURIComponent(autocompleteTypes.trim())}`;
      }

      if (locationBias) {
        url +=
          `&location=${locationBias.latitude},${locationBias.longitude}` +
          `&radius=${locationBias.radiusMeters}`;

        if (strictBounds) {
          url += `&strictbounds=true`;
        }
      }

      url += `&key=${apiKey}`;

      const res = await fetch(url, {
        headers: {
          ...getAndroidRestrictionHeaders(),
        },
      });
      const data = await res.json();

      if (latestPredictionRequestId.current !== requestId) {
        return;
      }

      const autocompletePredictions =
        data.status === "OK" && data.predictions?.length > 0
          ? data.predictions
          : [];

      const shouldRunRouteTextSearch =
        inputText.length >= 2 &&
        customSearchPoints.length > 0 &&
        (dropdownMode === "inline" || autocompleteTypes === null);

      const textSearchPredictions = shouldRunRouteTextSearch
        ? await fetchRouteTextSearchPredictions({
            inputText,
            searchPoints: customSearchPoints,
            apiKey,
          })
        : [];

      if (latestPredictionRequestId.current !== requestId) {
        return;
      }

      const mergedPredictions = mergePredictions(
        textSearchPredictions,
        autocompletePredictions,
      );

      if (mergedPredictions.length > 0) {
        setPredictions(mergedPredictions);
        setShowList(true);
      } else {
        setPredictions([]);
        setShowList(false);
      }
    } catch (err) {
      if (latestPredictionRequestId.current !== requestId) {
        return;
      }

      logger.log("Autocomplete error:", err);
      setPredictions([]);
      setShowList(false);
    } finally {
      if (latestPredictionRequestId.current === requestId) {
        setLoading(false);
      }
    }
  };

  /**
   * Fetch detailed place information including coordinates
   * Called after user selects a prediction to get full address and location
   * Mental Model: When the user selects a prediction from the dropdown, we have the place ID but not the full address or coordinates. We need to make a second API call to the Google Places Details endpoint using the place ID to retrieve the formatted address and geographic coordinates (latitude and longitude). This allows us to provide complete location information back to the parent component, which can use it for mapping or other purposes. If the API call is successful, we return an object with the formatted address and coordinates; if there's an error, we return null.
   *
   * @param {string} placeId - The Google Place ID from the prediction
   * @returns {Object|null} Object with address and coordinates, or null on error
   */
  const fetchPlaceDetails = async (placeId) => {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json?` +
        `place_id=${placeId}` +
        `&fields=formatted_address,geometry` +
        `&key=${apiKey}`;

      const res = await fetch(url, {
        headers: {
          ...getAndroidRestrictionHeaders(),
        },
      });
      const data = await res.json();

      // Extract and format the location data
      if (data.status === "OK") {
        // Return formatted address and coordinates in a consistent format for parent component
        return {
          address: data.result.formatted_address,
          coords: {
            latitude: data.result.geometry.location.lat,
            longitude: data.result.geometry.location.lng,
          },
        };
      }
    } catch (err) {
      logger.log("Place details error:", err);
    }

    return null;
  };

  // ============ EVENT HANDLERS ============

  /**
   * Handle prediction selection
   * Updates input, closes dropdown, fetches full details, and notifies parent
   * Mental Model: When the user taps on a prediction in the dropdown, we want to immediately update the input field with the selected prediction's description for a responsive feel. We also want to close the dropdown and stop treating the input as "typing" to prevent it from reopening. Then, we make an API call to fetch the full place details using the place ID from the prediction. Once we have the full address and coordinates, we update the input with the formatted address and call the onSelectLocation callback to pass this information back to the parent component for further use (e.g. displaying on a map).
   *
   * @param {Object} prediction - The selected prediction object
   */
  const handleSelect = async (prediction) => {
    latestPredictionRequestId.current += 1;

    // Stop treating input as "typing" to prevent dropdown reopening
    setIsTyping(false);

    // Blur input and dismiss keyboard first to prevent React Native
    // from intercepting the first tap on the dropdown
    inputRef.current?.blur();
    Keyboard.dismiss();

    // Close the suggestions dropdown
    setShowList(false);
    setPredictions([]);

    // Optimistically update input with prediction description
    setInput(prediction.description);
    onChangeText(prediction.description);

    // Fetch full place details to get coordinates
    const details = await fetchPlaceDetails(prediction.place_id);

    // Update with formatted address and notify parent via callback
    if (details) {
      setInput(details.address);
      onChangeText(details.address);
      onSelectLocation(details.address, details.coords);
    }
  };

  /**
   * Handle input text changes
   * Marks component as "typing" to trigger debounced fetch
   * Mental Model: Whenever the user types into the input field, we want to update our local input state immediately for a responsive UI. We also set the isTyping flag to true, which allows our useEffect to trigger the debounced API call to fetch predictions. By calling onChangeText, we also notify the parent component of the input change, allowing it to sync with our local state (e.g. for form management). This creates a controlled component where the parent can also programmatically update the input value if needed.
   *
   * @param {string} text - The new input text
   */
  const handleInputChange = (text) => {
    setIsTyping(true); // Mark as typing to enable debounced fetching in useEffect - state is used to control when we want to fetch predictions based on user activity
    setInput(text); // Update local input state immediately for responsive UI -state is used to control the value of the input field
    onChangeText(text); // Notify parent of input change for controlled component behavior - prop callback allows parent to sync with input changes (e.g. for form state management)
  };

  /**
   * Handle input focus
   * Empty handler: dropdown only reopens on typing, not on refocus
   * Mental Model: We want to control when the dropdown suggestions list appears. It should only appear when the user is actively typing and has entered enough characters, not just when they focus the input. By leaving this handler empty, we prevent the dropdown from reopening when the user taps back into the input after making a selection or when they focus it without typing. This allows for a cleaner user experience where the dropdown only shows relevant suggestions based on user input activity.
   */
  const handleInputFocus = () => {};

  // ============ RENDER ============

  return (
    <View className="relative">
      {/* Location input field */}
      <WNInput
        ref={inputRef}
        label={label}
        value={input}
        onChangeText={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        editable={editable}
        rightElement={rightElement}
        withBottomMargin={!(dropdownMode === "inline" && showList)}
      />

      {/* Dropdown suggestions list */}
      {showList && (
        <View
          style={
            dropdownMode === "inline"
              ? { maxHeight: 240 }
              : { maxHeight: 240, zIndex: 1003, elevation: 1003 }
          }
          className={
            dropdownMode === "inline"
              ? "mt-0 overflow-hidden rounded-xl border border-emerald-800/20 bg-white shadow-lg"
              : "absolute left-0 right-0 top-[85%] z-50 rounded-xl border border-emerald-800/20 bg-white shadow-lg"
          }
        >
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator
            style={{ maxHeight: 200 }}
          >
            {/* Loading indicator */}
            {loading && (
              <View className="p-3 items-center">
                <ActivityIndicator size="small" color="#0000FF" />
                <Text className="mt-2 text-xs text-stone-900">Loading...</Text>
              </View>
            )}

            {/* No results message */}
            {!loading && predictions.length === 0 && input.length >= 2 && (
              <View className="p-3 items-center">
                <Text className="text-gray-500">No results found</Text>
              </View>
            )}

            {/* Prediction list items */}
            {predictions.map((p) => (
              <Pressable
                key={p.place_id}
                onPress={() => handleSelect(p)}
                className="border-b border-emerald-800/10 p-3"
              >
                <Text className="text-stone-900">{p.description}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
