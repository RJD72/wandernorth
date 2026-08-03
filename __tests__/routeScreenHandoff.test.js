import fs from "fs";
import path from "path";

describe("Route screen handoff architecture", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../app/(screens)/route.jsx"),
    "utf8",
  );

  test("contains only the initial route build and no final-route request", () => {
    expect(source.match(/\bbuildRoute\s*\(/g)).toHaveLength(1);
    expect(source).not.toContain('purpose: "final"');
    expect(source).not.toContain("handleBuildFinalRoute");
    expect(source).not.toContain("Build Final Route");
    expect(source).not.toMatch(/optimizeWaypointOrder|optimizeWaypoints/);
  });

  test("uses the shared preparation for display, handoff, save, and reopen", () => {
    expect(source).toContain("prepareStopsForRouteHandoff(");
    expect(source).toContain("selectedStops={orderedSelectedStops}");
    expect(source).toContain("orderedStops,");
    expect(source).toContain("selectedStops: orderedStops");
    expect(source).toContain("refreshedSavedStops");
    expect(source).toContain(
      "One or more selected stops is missing valid coordinates.",
    );
  });

  test("keeps the explicit route-ordering explanation near handoff", () => {
    expect(source).toContain("Stops are ordered along your route.");
    expect(source).toContain(
      "Google Maps will calculate\n                the roads between them.",
    );
    expect(source).not.toContain("globally optimized");
  });

  test("keeps same-route POIs visible during category refresh and guards stale responses", () => {
    expect(source).toContain("lastPoiRouteIdentityRef");
    expect(source).toContain("const routeChanged =");
    expect(source).toContain("if (routeChanged) {");
    expect(source).toContain("if (!isCurrent) return;");
    expect(source).toContain('logger.log("[route] Route POIs loaded:"');
    expect(source).not.toContain("All route POIs cached");
  });
});
