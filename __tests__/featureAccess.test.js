import {
  FEATURES,
  SUBSCRIPTION_TIERS,
  canUseFeature,
  getFeatureLimits,
  getPremiumFeatureMessage,
} from "../app/config/featureAccess";

describe("featureAccess", () => {
  test("free limits match the current product contract", () => {
    expect(getFeatureLimits(SUBSCRIPTION_TIERS.FREE)).toMatchObject({
      canUseExplore: false,
      canSaveTrips: false,
      maxSuggestedStops: 3,
      maxCustomStops: 1,
      maxSavedTrips: 0,
    });
  });

  test("premium limits enable features and remove numeric caps", () => {
    expect(getFeatureLimits(SUBSCRIPTION_TIERS.PREMIUM)).toMatchObject({
      canUseExplore: true,
      canSaveTrips: true,
      maxSuggestedStops: Infinity,
      maxCustomStops: Infinity,
      maxSavedTrips: Infinity,
    });
  });

  test("unknown tiers safely use Free limits", () => {
    expect(getFeatureLimits("unknown")).toBe(
      getFeatureLimits(SUBSCRIPTION_TIERS.FREE),
    );
  });

  test("Explore and Saved Trips are gated by tier", () => {
    expect(canUseFeature(SUBSCRIPTION_TIERS.FREE, FEATURES.EXPLORE)).toBe(false);
    expect(canUseFeature(SUBSCRIPTION_TIERS.PREMIUM, FEATURES.EXPLORE)).toBe(true);
    expect(canUseFeature(SUBSCRIPTION_TIERS.FREE, FEATURES.SAVE_TRIPS)).toBe(false);
    expect(canUseFeature(SUBSCRIPTION_TIERS.PREMIUM, FEATURES.SAVE_TRIPS)).toBe(
      true,
    );
  });

  test("automatic-stop and custom-stop premium gates follow the limits", () => {
    expect(
      canUseFeature(SUBSCRIPTION_TIERS.FREE, FEATURES.MORE_AUTOMATIC_STOPS),
    ).toBe(false);
    expect(
      canUseFeature(SUBSCRIPTION_TIERS.PREMIUM, FEATURES.MORE_AUTOMATIC_STOPS),
    ).toBe(true);
    expect(
      canUseFeature(SUBSCRIPTION_TIERS.FREE, FEATURES.MULTIPLE_CUSTOM_STOPS),
    ).toBe(false);
    expect(
      canUseFeature(SUBSCRIPTION_TIERS.PREMIUM, FEATURES.MULTIPLE_CUSTOM_STOPS),
    ).toBe(true);
  });

  test("every declared feature has a usable premium message", () => {
    for (const feature of Object.values(FEATURES)) {
      expect(getPremiumFeatureMessage(feature)).toEqual({
        title: expect.any(String),
        message: expect.any(String),
      });
      expect(getPremiumFeatureMessage(feature).title).not.toBe("");
      expect(getPremiumFeatureMessage(feature).message).not.toBe("");
    }
  });
});
