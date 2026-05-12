import { TouchableOpacity } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { Stack, router, useLocalSearchParams } from "expo-router";
const ScreensLayout = () => {
  const params = useLocalSearchParams();

  const handleBackPress = () => {
    router.replace(params.returnTo || "/(tabs)/navigate"); // Navigate back to the specified returnTo path or default to the main navigate tab
  };

  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide the header for all screens in this stack
      }}
    >
      <Stack.Screen
        name="route"
        options={{
          headerStyle: { backgroundColor: "#0B0B0B" }, // Match header background to tab bar
          headerTintColor: "#FFF", // White color for header text/icons
          headerShown: true, // Override global setting to show header
          title: "Your Route", // Set a specific title for the route screen
          tabBarIcon: ({ color }) => (
            <FontAwesome name="map" color={color} size={24} />
          ),

          // Back button in header for navigating to previous screen
          headerLeft: () => (
            <TouchableOpacity onPress={handleBackPress} className="mx-4">
              <FontAwesome name="arrow-left" color="#FFF" size={24} />
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  );
};
export default ScreensLayout;
