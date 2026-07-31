// Expo app configuration moved to JavaScript so comments can document
// intent, structure, and platform-specific behavior.

module.exports = {
  expo: {
    // Human-readable app name shown on device home screens and stores.
    name: "Wander North",

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
      image: "./assets/images/splash.png",

      // "contain" preserves image aspect ratio without cropping.
      resizeMode: "contain",

      // Background color visible around splash image on non-full-bleed assets.
      backgroundColor: "#ffffff",
    },

    ios: {
      // Allows optimized iPad/tablet support in addition to iPhone layouts.
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Wander North uses your location only when you choose Current Location to plan a route.",
      },
    },

    android: {
      // Android application ID (reverse-domain format).
      // Changing this after publishing creates a new app identity in Play Store.
      package: "com.rob.wandernorth",
      versionCode: 1,
      allowBackup: false,
      blockedPermissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
      ],

      config: {
        // Google Maps API key for Android builds (read from environment variable).
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY,
        },
      },

      adaptiveIcon: {
        // Background color behind adaptive icon foreground asset.
        backgroundColor: "#E6F4FE",

        // Foreground layer for adaptive icon.
        foregroundImage: "./assets/icon.png",
      },
    },

    web: {
      // Browser tab icon for web builds.
      favicon: "./assets/icon.png",

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
          // Permission shown for foreground-only location access requests.
          locationWhenInUsePermission:
            "Wander North uses your location only when you choose Current Location to plan a route.",
        },
      ],
    ],
    extra: {
      appEnvironment:
        process.env.EXPO_PUBLIC_APP_ENV ||
        (process.env.NODE_ENV === "development" ? "development" : "production"),
      eas: {
        projectId: "207911a3-9717-4fc3-897b-cbc60459d926",
      },
    },
  },
};
