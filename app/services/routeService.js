import { isDemoModeEnabled } from "../config/demoMode";
import { createDemoRoute } from "../fixtures/demoData";
import { buildGoogleRoute, getRoutingPreferenceForRoute } from "./googleRoutes";
import { routeRequestCache } from "./apiRequestCaches";
import {
  recordCacheHit,
  recordDemoOperation,
  recordHighLevelOperation,
  recordInFlightDeduplication,
} from "./apiUsageTracker";
import { createRouteRequestKey } from "../utils/requestKeys";
export function buildRoute(params) {
  recordHighLevelOperation("build-route");
  if (isDemoModeEnabled) {
    recordDemoOperation("route");
    return Promise.resolve(createDemoRoute(params));
  }
  const normalizedParams = {
    ...params,
    purpose: params?.purpose || "preview",
    routingPreference: getRoutingPreferenceForRoute(params),
  };
  return routeRequestCache.load(
    createRouteRequestKey(normalizedParams),
    () => buildGoogleRoute(normalizedParams),
    {
      onCacheHit: () => recordCacheHit("google", "routes"),
      onInFlightDeduplicated: () =>
        recordInFlightDeduplication("google", "routes"),
    },
  );
}
