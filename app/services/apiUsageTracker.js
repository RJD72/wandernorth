const usage = new Map();
const listeners = new Set();
let generation = 0;

function id(provider, operation) {
  return `${provider}:${operation}`;
}
function entry(provider, operation) {
  const key = id(provider, operation);
  if (!usage.has(key))
    usage.set(key, {
      provider,
      operation,
      operations: 0,
      started: 0,
      succeeded: 0,
      failed: 0,
      cacheHits: 0,
      inFlightDeduplicated: 0,
      currentInFlight: 0,
      lastRequestTime: null,
    });
  return usage.get(key);
}
function emit() {
  listeners.forEach((listener) => listener());
}
function update(provider, operation, changes) {
  Object.assign(
    entry(provider, operation),
    changes(entry(provider, operation)),
  );
  emit();
}

export function recordCacheHit(provider, operation) {
  update(provider, operation, (value) => ({ cacheHits: value.cacheHits + 1 }));
}
export function recordInFlightDeduplication(provider, operation) {
  update(provider, operation, (value) => ({
    inFlightDeduplicated: value.inFlightDeduplicated + 1,
  }));
}
export function recordHighLevelOperation(operation) {
  update("app", operation, (value) => ({
    operations: value.operations + 1,
    lastRequestTime: new Date().toISOString(),
  }));
}
export function recordDemoOperation(operation) {
  update("demo", operation, (value) => ({
    succeeded: value.succeeded + 1,
    lastRequestTime: new Date().toISOString(),
  }));
}
export async function trackExternalRequest(provider, operation, loader) {
  const requestGeneration = generation;
  update(provider, operation, (value) => ({
    started: value.started + 1,
    currentInFlight: value.currentInFlight + 1,
    lastRequestTime: new Date().toISOString(),
  }));
  try {
    const result = await loader();
    const failedHttpResponse =
      result && typeof result.ok === "boolean" && !result.ok;
    if (requestGeneration === generation)
      update(provider, operation, (value) => ({
        succeeded: value.succeeded + (failedHttpResponse ? 0 : 1),
        failed: value.failed + (failedHttpResponse ? 1 : 0),
        currentInFlight: Math.max(0, value.currentInFlight - 1),
      }));
    return result;
  } catch (error) {
    if (requestGeneration === generation)
      update(provider, operation, (value) => ({
        failed: value.failed + 1,
        currentInFlight: Math.max(0, value.currentInFlight - 1),
      }));
    throw error;
  }
}
export function getApiUsageSnapshot() {
  return [...usage.values()]
    .map((value) => ({ ...value }))
    .sort((a, b) =>
      `${a.provider}:${a.operation}`.localeCompare(
        `${b.provider}:${b.operation}`,
      ),
    );
}
export function resetApiUsage() {
  generation += 1;
  usage.clear();
  emit();
}
export function subscribeToApiUsage(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
