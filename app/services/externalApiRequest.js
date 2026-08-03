import { API_LIMITS } from "../config/apiLimits";
import { trackExternalRequest } from "./apiUsageTracker";

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 500, 502, 503, 504]);

export class ExternalApiError extends Error {
  constructor(category, message, { status = null, cause = null } = {}) {
    super(message);
    this.name = "ExternalApiError";
    this.category = category;
    this.status = status;
    this.cause = cause;
  }
}

export function classifyHttpStatus(status) {
  if (status === 401 || status === 403) return "denied";
  if (status === 429) return "quota";
  if (status === 408) return "timeout";
  if (status >= 500) return "provider";
  return "invalid-request";
}

export function getExternalApiUserMessage(error) {
  switch (error?.category) {
    case "offline":
      return "You appear to be offline. Check your connection and try again.";
    case "timeout":
      return "The request took too long. Please try again.";
    case "quota":
      return "This beta has reached its temporary service limit. Please try again later.";
    case "denied":
      return "This service is not available in the current build.";
    case "provider":
      return "The map service is temporarily unavailable. Please try again.";
    default:
      return "The request could not be completed. Please try again.";
  }
}

function createAbortError() {
  const error = new Error("Request cancelled.");
  error.name = "AbortError";
  return error;
}

function waitWithJitter(attempt) {
  const jitter = Math.floor(Math.random() * API_LIMITS.retryBaseDelayMs);
  const delay =
    API_LIMITS.retryBaseDelayMs * 2 ** Math.max(0, attempt - 1) + jitter;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function fetchOnce(url, options, { timeoutMs, callerSignal }) {
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (callerSignal?.aborted) throw createAbortError();
    if (timedOut) {
      throw new ExternalApiError("timeout", "External request timed out.", {
        cause: error,
      });
    }
    if (error?.name === "AbortError") throw error;
    throw new ExternalApiError("offline", "External request failed.", {
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}

export async function requestExternalApi({
  provider,
  operation,
  url,
  options = {},
  signal,
  timeoutMs = API_LIMITS.requestTimeoutMs,
  retryTransient = true,
  onNonOkResponse,
}) {
  const maximumAttempts = retryTransient ? 2 : 1;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      const response = await trackExternalRequest(provider, operation, () =>
        fetchOnce(url, options, { timeoutMs, callerSignal: signal }),
      );

      if (response.ok) return response;

      await onNonOkResponse?.(response, { attempt });

      if (
        attempt < maximumAttempts &&
        TRANSIENT_HTTP_STATUSES.has(response.status)
      ) {
        await waitWithJitter(attempt);
        continue;
      }

      throw new ExternalApiError(
        classifyHttpStatus(response.status),
        `${provider} request failed.`,
        { status: response.status },
      );
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      const retryableNetworkError =
        error instanceof ExternalApiError &&
        (error.category === "offline" || error.category === "timeout");

      if (attempt < maximumAttempts && retryableNetworkError) {
        await waitWithJitter(attempt);
        continue;
      }

      throw error;
    }
  }

  throw new ExternalApiError("unknown", "External request failed.");
}
