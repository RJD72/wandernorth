# Limited Android beta runbook

## Pre-build checklist

The beta is not ready to distribute until every item is complete:

- Rotate the Google key found in Git history.
- Create dedicated preview Android-map, Google web-service, and optional TomTom
  keys with the restrictions in `SECURITY-BETA.md`.
- Confirm Places API (New), Routes API, and Maps SDK for Android are enabled.
- Configure Google quotas, credential monitoring, and billing alerts.
- Choose the owning EAS account and link the repository to an EAS project.
- Confirm the `preview` Android signing credential and register its SHA-1.
- Set the EAS `preview` environment variables listed below.
- Run the automated checks and complete device smoke tests.

## EAS preview environment

This repository is not currently linked to an EAS project. After confirming
the intended owner (the local CLI currently offers `silktoxic`), perform this
one-time state-changing step:

```powershell
npx.cmd eas-cli@latest init
```

Then verify that the resolved preview configuration is valid before building:

```powershell
npx.cmd eas-cli@latest config --platform android --profile preview
```

Do not initialize the project under an account until its ownership is
confirmed.

Create project-scoped EAS variables using the dashboard or `eas env:create`.
Because these values are compiled into the client, they are public even if EAS
labels them sensitive.

Required:

- `EXPO_PUBLIC_APP_ENV=preview`
- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_SERVICES_API_KEY`
- `EXPO_PUBLIC_ANDROID_PACKAGE_NAME=com.rob.wandernorth`
- `EXPO_PUBLIC_ANDROID_CERT_SHA1`
- `EXPO_PUBLIC_USE_DEMO_DATA=false`
- `EXPO_PUBLIC_ALLOW_BETA_DEMO_DATA=false`
- `EXPO_PUBLIC_ENABLE_TOMTOM_POIS=false` or `true` only after configuring its
  preview key
- `EXPO_PUBLIC_TOMTOM_API_KEY` when TomTom is enabled
- optional `EXPO_PUBLIC_BETA_FEEDBACK_URL`

Verify names without revealing values:

```powershell
npx.cmd eas-cli@latest env:list --environment preview
```

Expo environment guidance:
<https://docs.expo.dev/eas/environment-variables/>

## Build

The `preview` profile uses EAS environment `preview`, internal distribution, and
Android `buildType: apk`. It does not enable a development client. EAS Update is
not configured in this repository, so no update channel is declared.

Run:

```powershell
npx.cmd eas-cli@latest build --platform android --profile preview
```

Do not submit to a store. A successful command produces an EAS build page and a
directly installable APK URL. Internal-distribution details:
<https://docs.expo.dev/build/internal-distribution/>

## Tester installation

1. Open the EAS build link on the invited Android device.
2. Download the APK.
3. If Android prompts, allow installs from the browser/file manager used for
   this one installation.
4. Confirm the package displays as **Wander North**.
5. Open Navigate and note the version/build shown in the Beta build card.
6. Revoke the temporary “install unknown apps” permission afterward if desired.

Future builds must use the same package ID and signing key to install as an
update. If signing changes, Android will require uninstalling the old beta,
which also removes locally saved trips.

## Device smoke-test matrix

Test on at least two physical Android devices and one constrained network:

- Navigate start and destination autocomplete, selection, coordinates, route
  display, automatic stops, route-ordered Google Maps handoff, and no second
  Routes API request
- Explore starting-point autocomplete/current location, all directions, early
  candidate success, no-candidate state, and route display without a duplicate
  displayed-route request
- Custom-stop route-wide search, keyboard/dropdown scrolling, selection,
  route-order display/handoff, and stale-response cancellation
- zero automatic stops produces no POI calls
- saved route, reopen from stored polyline without a route request, edit, update,
  delete, uninstall/data-loss expectation
- location denial followed by successful manual entry
- airplane mode, timeout, invalid test key, quota test limit, no route, no POIs,
  one POI provider failing, and final-route failure after preview success
- repeated rapid taps do not start duplicate route builds
- preview contains no Premium testing control, API usage card, demo fixture
  button, raw request log, or developer menu

## Rollback

Keep the last known-good EAS build URL and its environment/key inventory.

1. Disable the affected new credential or feature flag if abuse is suspected.
2. Restore the previous EAS preview variable values without exposing them.
3. Revert the specific application commit; do not change package ID or signing
   credential.
4. Build a new preview APK with an incremented `android.versionCode`.
5. Smoke-test it and send the replacement build URL to testers.

An already-installed APK cannot be remotely removed. If a credential embedded
in it is compromised, disable that credential server-side.
