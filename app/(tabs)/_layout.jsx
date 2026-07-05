// Import global styles
import "../../global.css";
// Import routing and tab navigation from expo-router
import { router, Tabs } from "expo-router";
// Import FontAwesome icons from expo
import FontAwesome from "@expo/vector-icons/FontAwesome";
// Import TouchableOpacity for pressable components
import { TouchableOpacity } from "react-native";

/**
 * RootLayout component - Sets up the main tab navigation structure
 * for the application with four primary tabs: Home, Explore, Navigate, and Saved
 */
export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        // Dark background color for the tab bar
        tabBarStyle: { backgroundColor: "#0B0B0B", borderTopWidth: 0 },
        // Green color for active tab icons
        tabBarActiveTintColor: "#4ADE80",
        // White color for inactive tab icons
        tabBarInactiveTintColor: "#FFF",
        // Hide the header globally (can be overridden per screen)
        headerShown: false,
      }}
    >
      {/* Home Tab - Landing page */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <FontAwesome name="home" color={color} size={24} />
          ),
        }}
      />

      {/* Explore Tab - Search/browse functionality */}
      <Tabs.Screen
        name="explore"
        options={{
          headerStyle: { backgroundColor: "#0B0B0B" }, // Match header background to tab bar
          headerTintColor: "#FFF", // White color for header text/icons
          headerShown: true, // Override global setting to show header
          title: "Explore",
          tabBarIcon: ({ color }) => (
            <FontAwesome name="search" color={color} size={24} />
          ),
          // Back button in header for navigating to previous screen
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mx-4">
              <FontAwesome name="arrow-left" color="#FFF" size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Navigate Tab - Map/navigation functionality */}
      <Tabs.Screen
        name="navigate"
        options={{
          headerStyle: { backgroundColor: "#0B0B0B" }, // Match header background to tab bar
          headerTintColor: "#FFF", // White color for header text/icons
          headerShown: true, // Override global setting to show header
          title: "Navigate",
          tabBarIcon: ({ color }) => (
            <FontAwesome name="map" color={color} size={24} />
          ),
          // Back button in header for navigating to previous screen
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mx-4">
              <FontAwesome name="arrow-left" color="#FFF" size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Saved Trips Tab - Locally stored finished routes */}
      <Tabs.Screen
        name="saved-trips"
        options={{
          headerStyle: { backgroundColor: "#0B0B0B" },
          headerTintColor: "#FFF",
          headerShown: true,
          title: "Saved",
          tabBarIcon: ({ color }) => (
            <FontAwesome name="bookmark" color={color} size={24} />
          ),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="mx-4">
              <FontAwesome name="arrow-left" color="#FFF" size={24} />
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}
