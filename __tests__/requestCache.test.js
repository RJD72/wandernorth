import { createRequestCache } from "../app/utils/requestCache";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("createRequestCache", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("a cache miss invokes the loader", async () => {
    const cache = createRequestCache({ maxEntries: 2, ttlMs: 1000 });
    const loader = jest.fn().mockResolvedValue({ value: 1 });

    await expect(cache.load("a", loader)).resolves.toEqual({ value: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test("a request within the TTL returns the completed value", async () => {
    const cache = createRequestCache({ maxEntries: 2, ttlMs: 1000 });
    const loader = jest.fn().mockResolvedValue({ value: 1 });
    const onCacheHit = jest.fn();

    await cache.load("a", loader);
    await expect(cache.load("a", loader, { onCacheHit })).resolves.toEqual({
      value: 1,
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(onCacheHit).toHaveBeenCalledTimes(1);
  });

  test("simultaneous identical requests share one in-flight Promise", async () => {
    const cache = createRequestCache({ maxEntries: 2, ttlMs: 1000 });
    const pending = deferred();
    const loader = jest.fn(() => pending.promise);
    const onInFlightDeduplicated = jest.fn();

    const first = cache.load("a", loader);
    const second = cache.load("a", loader, { onInFlightDeduplicated });

    expect(second).toBe(first);
    expect(onInFlightDeduplicated).toHaveBeenCalledTimes(1);
    pending.resolve({ value: 1 });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { value: 1 },
      { value: 1 },
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test("a rejected request is not cached and can be retried", async () => {
    const cache = createRequestCache({ maxEntries: 2, ttlMs: 1000 });
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValueOnce("recovered");

    await expect(cache.load("a", loader)).rejects.toThrow("first failure");
    await expect(cache.load("a", loader)).resolves.toBe("recovered");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  test("an expired entry invokes the loader again", async () => {
    const cache = createRequestCache({ maxEntries: 2, ttlMs: 1000 });
    const loader = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    await expect(cache.load("a", loader)).resolves.toBe(1);
    jest.setSystemTime(new Date("2026-01-01T00:00:01.001Z"));
    await expect(cache.load("a", loader)).resolves.toBe(2);
  });

  test("the maximum entry limit uses recent access when evicting", async () => {
    const cache = createRequestCache({ maxEntries: 2, ttlMs: 1000 });

    await cache.load("a", () => Promise.resolve("a"));
    await cache.load("b", () => Promise.resolve("b"));
    await cache.load("a", () => Promise.resolve("unused"));
    await cache.load("c", () => Promise.resolve("c"));

    const bReload = jest.fn().mockResolvedValue("new-b");
    await expect(cache.load("b", bReload)).resolves.toBe("new-b");
    expect(cache.size).toBe(2);
  });

  test("clear removes completed entries", async () => {
    const cache = createRequestCache({ maxEntries: 2, ttlMs: 1000 });
    const loader = jest.fn().mockResolvedValue("value");

    await cache.load("a", loader);
    cache.clear();
    await cache.load("a", loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  test("clear does not damage an active request", async () => {
    const cache = createRequestCache({ maxEntries: 2, ttlMs: 1000 });
    const pending = deferred();
    const loader = jest.fn(() => pending.promise);
    const first = cache.load("a", loader);

    cache.clear();
    pending.resolve({ value: 1 });
    await first;
    await expect(cache.load("a", loader)).resolves.toEqual({ value: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  test("returned values cannot mutate future cached reads", async () => {
    const cache = createRequestCache({ maxEntries: 2, ttlMs: 1000 });
    const original = { nested: { count: 1 } };
    const first = await cache.load("a", () => Promise.resolve(original));

    first.nested.count = 99;
    original.nested.count = 50;

    await expect(cache.load("a", () => Promise.resolve(null))).resolves.toEqual({
      nested: { count: 1 },
    });
  });

  test("different keys remain isolated", async () => {
    const cache = createRequestCache({ maxEntries: 3, ttlMs: 1000 });

    await cache.load("a", () => Promise.resolve("A"));
    await cache.load("b", () => Promise.resolve("B"));

    await expect(cache.load("a", () => Promise.resolve("wrong"))).resolves.toBe(
      "A",
    );
    await expect(cache.load("b", () => Promise.resolve("wrong"))).resolves.toBe(
      "B",
    );
  });

  test("demo and real namespaces remain isolated", async () => {
    const cache = createRequestCache({ maxEntries: 3, ttlMs: 1000 });

    await cache.load("demo:route", () => Promise.resolve("demo"));
    await cache.load("real:route", () => Promise.resolve("real"));

    await expect(
      cache.load("demo:route", () => Promise.resolve("wrong")),
    ).resolves.toBe("demo");
    await expect(
      cache.load("real:route", () => Promise.resolve("wrong")),
    ).resolves.toBe("real");
  });
});
