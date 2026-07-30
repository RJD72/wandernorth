# Google Places deprecation investigation

Date: 2026-07-30

## Conclusion

The current Wander North Android runtime does **not** contain the Places SDK
for Android. There is no installed
`com.google.android.libraries.places:places` version to upgrade, and Wander
North has no Java or Kotlin calls to deprecated Places SDK methods.

Google can nevertheless associate the deprecated traffic with Android
application ID `com.rob.wandernorth`: the JavaScript legacy Places web-service
requests sent `X-Android-Package: com.rob.wandernorth` and the Android signing
certificate header. The legacy Autocomplete and Place Details endpoints were
therefore Android-attributed requests.

The migration in this checkout replaces those two HTTP endpoints with
Autocomplete (New) and Place Details (New). It does not add a native
autocomplete widget because the existing React Native dropdown is a better fit
for the current Navigate, Explore, and custom-stop experience.

## Dependency and source evidence

- `package.json` and `package-lock.json` contain no native Places,
  Google Places autocomplete, or previous React Native Places package.
- The only relevant direct packages are `react-native-maps@1.20.1` and
  `expo-location@19.0.8`.
- Expo prebuild autolinks `expo-location`; `react-native-maps` is configured by
  Expo's built-in project configuration. No project config plugin adds Places.
- The repository normally has no checked-in `android/` directory. A generated
  Expo Android project contains no Places declaration or deprecated Places
  source reference.
- Gradle `releaseRuntimeClasspath` dependency insight reported:
  `No dependencies matching given input were found` for
  `com.google.android.libraries.places`.
- The resolved related Android artifacts are:
  - `com.google.android.gms:play-services-maps:18.2.0`, introduced by
    `react-native-maps`
  - `com.google.android.gms:play-services-location:21.0.1`, introduced by both
    `react-native-maps` and `expo-location`
  - `com.google.maps.android:android-maps-utils:3.8.2`, introduced by
    `react-native-maps`
- Direct project and installed-module searches found no references to
  `Places.initialize`, `findCurrentPlace`, `PlaceLikelihood`, `fetchPhoto`,
  `AutocompleteActivity`, `AutocompleteSupportFragment`,
  `PlaceAutocomplete`, `PlaceAutocompleteActivity`, `searchNearby`, or
  `fetchResolvedPhotoUri` in native source. The JavaScript POI provider's
  `places:searchNearby` string is the Places API (New) HTTP endpoint, not a
  native SDK method.
- Git history shows the legacy Autocomplete endpoint existed from the first app
  commit. Commit `0e34ede` later added the Android package and certificate
  headers to those legacy requests. No repository revision contains a previous
  native autocomplete npm dependency.

The dependency report used `-PnewArchEnabled=false` because the only locally
installed Android NDK (`27.1.12297006`) is incomplete and has no
`source.properties`. Disabling the React Native new architecture bypassed that
local SDK defect for dependency resolution; it does not change the Java
runtime dependency result.

## HTTP migration

`app/services/googlePlacesAutocomplete.js` now owns the two calls:

- `POST https://places.googleapis.com/v1/places:autocomplete`
- `GET https://places.googleapis.com/v1/places/{placeId}`

Autocomplete preserves:

- Canadian restriction through `includedRegionCodes: ["ca"]`
- Canadian response/ranking preference through `regionCode: "CA"`
- the existing location-bias circle
- strict-bound behavior through `locationRestriction` when requested
- the existing prediction shape used by the dropdown
- Android package/certificate restriction headers
- request tracking, HTTP failure handling, and stale-request protection

The old custom-stop behavior performed up to five Text Search (New) requests
for every debounced keystroke. That matrix has been removed. Custom-stop
autocomplete remains route-aware through the existing 50 km bias around the
route midpoint.

Place Details (New) requests only `id`, `displayName`, `formattedAddress`, and
`location`, then returns the existing app contract: place name, formatted
address, Place ID, latitude, and longitude.

## Session-token lifecycle

Each `AutocompleteInput` instance:

1. creates a token when a real autocomplete interaction starts;
2. reuses that token for every debounced prediction request in the interaction;
3. passes the same token to Place Details (New) after a prediction is selected;
4. discards it after selection, blur/abandonment, clearing the input, or
   unmounting; and
