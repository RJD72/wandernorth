import {
  ExternalApiError,
  classifyHttpStatus,
  requestExternalApi,
} from "../app/services/externalApiRequest";

describe("external API request infrastructure", () => {
  test.each([
    [403, "denied"],
    [429, "quota"],
    [408, "timeout"],
    [503, "provider"],
    [400, "invalid-request"],
  ])("classifies HTTP %s as %s", (status, category) => {
    expect(classifyHttpStatus(status)).toBe(category);
  });

  test("does not retry denied or quota responses", async () => {
    fetch.mockResolvedValue({ ok: false, status: 429 });
    await expect(
      requestExternalApi({
        provider: "test",
        operation: "quota",
        url: "https://example.test",
      }),
    ).rejects.toEqual(
      expect.objectContaining({ category: "quota", status: 429 }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("retries one transient single request", async () => {
    fetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    await expect(
      requestExternalApi({
        provider: "test",
        operation: "transient",
        url: "https://example.test",
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: true }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("can disable retries for batch requests", async () => {
    fetch.mockResolvedValue({ ok: false, status: 503 });
    await expect(
      requestExternalApi({
        provider: "test",
        operation: "batch",
        url: "https://example.test",
        retryTransient: false,
      }),
    ).rejects.toBeInstanceOf(ExternalApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("exposes a non-success response to a safe diagnostic callback", async () => {
    const onNonOkResponse = jest.fn();
    const response = { ok: false, status: 400 };
    fetch.mockResolvedValue(response);

    await expect(
      requestExternalApi({
        provider: "test",
        operation: "diagnostic",
        url: "https://example.test",
        onNonOkResponse,
      }),
    ).rejects.toBeInstanceOf(ExternalApiError);

    expect(onNonOkResponse).toHaveBeenCalledWith(response, { attempt: 1 });
  });
});
