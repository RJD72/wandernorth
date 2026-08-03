import { isDemoModeEnabled } from "../config/demoMode";
import { DEMO_POIS } from "../fixtures/demoData";
import {
  fetchPoisNearRoutePoints,
  getLastPoiSearchMetadata,
} from "./poiService";
import {
  recordDemoOperation,
  recordHighLevelOperation,
} from "./apiUsageTracker";
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
  const pois = await fetchPoisNearRoutePoints(params);
  lastPoiResultMetadata = getLastPoiSearchMetadata();
  return pois;
}
