describe("unit-test network safety", () => {
  test("unexpected fetch calls fail immediately with a clear error", () => {
    expect(() =>
      fetch("https://example.invalid/should-never-run"),
    ).toThrow(
      "Unexpected network request in a unit test. Mock fetch explicitly in the test that owns the request.",
    );
  });
});
