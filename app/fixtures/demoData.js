import polyline from "@mapbox/polyline";

export const DEMO_ROUTE_REQUEST = Object.freeze({
  source: "navigate",
  startingAddress: "Clinton, Ontario",
  destinationAddress: "Walkerton, Ontario",
  startingCoords: { latitude: 43.6177, longitude: -81.5395 },
  destinationCoords: { latitude: 44.1302, longitude: -81.1536 },
  travelMode: "driving",
  numStops: 3,
  selectedPoiTypes: [],
  demo: true,
});
const BASE_ROUTE_COORDS = [
  [43.6177, -81.5395],
  [43.684, -81.503],
  [43.746, -81.447],
  [43.806, -81.389],
  [43.873, -81.326],
  [43.944, -81.266],
  [44.012, -81.218],
  [44.075, -81.181],
  [44.1302, -81.1536],
];
export const DEMO_POIS = Object.freeze([
  {
    id: "demo-poi-blyth-cafe",
    provider: "demo",
    providerPlaceId: "blyth-cafe",
    name: "Blyth Creek Café",
    address: "Queen St, Blyth, ON",
    category: "cafe",
    latitude: 43.735,
    longitude: -81.429,
    rating: 4.7,
    userRatingCount: 184,
  },
  {
    id: "demo-poi-wawanosh-park",
    provider: "demo",
    providerPlaceId: "wawanosh-park",
    name: "Wawanosh Valley Trail",
    address: "Huron County, ON",
    category: "park",
    latitude: 43.795,
    longitude: -81.381,
    rating: 4.6,
    userRatingCount: 92,
  },
  {
    id: "demo-poi-wingham-museum",
    provider: "demo",
    providerPlaceId: "wingham-museum",
    name: "North Huron Museum",
    address: "Josephine St, Wingham, ON",
    category: "museum",
    latitude: 43.887,
    longitude: -81.312,
    rating: 4.5,
    userRatingCount: 61,
  },
  {
    id: "demo-poi-riverside-restaurant",
    provider: "demo",
    providerPlaceId: "riverside-restaurant",
    name: "Riverside Grill",
    address: "Wingham, ON",
    category: "restaurant",
    latitude: 43.891,
    longitude: -81.307,
    rating: 4.4,
    userRatingCount: 238,
  },
  {
    id: "demo-poi-teeswater-park",
    provider: "demo",
    providerPlaceId: "teeswater-park",
    name: "Teeswater River Park",
    address: "Clinton St, Teeswater, ON",
    category: "park",
    latitude: 44.001,
    longitude: -81.225,
    rating: 4.6,
    userRatingCount: 73,
  },
  {
    id: "demo-poi-walkerton-bakery",
    provider: "demo",
    providerPlaceId: "walkerton-bakery",
    name: "Saugeen Country Bakery",
    address: "Durham St, Walkerton, ON",
    category: "cafe",
    latitude: 44.126,
    longitude: -81.157,
    rating: 4.8,
    userRatingCount: 315,
  },
]);
export const DEMO_PLACE_RESULTS = Object.freeze([
  {
    placeId: "demo-custom-cowbell",
    name: "Cowbell Brewing Co.",
    address: "40035 Blyth Rd, Blyth, ON",
    coords: { latitude: 43.7317, longitude: -81.4291 },
  },
  {
    placeId: "demo-custom-greenock",
    name: "Greenock Swamp Wetland Complex",
    address: "Bruce County, ON",
    coords: { latitude: 44.071, longitude: -81.245 },
  },
  {
    placeId: "demo-custom-saugeen",
    name: "Saugeen River Lookout",
    address: "Walkerton, ON",
    coords: { latitude: 44.124, longitude: -81.165 },
  },
]);
export function createDemoRoute({
  waypoints = [],
  travelMode = "driving",
} = {}) {
  const waypointPairs = waypoints.map((p) => [p.latitude, p.longitude]);
  const coords = [
    ...BASE_ROUTE_COORDS.slice(0, 4),
    ...waypointPairs,
    ...BASE_ROUTE_COORDS.slice(4),
  ];
  const distanceMeters = 68200 + waypointPairs.length * 1800;
  const seconds = 3900 + waypointPairs.length * 420;
  return {
    raw: { provider: "demo", waypointCount: waypointPairs.length },
    distanceMeters,
    distanceText: `${(distanceMeters / 1000).toFixed(1)} km`,
    duration: `${seconds}s`,
    durationText: `${Math.floor(seconds / 3600)} hr ${Math.round(
      (seconds % 3600) / 60
    )} min`,
    encodedPolyline: polyline.encode(coords),
    legs: [],
    travelMode,
    demo: true,
  };
}
export function searchDemoPlaces(query) {
  const value = String(query || "")
    .trim()
    .toLowerCase();
  if (value.length < 2) return [];
  return DEMO_PLACE_RESULTS.filter((p) =>
    `${p.name} ${p.address}`.toLowerCase().includes(value)
  );
}
