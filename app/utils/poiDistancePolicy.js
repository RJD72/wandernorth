/**
 * Maximum accepted distance between a POI and the actual route.
 *
 * This is not necessarily the same as the Google Places search radius.
 * Google may search wider around sampled route points, but the app only accepts
 * POIs within this distance of the final route geometry.
 */
export const MAX_DISTANCE_FROM_ROUTE_METERS = 3000;
