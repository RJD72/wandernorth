import { API_LIMITS } from "../app/config/apiLimits";
import { searchExploreCandidates } from "../app/services/exploreCandidateSearch";

function candidates(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    candidateScore: index + 1,
  }));
}

describe("Explore staged candidate search", () => {
  test("stops at the first acceptable candidate", async () => {
    const evaluateCandidate = jest.fn(async (candidate) => candidate);
    const result = await searchExploreCandidates({
      candidates: candidates(20),
      evaluateCandidate,
      isAcceptable: (candidate) => candidate.id === 3,
    });

    expect(result.candidate.id).toBe(3);
    expect(evaluateCandidate).toHaveBeenCalledTimes(3);
    expect(result.metrics.firstAcceptableCandidatePosition).toBe(3);
    expect(result.metrics.wave).toBe(1);
  });

  test("enforces the absolute cap and reaches wave two only when needed", async () => {
    const evaluateCandidate = jest.fn(async (candidate) => candidate);
    const result = await searchExploreCandidates({
      candidates: candidates(25),
      evaluateCandidate,
      isAcceptable: () => false,
    });

    expect(evaluateCandidate).toHaveBeenCalledTimes(
      API_LIMITS.exploreMaximumCandidates,
    );
    expect(result.metrics.candidatesAttempted).toBe(10);
    expect(result.metrics.wave).toBe(2);
  });
});
