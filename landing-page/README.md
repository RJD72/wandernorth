# Wander North demand-validation landing page

A separate React + Vite website for validating demand before further mobile-product development. It does not add web dependencies to the Expo app.

## Run locally

```powershell
cd landing-page
npm install
npm run dev
```

Create a production build with `npm run build`, preview it with `npm run preview`, and check code quality with `npm run lint`.

## Waitlist connection

Copy `.env.example` to `.env.local` and set `VITE_WAITLIST_ENDPOINT` to an HTTPS endpoint that accepts JSON. Never put a private API key in a `VITE_` variable: Vite exposes these values to the browser.

The service sends this record shape:

```js
{
  firstName, email, region, travelStyle, desiredOutcome,
  valueReason, pricingPreference, wantsEarlyTesting,
  referralSource, submittedAt
}
```

Without an endpoint, development mode logs the structured record and simulates success while clearly saying that nothing was stored. A production build without an endpoint returns a visible form error instead of pretending to persist data.

Connection options:

- Formspree: create a form, use its submission URL, and confirm its JSON-field mapping.
- ConvertKit: use a server-side adapter so private credentials never reach the browser.
- Mailchimp: use a hosted form endpoint or a server-side adapter; do not expose an API key.
- Brevo: send through a small serverless function that keeps the API key private.
- Supabase: use a narrowly scoped insert policy, validation, rate limiting, and CAPTCHA before launch.
- Custom API: accept JSON, validate and normalize fields, apply rate limits, return non-2xx responses on failure, and record consent/privacy metadata.

Test success and failure with the chosen provider before publishing. Add bot protection and a reviewed privacy policy before collecting production data.

## Replace images and videos

All replaceable media is centralized in `src/data/mediaAssets.js`. Add a `src` to render a real image or video automatically; leave it empty to keep the intentional route-and-landscape placeholder.

| Asset key | Purpose | Recommended dimensions | Format | Suggested content |
| --- | --- | --- | --- | --- |
| `heroDemo` | Hero product demo | 1600 × 900 | MP4/WebM or WebP | 20–30 second app journey |
| `couplesDayTrip` | Couples use case | 1200 × 900 | WebP/AVIF | Couple at a scenic stop |
| `familyAdventure` | Family use case | 1200 × 900 | WebP/AVIF | Family at a park or attraction |
| `motorcycleRoute` | Rider use case | 1200 × 900 | WebP/AVIF | Riders on a tree-lined road |
| `campingExcursion` | Camping/RV use case | 1200 × 900 | WebP/AVIF | Campers beside a local lake or trail |
| `smallTownMarket` | Food-tour use case | 1200 × 900 | WebP/AVIF | Ontario market and storefronts |
| `scenicSundayDrive` | Scenic-drive use case | 1200 × 900 | WebP/AVIF | Warm, open Ontario road |
| `founderStory` | Origin story | 1200 × 900 | MP4/WebM or WebP | Candid founder introduction |

The app's existing `assets/` directory is Vite's public asset source, so the current favicon and brand imagery remain shared without duplicating files.

## Analytics and campaign attribution

`trackEvent(eventName, properties)` lives in `src/services/analyticsService.js`. Development events are visible in the console, and no analytics script or cookie is installed. Add a consent experience before enabling non-essential Google Analytics, Plausible, PostHog, or Meta tracking.

The page currently emits events for hero/header/final CTAs, How It Works, form starts/submissions, travel style, pricing, early testing, FAQ opens, and demo media. `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` are captured from the URL and included under `referralSource` in every waitlist record.

## SEO and deployment

Update the placeholder `wandernorth.example` canonical and social URLs in `index.html` before launch. Replace the temporary social image with a purpose-built 1200 × 630 image when one is approved.

The `dist/` output can be deployed to Netlify, Vercel, Cloudflare Pages, GitHub Pages, or another static host. Use `npm run build`, publish `landing-page/dist`, configure SPA fallback to `index.html`, set `VITE_WAITLIST_ENDPOINT` in the host's build environment, and rebuild.

## Manual launch checklist

- Test 320, 375, 430, tablet, 1024, and large desktop widths with no overflow.
- Use the mobile menu with keyboard, Escape, and touch; verify focus remains visible.
- Open every FAQ with keyboard and pointer input.
- Submit valid, invalid, endpoint-success, and endpoint-failure form states.
- Confirm honeypot, rate limiting, CAPTCHA, privacy policy, and consent language.
- Replace canonical URL, contact email, social image, hero demo, use-case media, and founder media.
- Test all links, console output, reduced-motion mode, colour contrast, and a production build.
- Run Lighthouse and optimize real images/video before publishing.
- Confirm no secrets exist in source, client environment variables, or the built files.

## Demand-validation checklist

Measure landing-page visitors, hero CTA click rate, waitlist conversion rate, form completion rate, early-tester opt-in rate, travel-style selections, desired-outcome themes, pricing-preference distribution, and conversion by UTM source. Compare results across traffic sources and audience quality; no single arbitrary conversion threshold proves demand. Pair quantitative results with follow-up interviews and look for repeated problems people already try to solve.
