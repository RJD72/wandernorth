import { API_LIMITS } from "../config/apiLimits";

export async function searchExploreCandidates({
  candidates = [],
  evaluateCandidate,
  isAcceptable,
  onCandidateFailure = () => {},
  now = Date.now,
}) {
  const startedAt = now();
  const cappedCandidates = candidates.slice(
    0,
    API_LIMITS.exploreMaximumCandidates,
  );
  const waves = [
    cappedCandidates.slice(0, API_LIMITS.exploreFirstWaveSize),
    cappedCandidates.slice(API_LIMITS.exploreFirstWaveSize),
  ];
  const successfulCandidates = [];
  let attemptedCount = 0;

  for (let waveIndex = 0; waveIndex < waves.length; waveIndex += 1) {
    for (const candidate of waves[waveIndex]) {
      attemptedCount += 1;
      try {
        const evaluated = await evaluateCandidate(candidate);
        successfulCandidates.push(evaluated);

        if (isAcceptable(evaluated)) {
          return {
            candidate: evaluated,
            metrics: {
              candidatesAttempted: attemptedCount,
              firstAcceptableCandidatePosition: attemptedCount,
              totalRouteCalls: attemptedCount,
              elapsedMs: now() - startedAt,
              wave: waveIndex + 1,
            },
          };
        }
      } catch (error) {
        onCandidateFailure(candidate, error);
      }
    }
  }

  const candidate =
    [...successfulCandidates].sort(
      (first, second) => first.candidateScore - second.candidateScore,
    )[0] || null;

  return {
    candidate,
    metrics: {
      candidatesAttempted: attemptedCount,
      firstAcceptableCandidatePosition: null,
      totalRouteCalls: attemptedCount,
      elapsedMs: now() - startedAt,
      wave: candidate ? 2 : null,
    },
  };
}
