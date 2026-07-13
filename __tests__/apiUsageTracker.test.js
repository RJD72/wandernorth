import {
  getApiUsageSnapshot,
  recordCacheHit,
  recordDemoOperation,
  recordInFlightDeduplication,
  resetApiUsage,
  subscribeToApiUsage,
  trackExternalRequest,
} from "../app/services/apiUsageTracker";

function findEntry(provider, operation) {
  return getApiUsageSnapshot().find(
    (entry) => entry.provider === provider && entry.operation === operation,
  );
}

describe("apiUsageTracker", () => {
  beforeEach(() => resetApiUsage());

  test("tracks started, successful, and completed requests", async () => {
    const request = trackExternalRequest("google", "routes", async () => ({
      ok: true,
    }));

    expect(findEntry("google", "routes")).toMatchObject({
      started: 1,
      succeeded: 0,
      currentInFlight: 1,
    });

    await request;
    expect(findEntry("google", "routes")).toMatchObject({
      started: 1,
      succeeded: 1,
      failed: 0,
      currentInFlight: 0,
    });
  });

  test("tracks thrown failures and returns in-flight to zero", async () => {
    await expect(
      trackExternalRequest("tomtom", "poi-search", async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");

    expect(findEntry("tomtom", "poi-search")).toMatchObject({
      started: 1,
      succeeded: 0,
      failed: 1,
      currentInFlight: 0,
    });
  });

  test("counts non-OK HTTP responses as failures", async () => {
    await trackExternalRequest("google", "places", async () => ({ ok: false }));
    expect(findEntry("google", "places")).toMatchObject({
      started: 1,
      succeeded: 0,
      failed: 1,
      currentInFlight: 0,
    });
  });

  test("cache hits and in-flight deduplication remain separate", () => {
    recordCacheHit("google", "routes");
    recordInFlightDeduplication("google", "routes");

    expect(findEntry("google", "routes")).toMatchObject({
      started: 0,
      cacheHits: 1,
      inFlightDeduplicated: 1,
    });
  });

  test("reset clears counts", async () => {
    await trackExternalRequest("google", "routes", async () => ({ ok: true }));
    resetApiUsage();
    expect(getApiUsageSnapshot()).toEqual([]);
  });

  test("reset does not recreate an operation already in progress", async () => {
    let resolveRequest;
    const request = trackExternalRequest(
      "google",
      "routes",
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    resetApiUsage();
    resolveRequest({ ok: true });
    await request;

    expect(getApiUsageSnapshot()).toEqual([]);
  });

  test("demo operations do not count as provider requests", () => {
    recordDemoOperation("route");

    expect(findEntry("demo", "route")).toMatchObject({
      succeeded: 1,
      started: 0,
    });
    expect(getApiUsageSnapshot().some((entry) => entry.provider === "google")).toBe(
      false,
    );
    expect(getApiUsageSnapshot().some((entry) => entry.provider === "tomtom")).toBe(
      false,
    );
  });

  test("snapshots contain counters, not request payload details", async () => {
    await trackExternalRequest("google", "routes", async () => ({ ok: true }));
    const serialized = JSON.stringify(getApiUsageSnapshot());

    expect(serialized).not.toMatch(/api.?key|authorization|latitude|longitude|address|payload/i);
  });

  test("subscribers are notified and can unsubscribe", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToApiUsage(listener);

    recordCacheHit("google", "routes");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    recordCacheHit("google", "routes");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
