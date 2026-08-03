import {
  POI_CACHE_MAX_ENTRIES,
  POI_CACHE_SCHEMA_VERSION,
  POI_CACHE_TTL_MS,
} from "../config/poiRequestPolicy";

const completedRequests = new Map();
const inFlightRequests = new Map();

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizedText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizedCoordinate(value) {
  return Number(value).toFixed(5);
}

function increment(diagnostics, provider, field) {
  if (!diagnostics) return;

  diagnostics[field] += 1;
  diagnostics.byProvider[provider] ??= {
    providerRequestCount: 0,
    memoryCacheHits: 0,
    persistentCacheHits: 0,
    inFlightJoins: 0,
    cacheMisses: 0,
    networkCalls: 0,
    successfulNetworkCalls: 0,
    failedNetworkCalls: 0,
    expiredEntries: 0,
  };
  diagnostics.byProvider[provider][field] += 1;
}

export function createPoiCacheDiagnostics() {
  return {
    providerRequestCount: 0,
    memoryCacheHits: 0,
    persistentCacheHits: 0,
    inFlightJoins: 0,
    cacheMisses: 0,
    networkCalls: 0,
    successfulNetworkCalls: 0,
    failedNetworkCalls: 0,
    expiredEntries: 0,
    byProvider: {},
  };
}

export function createPoiProviderRequestCacheKey({
  provider,
  providerType,
  point,
  radiusMeters,
  maxResults,
  rankingPreference,
  region,
  language,
  fieldMaskVersion,
  schemaVersion = POI_CACHE_SCHEMA_VERSION,
}) {
  return JSON.stringify([
    "poi",
    schemaVersion,
    normalizedText(provider),
    normalizedText(providerType),
    normalizedCoordinate(point?.latitude),
    normalizedCoordinate(point?.longitude),
    Number(radiusMeters),
    Number(maxResults),
    normalizedText(rankingPreference),
    normalizedText(region),
    normalizedText(language),
    normalizedText(fieldMaskVersion),
  ]);
}

function getCompletedRequest(key, provider, diagnostics) {
  const entry = completedRequests.get(key);
  if (!entry) return undefined;

  const isMalformed =
    entry.schemaVersion !== POI_CACHE_SCHEMA_VERSION ||
    entry.key !== key ||
    entry.provider !== provider ||
    !Number.isFinite(entry.createdAt) ||
    !Number.isFinite(entry.expiresAt) ||
    !Array.isArray(entry.results);
  if (isMalformed || Date.now() >= entry.expiresAt) {
    completedRequests.delete(key);
    increment(diagnostics, provider, "expiredEntries");
    return undefined;
  }

  completedRequests.delete(key);
  completedRequests.set(key, entry);
  increment(diagnostics, provider, "memoryCacheHits");
  return clone(entry.results);
}

function setCompletedRequest(key, provider, results) {
  const createdAt = Date.now();
  completedRequests.delete(key);
  completedRequests.set(key, {
    schemaVersion: POI_CACHE_SCHEMA_VERSION,
    key,
    provider,
    createdAt,
    expiresAt: createdAt + POI_CACHE_TTL_MS,
    results: clone(results),
  });

  while (completedRequests.size > POI_CACHE_MAX_ENTRIES) {
    completedRequests.delete(completedRequests.keys().next().value);
  }
}

export function loadPoiProviderRequest({
  cacheKey,
  provider,
  loader,
  diagnostics,
}) {
  const normalizedProvider = normalizedText(provider);
  increment(diagnostics, normalizedProvider, "providerRequestCount");

  const cachedResults = getCompletedRequest(
    cacheKey,
    normalizedProvider,
    diagnostics,
  );
  if (cachedResults !== undefined) {
    return Promise.resolve(cachedResults);
  }

  if (inFlightRequests.has(cacheKey)) {
    increment(diagnostics, normalizedProvider, "inFlightJoins");
    return inFlightRequests.get(cacheKey);
  }

  increment(diagnostics, normalizedProvider, "cacheMisses");
  increment(diagnostics, normalizedProvider, "networkCalls");

  const pendingRequest = Promise.resolve()
    .then(loader)
    .then((results) => {
      if (!Array.isArray(results)) {
        throw new Error("POI provider returned a malformed result.");
      }
      setCompletedRequest(cacheKey, normalizedProvider, results);
      increment(diagnostics, normalizedProvider, "successfulNetworkCalls");
      return clone(results);
    })
    .catch((error) => {
      increment(diagnostics, normalizedProvider, "failedNetworkCalls");
      throw error;
    })
    .finally(() => inFlightRequests.delete(cacheKey));

  inFlightRequests.set(cacheKey, pendingRequest);
  return pendingRequest;
}

export function clearPoiProviderRequestCache() {
  completedRequests.clear();
}

export function getPoiProviderRequestCacheSize() {
  return completedRequests.size;
}

export const POI_CACHE_PERSISTENCE_POLICY = Object.freeze({
  google: "memory-only",
  tomtom: "memory-only",
});
