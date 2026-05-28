import type { ComparisonMode, ComparisonState, Song } from "../types";
import { initialRatings } from "./elo";

export function pairKey(a: string, b: string) {
  return [a, b].sort().join("__");
}

export function targetComparisonCount(songCount: number) {
  return Math.ceil(songCount * Math.log2(Math.max(songCount, 2)) * 0.85);
}

export function allUniquePairs(songIds: string[]) {
  const pairs: [string, string][] = [];
  for (let i = 0; i < songIds.length; i += 1) {
    for (let j = i + 1; j < songIds.length; j += 1) {
      pairs.push([songIds[i], songIds[j]]);
    }
  }
  return pairs;
}

export function createComparisonState(
  key: string,
  songs: Song[],
  mode: ComparisonMode,
): ComparisonState {
  const songIds = songs.map((song) => song.id);
  const fullPairs = mode === "full" ? allUniquePairs(songIds) : undefined;
  const targetComparisons =
    mode === "full" ? allUniquePairs(songIds).length : targetComparisonCount(songIds.length);

  return {
    key,
    mode,
    ratings: initialRatings(songIds),
    comparedPairs: [],
    completed: 0,
    targetComparisons,
    fullPairs,
    updatedAt: new Date().toISOString(),
  };
}

export function pickNextPair(state: ComparisonState, songs: Song[]) {
  const compared = new Set(state.comparedPairs);
  const songIds = songs.map((song) => song.id);

  if (state.mode === "full") {
    return state.fullPairs?.find(([a, b]) => !compared.has(pairKey(a, b)));
  }

  const counts = Object.fromEntries(songIds.map((id) => [id, 0]));
  state.comparedPairs.forEach((key) => {
    const [a, b] = key.split("__");
    if (a in counts) counts[a] += 1;
    if (b in counts) counts[b] += 1;
  });

  const minCount = Math.min(...Object.values(counts));
  const underCompared = songIds.filter((id) => counts[id] <= minCount + 1);
  const pool = underCompared.length >= 2 ? underCompared : songIds;

  let bestPair: [string, string] | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const a = pool[i];
      const b = pool[j];
      if (compared.has(pairKey(a, b))) continue;

      const eloGap = Math.abs((state.ratings[a] ?? 1500) - (state.ratings[b] ?? 1500));
      const countPenalty = (counts[a] + counts[b]) * 8;
      const jitter = Math.random() * 3;
      const score = eloGap + countPenalty + jitter;

      if (score < bestScore) {
        bestScore = score;
        bestPair = [a, b];
      }
    }
  }

  if (bestPair) return bestPair;
  return allUniquePairs(songIds).find(([a, b]) => !compared.has(pairKey(a, b)));
}
