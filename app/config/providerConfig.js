export function getGoogleWebServicesApiKey() {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_WEB_SERVICES_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Google web-service access is not configured for this build.",
    );
  }

  return apiKey;
}

export function getGoogleAndroidRestrictionHeaders() {
  const packageName = process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME;
  const certificateSha1 = process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1;

  if (!packageName || !certificateSha1) return {};

  return {
    "X-Android-Package": packageName,
    "X-Android-Cert": certificateSha1,
  };
}
