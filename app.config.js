// Expo app configuration moved to JavaScript so comments can document
// intent, structure, and platform-specific behavior.

module.exports = {
  expo: {
    // Human-readable app name shown on device home screens and stores.
    name: "wandernorth_V3",

    // URL-safe project identifier used by Expo services and build tooling.
    slug: "wandernorth_V3",

    // Deep-link scheme for links like: wandernorth://path/to/screen
    // Keep this stable once released to avoid breaking existing links.
    scheme: "wandernorth",

    // Marketing/app version shown to users. Increment for each release.
    version: "1.0.0",

    // Locks app orientation to portrait across supported devices.
    orientation: "portrait",

    // Primary app icon used on platforms that do not require adaptive layers.
    icon: "./assets/icon.png",

    // Forces light mode globally unless overridden at the component level.
    userInterfaceStyle: "light",

    splash: {
      // Startup image displayed while native bundle initializes.
      image: "./assets/splash-icon.png",

      // "contain" preserves image aspect ratio without cropping.
      resizeMode: "contain",

      // Background color visible around splash image on non-full-bleed assets.
      backgroundColor: "#ffffff",
    },

    ios: {
      // Allows optimized iPad/tablet support in addition to iPhone layouts.
      supportsTablet: true,
    },

    android: {
      // Android application ID (reverse-domain format).
      // Changing this after publishing creates a new app identity in Play Store.
      package: "com.rob.wandernorth",

      config: {
        // Google Maps API key for Android builds (read from environment variable).
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },

      adaptiveIcon: {
        // Background color behind adaptive icon foreground asset.
        backgroundColor: "#E6F4FE",

        // Foreground layer for adaptive icon.
        foregroundImage: "./assets/android-icon-foreground.png",

        // Background layer image for adaptive icon.
        backgroundImage: "./assets/android-icon-background.png",

        // Monochrome icon used by Android themed icon systems.
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
    },

    web: {
      // Browser tab icon for web builds.
      favicon: "./assets/favicon.png",

      // Uses Metro as the web bundler for parity with native builds.
      bundler: "metro",
    },

    plugins: [
      // Enables file-based routing and navigation conventions via Expo Router.
      "expo-router",

      // Registers the Expo Font native module used by Expo Vector Icons.
      "expo-font",

      // Configures native location permissions text for iOS.
      [
        "expo-location",
        {
          // Permission shown when requesting background + foreground location.
          locationAlwaysAndWhenInUsePermission:
            "Allow $(PRODUCT_NAME) to access your location even when you are not using the app.",

          // Permission shown for foreground-only location access requests.
          locationWhenInUsePermission:
            "Allow $(PRODUCT_NAME) to access your location while you are using the app.",
        },
      ],
    ],
  },
};
