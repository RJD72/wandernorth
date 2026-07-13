import { SUBSCRIPTION_TIERS } from "../app/config/featureAccess";
import { useEntitlementStore } from "../app/store/useEntitlementStore";

describe("useEntitlementStore integration", () => {
  beforeEach(() => {
    useEntitlementStore.setState({
      subscriptionTier: SUBSCRIPTION_TIERS.FREE,
    });
  });

  test("starts at the Free tier", () => {
    expect(useEntitlementStore.getState().subscriptionTier).toBe("free");
  });

  test("can set Premium and return to Free", () => {
    useEntitlementStore.getState().setSubscriptionTier("premium");
    expect(useEntitlementStore.getState().subscriptionTier).toBe("premium");
    useEntitlementStore.getState().setSubscriptionTier("free");
    expect(useEntitlementStore.getState().subscriptionTier).toBe("free");
  });

  test("testing setter maps booleans to known tiers", () => {
    useEntitlementStore.getState().setPremiumForTesting(true);
    expect(useEntitlementStore.getState().subscriptionTier).toBe("premium");
    useEntitlementStore.getState().setPremiumForTesting(false);
    expect(useEntitlementStore.getState().subscriptionTier).toBe("free");
  });

  test("toggle moves between Premium and Free", () => {
    useEntitlementStore.getState().togglePremiumForTesting();
    expect(useEntitlementStore.getState().subscriptionTier).toBe("premium");
    useEntitlementStore.getState().togglePremiumForTesting();
    expect(useEntitlementStore.getState().subscriptionTier).toBe("free");
  });

  test("an unknown tier follows the existing non-premium toggle contract", () => {
    useEntitlementStore.getState().setSubscriptionTier("unknown");
    expect(useEntitlementStore.getState().subscriptionTier).toBe("unknown");
    useEntitlementStore.getState().togglePremiumForTesting();
    expect(useEntitlementStore.getState().subscriptionTier).toBe("premium");
  });
});
