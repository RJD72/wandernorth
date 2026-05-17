/**
 * Extracts sample points from a complete route polyline to optimize POI searching.
 *
 * PERFORMANCE RATIONALE:
 * Searching for Points of Interest (POIs) at every single coordinate along a route
 * would generate excessive API calls and degrade performance. This function strategically
 * samples a small subset of points that represent the route's overall path.
 *
 * SAMPLING STRATEGY:
 * Rather than random sampling, we use predetermined percentages along the route:
 * - 25% point: Early segment of the route
 * - 50% point: Middle/midpoint of the route
 * - 75% point: Later segment of the route
 *
 * This distribution ensures we have a balanced representation of the entire route
 * without clustering too many samples in one area.
 *
 * FUTURE IMPROVEMENTS:
 * This could be enhanced with:
 * - Dynamic sampling based on route complexity (more samples for winding routes)
 * - Weighted sampling based on elevation or terrain changes
 * - Adaptive threshold for POI density in different regions
 *
 * @param {Array<Object>} routeCoords - Array of coordinate objects along the route
 *                                      Expected format: [{latitude, longitude}, ...]
 * @returns {Array<Object>} Array of sampled coordinate points. Will be empty if
 *                         routeCoords is not valid or is empty.
 */

export function getSamplePointsAlongRoute(routeCoords = []) {
  // Input validation: Ensure routeCoords is a valid non-empty array
  // This prevents errors if undefined, null, or non-array values are passed
  if (!Array.isArray(routeCoords) || routeCoords.length === 0) return [];

  // Define the percentages along the route where we want to sample points
  // These values range from 0 to 1, representing positions from start to end
  const samplePercentages = [0.1, 0.25, 0.4, 0.5, 0.6, 0.75];

  // Transform each percentage into an actual coordinate point
  return (
    samplePercentages
      .map((percentage) => {
        // Convert percentage to an index in the routeCoords array
        // Example: If we have 100 points and want the 25% point:
        //   - (100 - 1) * 0.25 = 24.75 → Math.floor() = index 24
        // We use (length - 1) to ensure we don't exceed the array bounds
        const index = Math.floor((routeCoords.length - 1) * percentage);

        // Return the coordinate at this calculated index
        return routeCoords[index];
      })
      // Filter out any undefined or null values that might result from edge cases
      // (e.g., if routeCoords has fewer than 4 points, some indices might be invalid)
      .filter(Boolean)
  );
}
