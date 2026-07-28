const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
const DEVELOPMENT_ANALYTICS_ENABLED =
  import.meta.env.VITE_GA_ENABLE_IN_DEVELOPMENT === "true";
const GOOGLE_TAG_ID = "wander-north-google-tag";
const ALLOWED_PROPERTY_NAMES = new Set([
  "campaign_source",
  "cta_location",
  "form_location",
  "pricing_option",
  "question_id",
  "reason_category",
  "result_type",
  "travel_style",
  "video_version",
]);
const CAMPAIGN_PARAMETER_NAMES = [
  ["utm_source", "campaign_source"],
  ["utm_medium", "campaign_medium"],
  ["utm_campaign", "campaign_name"],
  ["utm_content", "campaign_content"],
];

function analyticsEnabled() {
  return Boolean(MEASUREMENT_ID) &&
    (import.meta.env.PROD || DEVELOPMENT_ANALYTICS_ENABLED);
}

function sanitizeValue(value) {
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value !== "string") return undefined;

  const sanitized = value.trim().slice(0, 100);
  if (!sanitized || /@|%40/i.test(sanitized)) return undefined;
  return sanitized;
}

function getCampaignProperties() {
  const params = new URLSearchParams(window.location.search);

  return CAMPAIGN_PARAMETER_NAMES.reduce((campaign, [queryName, gaName]) => {
    const value = sanitizeValue(params.get(queryName));
    if (value) campaign[gaName] = value;
    return campaign;
  }, {});
}

function getSafeProperties(properties) {
  const safeProperties = Object.entries(properties).reduce(
    (safe, [name, value]) => {
      if (!ALLOWED_PROPERTY_NAMES.has(name)) return safe;
      const sanitized = sanitizeValue(value);
      if (sanitized !== undefined) safe[name] = sanitized;
      return safe;
    },
    {},
  );

  const campaignSource = getCampaignProperties().campaign_source;
  if (campaignSource) safeProperties.campaign_source = campaignSource;
  return safeProperties;
}

function getSafePageLocation() {
  return `${window.location.origin}${window.location.pathname}`;
}

export function initializeAnalytics() {
  if (!analyticsEnabled() || window.wanderNorthAnalyticsInitialized) return;
  window.wanderNorthAnalyticsInitialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };

  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    allow_ad_personalization_signals: false,
    allow_google_signals: false,
    send_page_view: false,
    ...(import.meta.env.DEV && DEVELOPMENT_ANALYTICS_ENABLED
      ? { debug_mode: true }
      : {}),
  });
  window.gtag("event", "page_view", {
    page_location: getSafePageLocation(),
    page_title: document.title,
    ...getCampaignProperties(),
  });

  const existingGoogleTag =
    document.getElementById(GOOGLE_TAG_ID) ||
    document.querySelector('script[src*="googletagmanager.com/gtag/js"]');

  if (!existingGoogleTag) {
    const googleTag = document.createElement("script");
    googleTag.id = GOOGLE_TAG_ID;
    googleTag.async = true;
    googleTag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      MEASUREMENT_ID,
    )}`;
    document.head.appendChild(googleTag);
  }
}

export function trackEvent(eventName, properties = {}) {
  const event = {
    eventName,
    properties: getSafeProperties(properties),
    occurredAt: new Date().toISOString(),
  };

  if (import.meta.env.DEV) console.info("[Wander North analytics]", event);
  if (analyticsEnabled() && window.gtag) {
    window.gtag("event", eventName, event.properties);
  }

  window.dispatchEvent(
    new CustomEvent("wander-north:analytics", { detail: event }),
  );
}
