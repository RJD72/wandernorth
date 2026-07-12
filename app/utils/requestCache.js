function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function createRequestCache({ maxEntries, ttlMs }) {
  const completed = new Map();
  const inFlight = new Map();
  function get(key) {
    const item = completed.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= Date.now()) {
      completed.delete(key);
      return undefined;
    }
    completed.delete(key);
    completed.set(key, item);
    return clone(item.value);
  }
  function set(key, value) {
    completed.delete(key);
    completed.set(key, { value: clone(value), expiresAt: Date.now() + ttlMs });
    while (completed.size > maxEntries)
      completed.delete(completed.keys().next().value);
  }
  function load(key, loader, { onCacheHit, onInFlightDeduplicated } = {}) {
    const cached = get(key);
    if (cached !== undefined) {
      onCacheHit?.();
      return Promise.resolve(cached);
    }
    if (inFlight.has(key)) {
      onInFlightDeduplicated?.();
      return inFlight.get(key);
    }
    const pending = Promise.resolve()
      .then(loader)
      .then((value) => {
        set(key, value);
        return clone(value);
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
    return pending;
  }
  return {
    load,
    clear: () => completed.clear(),
    get size() {
      return completed.size;
    },
  };
}
