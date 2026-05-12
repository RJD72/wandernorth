// Import animation utilities from react-native-reanimated
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
// Import icon component from Expo
import { MaterialCommunityIcons } from "@expo/vector-icons";
// Import React hook for side effects
import { useEffect } from "react";

/**
 * AnimatedIcon Component
 * Displays a location icon that animates between two states:
 * - "crosshairs-gps" when actively using current location
 * - "crosshairs" when not using current location
 *
 * @param {boolean} useCurrentLocation - Determines which icon to display and triggers animation
 */
const AnimatedIcon = ({ useCurrentLocation }) => {
  // Shared value tracks animation progress (0 = inactive, 1 = active)
  // Initialize based on current useCurrentLocation prop
  const progress = useSharedValue(useCurrentLocation ? 1 : 0);

  // Effect: Trigger animation when useCurrentLocation prop changes
  useEffect(() => {
    // Animate progress value over 300ms to the target state
    progress.value = withTiming(useCurrentLocation ? 1 : 0, { duration: 300 });
  }, [useCurrentLocation]); // Re-run when useCurrentLocation changes

  // Define animated styles (currently empty but available for future enhancements)
  // Could be used to animate color, scale, rotation, etc.
  const animatedStyle = useAnimatedStyle(() => {
    return {};
  });

  return (
    // Animated wrapper that applies animated styles
    <Animated.View style={animatedStyle}>
      {/* Icon changes based on useCurrentLocation state */}
      <MaterialCommunityIcons
        name={useCurrentLocation ? "crosshairs-gps" : "crosshairs"}
        size={26}
        color="white"
      />
    </Animated.View>
  );
};

export default AnimatedIcon;
