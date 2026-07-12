import { isDemoModeEnabled } from "../config/demoMode";
import { DEMO_POIS } from "../fixtures/demoData";
import { fetchPoisNearRoutePoints } from "./poiService";
import { activePoiProviders } from "./poiProviders";
import { poiRequestCache } from "./apiRequestCaches";
import {
  recordCacheHit,
  recordDemoOperation,
  recordHighLevelOperation,
  recordInFlightDeduplication,
} from "./apiUsageTracker";
import { createPoiRequestKey } from "../utils/requestKeys";
export function fetchPoisForRoute(params) {
  recordHighLevelOperation("fetch-route-pois");
  if (isDemoModeEnabled) {
    recordDemoOperation("poi-batch");
    return Promise.resolve(
      Number(params?.numStops) === 0
        ? []
        : DEMO_POIS.map((poi) => ({ ...poi })),
    );
  }
  const providers = activePoiProviders.map((provider) => provider.id);
  const key = createPoiRequestKey({ ...params, enabledProviders: providers });
  return poiRequestCache.load(key, () => fetchPoisNearRoutePoints(params), {
    onCacheHit: () => recordCacheHit("poi-batch", "route-pois"),
    onInFlightDeduplicated: () =>
      recordInFlightDeduplication("poi-batch", "route-pois"),
  });
}
