const runtimeDevelopment =
  typeof __DEV__ !== "undefined" ? Boolean(__DEV__) : false;

export const APP_ENVIRONMENT =
  process.env.EXPO_PUBLIC_APP_ENV ||
  (runtimeDevelopment ? "development" : "production");

export const isDevelopmentBuild =
  runtimeDevelopment && APP_ENVIRONMENT === "development";
export const isPreviewBuild = APP_ENVIRONMENT === "preview";
export const isProductionBuild = APP_ENVIRONMENT === "production";

export const allowDeveloperControls = isDevelopmentBuild;

export const allowPremiumTesting =
  allowDeveloperControls ||
  (isPreviewBuild &&
    process.env.EXPO_PUBLIC_ALLOW_BETA_PREMIUM_TESTING === "true");

export const allowDemoMode =
  (isDevelopmentBuild && process.env.EXPO_PUBLIC_USE_DEMO_DATA === "true") ||
  (isPreviewBuild && process.env.EXPO_PUBLIC_ALLOW_BETA_DEMO_DATA === "true");
