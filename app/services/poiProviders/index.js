import { googlePoiProvider } from "./googlePoiProvider";
import { tomtomPoiProvider } from "./tomtomPoiProvider";

const ENABLE_TOMTOM_POIS =
  process.env.EXPO_PUBLIC_ENABLE_TOMTOM_POIS === "true";

export const availablePoiProviders = [
  googlePoiProvider,
  tomtomPoiProvider,
];

export const activePoiProviders = ENABLE_TOMTOM_POIS
  ? [googlePoiProvider, tomtomPoiProvider]
  : [googlePoiProvider];

export const primaryPoiProvider = googlePoiProvider;
