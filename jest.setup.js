const unexpectedFetch = jest.fn(() => {
  throw new Error(
    "Unexpected network request in a unit test. Mock fetch explicitly in the test that owns the request.",
  );
});

beforeEach(() => {
  unexpectedFetch.mockClear();
  global.fetch = unexpectedFetch;
});

afterAll(() => {
  delete global.fetch;
});
