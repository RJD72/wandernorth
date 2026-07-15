const ENDPOINT = import.meta.env.VITE_WAITLIST_ENDPOINT?.trim();

export async function submitWaitlist(payload) {
  if (!ENDPOINT) {
    if (!import.meta.env.DEV) {
      throw new Error("Early-access signup is not connected yet. Please try again after the form endpoint is configured.");
    }

    console.info("[Wander North waitlist — development only, not persisted]", payload);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    return { persisted: false, developmentFallback: true };
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error("We could not add you right now. Please check your details and try again.");
  return { persisted: true, developmentFallback: false };
}

export function getReferralSource() {
  const params = new URLSearchParams(window.location.search);
  return ["utm_source", "utm_medium", "utm_campaign", "utm_content"].reduce((result, key) => {
    const value = params.get(key);
    if (value) result[key] = value;
    return result;
  }, {});
}
