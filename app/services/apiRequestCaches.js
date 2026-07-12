import { createRequestCache } from "../utils/requestCache";
export const routeRequestCache = createRequestCache({
  maxEntries: 40,
  ttlMs: 3 * 60 * 1000,
});
export const poiRequestCache = createRequestCache({
  maxEntries: 40,
  ttlMs: 10 * 60 * 1000,
});
export const geocodeRequestCache = createRequestCache({
  maxEntries: 75,
  ttlMs: 20 * 60 * 1000,
});
export function clearApiRequestCaches() {
  routeRequestCache.clear();
  poiRequestCache.clear();
  geocodeRequestCache.clear();
}
