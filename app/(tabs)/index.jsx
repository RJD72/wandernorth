import { StatusBar } from "expo-status-bar";
import { Dimensions, Image, ImageBackground, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Capture the viewport size once for this static, full-screen hero layout.
// These dimensions are used by the background image so it always fills the screen.
const { width, height } = Dimensions.get("window");

// Home tab screen:
// - wraps content in SafeAreaProvider for safe-area aware layout behavior
// - renders a full-screen branded background
// - places the logo near the top as the primary visual focus
export default function App() {
  return (
    // Provides safe-area context for descendants (notches, status bars, etc.).
    <SafeAreaProvider>
      {/* Root flex container ensures child views can expand to full available height. */}
      <View className="flex-1">
        {/*
          Full-screen background image.
          Using explicit width/height from Dimensions guarantees the image
          covers the viewport regardless of parent sizing quirks.
        */}
        <ImageBackground
          source={require("../../assets/images/background.png")}
          style={{ width, height }}
        >
          {/*
            Logo container:
            - fixed height keeps brand area consistent
            - top margin/padding positions logo below the status bar area
          */}
          <View className="h-[200px] w-full py-2 mt-8">
            {/* Centered logo scaled proportionally inside the header area. */}
            <Image
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              className="mx-auto w-full h-full"
            />
          </View>

          {/* Uses automatic status bar style based on current background/content. */}
          <StatusBar style="auto" />
        </ImageBackground>
      </View>
    </SafeAreaProvider>
  );
}
