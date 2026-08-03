# API cost and quota plan for the limited Android beta

## Credential and project layout

Prefer separate Google Cloud projects for preview and production. At minimum,
use distinct development, preview, and production keys with separate metrics.
Never share a web/landing-page key with the mobile app.

Enable only:

- Android map key: Maps SDK for Android
- Mobile web-service key: Routes API and Places API (New)

Places API (New) must be enabled. After confirming no legacy endpoint traffic,
the legacy Places API can be disabled. Wander North uses Autocomplete (New),
Place Details (New), Nearby Search (New), and Place Photos (New).

Field masks influence Places billing tiers. Nearby Search requests identity,
display/address, coordinates, type, ratings, review count, and Maps URI. Rich
Place Details is lazy and requests photos/editorial/rating data only when a stop
detail is opened. Only one primary photo URL is generated. Re-check the current
field-to-SKU table before changing a mask:
<https://developers.google.com/maps/documentation/places/web-service/data-fields>

## Implemented request ceilings

Counts below are outbound provider calls on a cold cache. A controlled retry can
add one call only to a single Route, Autocomplete, or Details request after a
transient network/408/425/5xx failure. POI matrix calls never retry
automatically.

| Flow                         |                                               Before |                                                                                  After |
| ---------------------------- | ---------------------------------------------------: | -------------------------------------------------------------------------------------: |
| Navigate displayed route     |                                              1 Route |                                                                        1 preview Route |
| Explore candidate evaluation |                                      up to 25 Routes |      5-call first wave; second wave only if needed; 10 default Routes absolute maximum |
| Explore displayed route      |                                   1 additional Route |                                         0 when the selected candidate preview is valid |
| Final route with waypoints   |                                              1 Route |                              0; locally ordered handoff to Google Maps instead |
| POI search, Google only      |                                up to 15 Nearby calls |                                      10 first-wave calls plus at most 3 fallback calls |
| POI search, Google + TomTom  |                                       up to 30 calls |                                      20 first-wave calls plus at most 6 fallback calls |
| Normal/custom autocomplete   |      one request per 300 ms at 2+ chars plus Details | normal: one Autocomplete; custom: one Autocomplete plus up to 5 route Text Searches per settled 400 ms query, with bounded caches |
| Rich stop details reopen     | one Details request and up to 5 photo URLs each time |                                     one cached Details request and at most 1 photo URL |

One Navigate route build with automatic stops therefore has a cold-cache
maximum of 14 calls with Google only (1 Route + 13 Nearby) or 27 with both POI
providers (1 Route + 26 POI calls). Selected stops are ordered locally and
handed to Google Maps, so there is no subsequent final Route call.

One worst-case Explore build has 10 candidate Route calls plus up to 13 Google
Nearby calls, or 26 combined Google/TomTom POI calls. The accepted candidate is
reused as the displayed route, so it does not add another Route call.

Autocomplete counts depend on how many 400 ms pauses occur while typing. One
completed interaction ends with exactly one Place Details request using the
same session token. Abandoned interactions discard their token.

## Runtime safeguards

- Route cache: 40 entries, 3-minute TTL, in-flight deduplication
- POI provider-request cache: 400 entries, 24-hour TTL, in-flight
  deduplication; keys isolate provider, provider type, normalized point,
  radius, 20-result limit, ranking, region/language, and response schema
- Autocomplete cache: 40 entries, 2-minute TTL, scoped to its session token
- Place Details cache: 40 entries, 30-minute TTL
- Geocoding cache: 75 entries, 20-minute TTL
- Route coordinates in keys: five decimal places; waypoint order, purpose, and
  routing preference are included
- POI sampling: at most five distance-distributed route points
- POI result limit: up to 20 results per Google Nearby Search or TomTom POI
  Search request, with no pagination
- POI first wave: at most two provider query types per provider
- POI fallback: one additional type at at most three points, only when the first
  wave has fewer candidates than requested stops plus a two-item browse buffer
- POI concurrency: four active requests
- POI provider results: process memory only. Complete Google/TomTom records are
  not written to AsyncStorage; force-closing the app clears this cache
- External timeout: 12 seconds
- Retry: at most one with exponential delay and jitter; never on normal 4xx,
  denied keys, quota exhaustion, or the POI matrix

## Google Cloud beta controls

1. Set conservative per-minute/per-day quotas for Routes API and Places API
   (New), based on invited tester count and the ceilings above.
2. Start low and raise only after reviewing legitimate rejection rates.
3. Create API/credential dashboards for requests, errors, and latency.
4. Create quota-usage alerts at low thresholds such as 50%, 75%, and 90%.
5. Create a small Cloud Billing budget with early email alerts. Budgets alert;
   they do not automatically cap spend.
6. Monitor by API and credential daily during the first beta week.
7. Keep the historical key disabled after migration.

Google budget guidance:
<https://docs.cloud.google.com/billing/docs/how-to/budgets>

## Failure and emergency behavior

Timeout/offline/denied/quota/provider failures are normalized. The UI returns
control and displays a safe message. Partial POI provider success remains
usable and is disclosed as limited. If a quota is reached, testers see a
temporary service-limit message rather than an endless spinner.

Emergency sequence:

1. Disable the affected credential in Google Cloud or TomTom.
2. Check usage by API, credential, referrer/application, geography, and time.
3. Create a replacement restricted preview credential.
4. Update the EAS `preview` environment.
5. Build and smoke-test a replacement APK.
6. Send testers the new build URL and retire the previous APK.
