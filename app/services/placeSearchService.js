import { isDemoModeEnabled } from "../config/demoMode";
import { searchDemoPlaces } from "../fixtures/demoData";

export function searchPlacesLocally(query) {
  return isDemoModeEnabled ? searchDemoPlaces(query) : null;
}
