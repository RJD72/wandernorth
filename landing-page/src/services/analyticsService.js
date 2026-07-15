export function trackEvent(eventName, properties = {}) {
  const event = { eventName, properties, occurredAt: new Date().toISOString() };

  if (import.meta.env.DEV) console.info("[Wander North analytics]", event);

  // Future provider adapters (GA, Plausible, PostHog, Meta) belong here,
  // after consent and privacy requirements are in place.
  window.dispatchEvent(new CustomEvent("wander-north:analytics", { detail: event }));
}
