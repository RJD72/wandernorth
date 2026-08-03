import { createRequestCache } from "../utils/requestCache";
import { API_LIMITS } from "../config/apiLimits";
export const routeRequestCache = createRequestCache({
  maxEntries: API_LIMITS.routeCacheMaxEntries,
  ttlMs: API_LIMITS.routeCacheTtlMs,
});
export const poiRequestCache = createRequestCache({
  maxEntries: API_LIMITS.poiCacheMaxEntries,
  ttlMs: API_LIMITS.poiCacheTtlMs,
});
export const geocodeRequestCache = createRequestCache({
  maxEntries: 75,
  ttlMs: 20 * 60 * 1000,
});
export const placeDetailsRequestCache = createRequestCache({
  maxEntries: API_LIMITS.placeDetailsCacheMaxEntries,
  ttlMs: API_LIMITS.placeDetailsCacheTtlMs,
});
export const autocompleteRequestCache = createRequestCache({
  maxEntries: API_LIMITS.autocompleteCacheMaxEntries,
  ttlMs: API_LIMITS.autocompleteCacheTtlMs,
});
export const customRouteTextSearchRequestCache = createRequestCache({
  maxEntries: API_LIMITS.customRouteTextSearchCacheMaxEntries,
  ttlMs: API_LIMITS.customRouteTextSearchCacheTtlMs,
});
export function clearApiRequestCaches() {
  routeRequestCache.clear();
  poiRequestCache.clear();
  geocodeRequestCache.clear();
  placeDetailsRequestCache.clear();
  autocompleteRequestCache.clear();
  customRouteTextSearchRequestCache.clear();
}