5. creates a different token for the next interaction.

In-flight prediction and detail requests are aborted when superseded. Request
IDs still prevent a stale response from updating the input or coordinates.
Demo mode remains local-only and creates no Google session or network request.

## Google Cloud configuration

Live verification on 2026-07-30 returned HTTP 200 from both Autocomplete (New)
and the matching Place Details (New) request, with five Canadian suggestions
and valid coordinates. This confirms that Places API (New) is enabled and the
currently configured key accepts the Android-attributed New API requests.

Required project services for the current code are:

- Places API (New): Autocomplete, Place Details, Nearby Search, Text Search
  where still used outside autocomplete, and Place Photos
- Routes API: route construction
- Maps SDK for Android: `react-native-maps`

The Android key must have:

- an Android application restriction for package `com.rob.wandernorth`;
- every production signing-certificate SHA-1 fingerprint that can sign an
  installed build (Play App Signing and any direct-distribution key);
- API restrictions allowing only Places API (New), Routes API, and Maps SDK for
  Android, unless usage metrics prove another API is required; and
- matching `EXPO_PUBLIC_ANDROID_PACKAGE_NAME` and
  `EXPO_PUBLIC_ANDROID_CERT_SHA1` values so direct Places/Routes web-service
  calls send the restriction headers.

The key is embedded in the client bundle even though it comes from an
`EXPO_PUBLIC_` variable. It must be treated as public and protected by
application/API restrictions, quotas, budgets, and usage alerts. Google
recommends a secure proxy for mobile web-service calls when feasible; if calls
remain direct, verify that requests with an incorrect package or certificate
are rejected.

Do **not** immediately disable the legacy Places API only because this source
has migrated. Previously released Android binaries will continue calling the
legacy endpoints until users update. The legacy Places API can be disabled
only after the migrated build is released and Google Cloud metrics show no
legacy Places traffic for an agreed retirement window. The migrated source
itself no longer requires the legacy Places API.

Official references:

- [Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Session tokens](https://developers.google.com/maps/documentation/places/web-service/place-session-tokens)
- [Places SDK for Android v5 deprecations](https://developers.google.com/maps/documentation/places/android-sdk/release-notes)
- [Google Maps Platform key security](https://developers.google.com/maps/api-security-best-practices)

## Verification and remaining release work

Completed:

- focused Autocomplete (New)/Place Details (New) unit tests;
- a rendered `AutocompleteInput` interaction test proving token reuse through
  selection and a fresh token for the next interaction;
- existing demo place-search tests;
- live paired New API request using one session token;
- generated Android Gradle dependency inspection;
- direct project and installed-module native deprecation scans; and
- a production-mode Expo Android/Hermes export.

Release blockers unrelated to Places:

- A clean Expo prebuild currently fails because `app.config.js` references
  deleted files: `assets/splash-icon.png` and three
  `assets/android-icon-*.png` layers.
- The local Android NDK `27.1.12297006` is incomplete. New-architecture native
  builds fail until that NDK is repaired/reinstalled.
- A release AAB attempt with `newArchEnabled=false` reached the production
  JavaScript bundle step, then correctly failed because
  `react-native-worklets` requires the new architecture. A release AAB with
  the required new architecture cannot configure against the incomplete NDK.

Repository test status: 22 of 23 suites pass (216 of 217 tests). The one
failure reproduces by itself in unchanged `poiService` orchestration:
`poiService.test.js` expects four provider calls while the current
implementation makes six. This is unrelated to Places and was not changed as
part of this migration.

Before declaring Google's warning cleared:

1. fix or restore the configured Android/splash assets;
2. repair the Android NDK and create the production AAB from a clean prebuild;
3. manually exercise Navigate start/destination, Explore start, and custom-stop
   dropdowns on the signed Android build;
4. verify selection coordinates feed route building;
5. release the migrated build;
6. re-run dependency/source scans on the exact release artifact; and
7. monitor Google Cloud legacy Places traffic before disabling the legacy API.

The source and dependency evidence supports removal of the deprecated calls
from this checkout. It does not yet prove that previously distributed binaries
have stopped generating the warning.
