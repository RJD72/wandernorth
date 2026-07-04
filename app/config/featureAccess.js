export const SUBSCRIPTION_TIERS = {
  FREE: "free",
  PREMIUM: "premium",
};

export const FEATURES = {
  EXPLORE: "explore",
  SAVE_TRIPS: "saveTrips",
  FIND_ANOTHER_ADVENTURE: "findAnotherAdventure",
  ADVANCED_POI_FILTERS: "advancedPoiFilters",
  MORE_AUTOMATIC_STOPS: "moreAutomaticStops",
  MULTIPLE_CUSTOM_STOPS: "multipleCustomStops",
};

export const FEATURE_LIMITS = {
  [SUBSCRIPTION_TIERS.FREE]: {
    canUseExplore: false,
    canSaveTrips: false,
    canFindAnotherAdventure: false,
    canUseAdvancedPoiFilters: false,
    maxSuggestedStops: 3,
    maxCustomStops: 1,
    maxSavedTrips: 0,
  },
  [SUBSCRIPTION_TIERS.PREMIUM]: {
    canUseExplore: true,
    canSaveTrips: true,
    canFindAnotherAdventure: true,
    canUseAdvancedPoiFilters: true,
    maxSuggestedStops: Number.POSITIVE_INFINITY,
    maxCustomStops: Number.POSITIVE_INFINITY,
    maxSavedTrips: Number.POSITIVE_INFINITY,
  },
};

export function isPremiumTier(subscriptionTier) {
  return subscriptionTier === SUBSCRIPTION_TIERS.PREMIUM;
}

export function getFeatureLimits(
  subscriptionTier = SUBSCRIPTION_TIERS.FREE,
) {
  return (
    FEATURE_LIMITS[subscriptionTier] ??
    FEATURE_LIMITS[SUBSCRIPTION_TIERS.FREE]
  );
}

export function canUseFeature(subscriptionTier, feature) {
  const limits = getFeatureLimits(subscriptionTier);

  switch (feature) {
    case FEATURES.EXPLORE:
      return limits.canUseExplore;
    case FEATURES.SAVE_TRIPS:
      return limits.canSaveTrips;
    case FEATURES.FIND_ANOTHER_ADVENTURE:
      return limits.canFindAnotherAdventure;
    case FEATURES.ADVANCED_POI_FILTERS:
      return limits.canUseAdvancedPoiFilters;
    case FEATURES.MORE_AUTOMATIC_STOPS:
      return (
        limits.maxSuggestedStops >
        FEATURE_LIMITS[SUBSCRIPTION_TIERS.FREE].maxSuggestedStops
      );
    case FEATURES.MULTIPLE_CUSTOM_STOPS:
      return (
        limits.maxCustomStops >
        FEATURE_LIMITS[SUBSCRIPTION_TIERS.FREE].maxCustomStops
      );
    default:
      return false;
  }
}

export function getPremiumFeatureMessage(feature) {
  switch (feature) {
    case FEATURES.EXPLORE:
      return {
        title: "Explore is a Premium feature",
        message:
          "Explore lets you choose a direction and travel time, then Wander North finds an adventure route for you.",
      };
    case FEATURES.SAVE_TRIPS:
      return {
        title: "Saved Trips are a Premium feature",
        message:
          "Premium will let you save routes, reopen trips, and build from previous adventures.",
      };
    case FEATURES.MORE_AUTOMATIC_STOPS:
      return {
        title: "More stops are a Premium feature",
        message:
          "Free routes include up to 3 automatic stops. Premium will let you plan routes with more suggested stops.",
      };
    case FEATURES.MULTIPLE_CUSTOM_STOPS:
      return {
        title: "Multiple custom stops are a Premium feature",
        message:
          "Free routes include 1 custom stop. Premium will let you add more custom stops to your route.",
      };
    default:
      return {
        title: "Premium feature",
        message: "This feature is planned for Wander North Premium.",
      };
  }
}
