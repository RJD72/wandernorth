# Wander North Android beta security

## Current security boundary

The Android package is permanently `com.rob.wandernorth`. The preview APK is
signed by the Android keystore selected by EAS for the `preview` profile.

Routes API, Places API (New), Place Photos, and TomTom requests still originate
from JavaScript in the mobile client. Every `EXPO_PUBLIC_*` value is embedded in
the compiled application and must be treated as public/extractable. EAS
`sensitive` visibility reduces accidental display in logs; it does not make a
client credential secret.

The app sends Android package and signing-certificate headers on Google REST
requests. This is the strongest practical client-only beta configuration, but a
small authenticated proxy remains recommended before broad public distribution.
The proxy should construct allow-listed requests, keep server credentials
private, rate-limit users, and return only required response fields.

## Known credential incident

A Google key was present in historical `.env` commits dated 2026-05-11. The
value is intentionally not reproduced here. Removing `.env` from the current
tree did not revoke the key or remove it from Git history.

Before distributing:

1. Inspect that key's API and credential metrics in Google Cloud.
2. Create separate replacement development, preview, and production keys.
3. Configure and test the preview keys described below.
4. Put only the new preview values in the EAS `preview` environment.
5. Build and smoke-test the replacement APK.
6. Disable/delete the historical key. If traffic indicates abuse, disable it
   immediately rather than waiting for a replacement build.
7. Consider history rewriting only as repository hygiene; it does not replace
   revocation and may require every collaborator to re-clone.

## Required Google credentials

Create separate credentials per environment. Do not reuse the landing-page
credential.

| Credential          | Embedded variable                         | Application restriction                                               | API restrictions                     |
| ------------------- | ----------------------------------------- | --------------------------------------------------------------------- | ------------------------------------ |
| Android map         | `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` | Android app: `com.rob.wandernorth` plus the environment signing SHA-1 | Maps SDK for Android only            |
| Mobile web services | `EXPO_PUBLIC_GOOGLE_WEB_SERVICES_API_KEY` | Android app where the tested endpoint supports it                     | Routes API and Places API (New) only |

Set these additional public values in each EAS environment:

- `EXPO_PUBLIC_ANDROID_PACKAGE_NAME=com.rob.wandernorth`
- `EXPO_PUBLIC_ANDROID_CERT_SHA1` using the hexadecimal SHA-1 format expected by
  the request header
- `EXPO_PUBLIC_APP_ENV=preview` for the beta

Google documents direct mobile web-service calls as a constrained fallback:
send `X-Android-Package` and `X-Android-Cert`, apply matching application
restrictions, and verify rejection with incorrect identifiers. If either Routes
API or Places API (New) does not enforce those restrictions in a real test, do
not assume the key is protected; move that service behind a proxy.

Verification:

1. Build the preview APK with its final credential.
2. Confirm Maps, Autocomplete, Place Details, Nearby Search, and Routes work.
3. Send a controlled request using the preview key but a deliberately incorrect
   package header; expect rejection.
4. Repeat with an incorrect certificate header; expect rejection.
5. Review Google Cloud credential metrics to confirm only the intended APIs use
   each key.

Google security guidance:
<https://developers.google.com/maps/api-security-best-practices>

## EAS preview signing SHA-1

Run `eas credentials -p android`, choose the `preview` profile, and inspect the
associated Android keystore/certificate. If a local fingerprint is required,
use the EAS credential download flow and `keytool` without printing passwords
or committing the downloaded files. Delete local exports after securely backing
them up. Register the preview certificate SHA-1 on both preview Google
credentials before the build is given to testers.

Expo credential guidance:
<https://docs.expo.dev/app-signing/app-credentials/>

## TomTom

`EXPO_PUBLIC_TOMTOM_API_KEY` is also embedded. Use a dedicated preview key,
enable only Search API access, apply TomTom's available application/domain and
quota controls, and monitor it separately. Keep
`EXPO_PUBLIC_ENABLE_TOMTOM_POIS=false` until the preview key and limits are
ready.

## Logging and local data

- Routine logs and diagnostic cards are development-only.
- Log values are recursively redacted for credential-like and exact-coordinate
  keys.
- Raw Google/TomTom responses are no longer retained on normalized POIs or
  route results.
- Current location is requested only in the foreground and only when the user
  chooses it. Manual entry remains available after denial.
- Saved trips stay in AsyncStorage on the device. They are not synced and
  AsyncStorage is not encrypted. Uninstalling the app or clearing app data may
  remove them.
- No third-party analytics or crash reporter was added.
