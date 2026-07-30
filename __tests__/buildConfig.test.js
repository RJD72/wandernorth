describe("external build controls", () => {
  const originalEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

  afterEach(() => {
    if (originalEnvironment === undefined) {
      delete process.env.EXPO_PUBLIC_APP_ENV;
    } else {
      process.env.EXPO_PUBLIC_APP_ENV = originalEnvironment;
    }
    jest.resetModules();
  });

  test.each(["preview", "production"])(
    "disables developer controls and premium mutations in %s",
    (environment) => {
      process.env.EXPO_PUBLIC_APP_ENV = environment;
      jest.resetModules();

      jest.isolateModules(() => {
        const { allowDeveloperControls } = require("../app/config/buildConfig");
        const {
          useEntitlementStore,
        } = require("../app/store/useEntitlementStore");

        expect(allowDeveloperControls).toBe(false);
        useEntitlementStore.getState().setPremiumForTesting(true);
        expect(useEntitlementStore.getState().subscriptionTier).toBe("free");
      });
    },
  );
});
