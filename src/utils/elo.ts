export const DEFAULT_ELO = 1500;
export const ELO_K = 32;

export function expectedScore(ratingA: number, ratingB: number) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function updateElo(
  ratingA: number,
  ratingB: number,
  scoreA: 0 | 1,
  k = ELO_K,
) {
  const expectedA = expectedScore(ratingA, ratingB);
  const expectedB = expectedScore(ratingB, ratingA);
  const scoreB = scoreA === 1 ? 0 : 1;

  return {
    ratingA: ratingA + k * (scoreA - expectedA),
    ratingB: ratingB + k * (scoreB - expectedB),
  };
}

export function initialRatings(songIds: string[]) {
  return Object.fromEntries(songIds.map((id) => [id, DEFAULT_ELO]));
}
