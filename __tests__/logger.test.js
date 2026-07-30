import { redactLogValue } from "../app/utils/logger";

describe("production-safe log redaction", () => {
  test("redacts credentials and exact coordinates recursively", () => {
    expect(
      redactLogValue({
        apiKey: "not-a-real-key",
        coords: { latitude: 43.4, longitude: -80.5 },
        nested: { authorization: "Bearer test" },
        count: 2,
      }),
    ).toEqual({
      apiKey: "[redacted]",
      coords: "[redacted]",
      nested: { authorization: "[redacted]" },
      count: 2,
    });
  });
});
