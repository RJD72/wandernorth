import { create } from "zustand";

import {
  SUBSCRIPTION_TIERS,
  isPremiumTier,
} from "../config/featureAccess";

// Mock entitlement state for app-side feature-gate testing.
// This is intentionally not persisted or connected to a payment provider.
export const useEntitlementStore = create((set, get) => ({
  subscriptionTier: SUBSCRIPTION_TIERS.FREE,

  setSubscriptionTier: (subscriptionTier) => set({ subscriptionTier }),

  setPremiumForTesting: (isPremium) =>
    set({
      subscriptionTier: isPremium
        ? SUBSCRIPTION_TIERS.PREMIUM
        : SUBSCRIPTION_TIERS.FREE,
    }),

  togglePremiumForTesting: () => {
    const currentTier = get().subscriptionTier;

    set({
      subscriptionTier: isPremiumTier(currentTier)
        ? SUBSCRIPTION_TIERS.FREE
        : SUBSCRIPTION_TIERS.PREMIUM,
    });
  },
}));
