import { googlePoiProvider } from "./googlePoiProvider";
import { tomtomPoiProvider } from "./tomtomPoiProvider";

export const availablePoiProviders = [
  googlePoiProvider,
  tomtomPoiProvider,
];

export const activePoiProviders = [googlePoiProvider];

export const primaryPoiProvider = googlePoiProvider;
