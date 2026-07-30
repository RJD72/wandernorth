import { isDemoModeEnabled } from "../config/demoMode";
import { DEMO_POIS } from "../fixtures/demoData";
import {
  fetchPoisNearRoutePoints,
  getLastPoiSearchMetadata,
} from "./poiService";
import { activePoiProviders } from "./poiProviders";
import { poiRequestCache } from "./apiRequestCaches";
import {
  recordCacheHit,
  recordDemoOperation,
  recordHighLevelOperation,
  recordInFlightDeduplication,
} from "./apiUsageTracker";
import { createPoiRequestKey } from "../utils/requestKeys";
let lastPoiResultMetadata = null;

export function getLastPoiResultMetadata() {
  return lastPoiResultMetadata ? { ...lastPoiResultMetadata } : null;
}

export async function fetchPoisForRoute(params) {
  recordHighLevelOperation("fetch-route-pois");
  if (isDemoModeEnabled) {
    recordDemoOperation("poi-batch");
    lastPoiResultMetadata = null;
    return Promise.resolve(
      Number(params?.numStops) === 0
        ? []
        : DEMO_POIS.map((poi) => ({ ...poi })),
    );
  }
  const providers = activePoiProviders.map((provider) => provider.id);
  const key = createPoiRequestKey({ ...params, enabledProviders: providers });
  const result = await poiRequestCache.load(
    key,
    async () => {
      const pois = await fetchPoisNearRoutePoints(params);
      return { pois, metadata: getLastPoiSearchMetadata() };
    },
    {
      onCacheHit: () => recordCacheHit("poi-batch", "route-pois"),
      onInFlightDeduplicated: () =>
        recordInFlightDeduplication("poi-batch", "route-pois"),
    },
  );
  lastPoiResultMetadata = result.metadata;
  return result.pois;
}
