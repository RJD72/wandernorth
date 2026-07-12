import { isDemoModeEnabled } from "../config/demoMode";
import { createDemoRoute } from "../fixtures/demoData";
import { buildGoogleRoute } from "./googleRoutes";
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
  return routeRequestCache.load(
    createRouteRequestKey(params),
    () => buildGoogleRoute(params),
    {
      onCacheHit: () => recordCacheHit("google", "routes"),
      onInFlightDeduplicated: () =>
        recordInFlightDeduplication("google", "routes"),
    },
  );
}
