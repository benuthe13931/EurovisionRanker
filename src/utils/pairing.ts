import type { ComparisonMode, ComparisonState, Song } from "../types";
import { initialRatings } from "./elo";

export function pairKey(a: string, b: string) {
  return [a, b].sort().join("__");
}

function smartExplorationCount(songCount: number) {
  return Math.ceil(songCount * Math.log2(Math.max(songCount, 2)) * 1.15);
}

function smartFinalistCount(songCount: number) {
  return Math.min(songCount, Math.max(3, Math.min(8, Math.ceil(Math.sqrt(songCount)) + 2)));
}

function smartBubbleCount(songCount: number) {
  return Math.min(songCount, Math.max(smartFinalistCount(songCount), 12));
}

function smartTieBreakerEstimate(songCount: number) {
  const finalistCount = smartFinalistCount(songCount);
  const bubbleCount = smartBubbleCount(songCount);
  const finalistPairs = (finalistCount * (finalistCount - 1)) / 2;
  let bubblePairs = 0;

  for (let i = 0; i < bubbleCount; i += 1) {
    bubblePairs += Math.min(3, bubbleCount - i - 1);
  }

  return finalistPairs + bubblePairs;
}

export function targetComparisonCount(songCount: number) {
  const fullPairCount = (songCount * (songCount - 1)) / 2;
  return Math.min(fullPairCount, smartExplorationCount(songCount) + smartTieBreakerEstimate(songCount));
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

function sortedSongIdsByRating(songs: Song[], ratings: Record<string, number>) {
  return [...songs]
    .sort((a, b) => {
      const ratingDiff = (ratings[b.id] ?? 1500) - (ratings[a.id] ?? 1500);
      return ratingDiff || a.id.localeCompare(b.id);
    })
    .map((song) => song.id);
}

export function missingRequiredSmartPairs(state: ComparisonState, songs: Song[]) {
  if (state.mode !== "smart" || state.completed < smartExplorationCount(songs.length)) {
    return [];
  }

  const compared = new Set(state.comparedPairs);
  const sortedIds = sortedSongIdsByRating(songs, state.ratings);
  const finalistIds = sortedIds.slice(0, smartFinalistCount(sortedIds.length));
  const bubbleIds = sortedIds.slice(0, smartBubbleCount(sortedIds.length));
  const requiredKeys = new Set<string>();
  const requiredPairs: [string, string][] = [];

  function addPair(a: string, b: string) {
    const key = pairKey(a, b);
    if (requiredKeys.has(key) || compared.has(key)) return;
    requiredKeys.add(key);
    requiredPairs.push([a, b]);
  }

  for (let i = 0; i < finalistIds.length; i += 1) {
    for (let j = i + 1; j < finalistIds.length; j += 1) {
      addPair(finalistIds[i], finalistIds[j]);
    }
  }

  for (let i = 0; i < bubbleIds.length; i += 1) {
    for (let j = i + 1; j < Math.min(bubbleIds.length, i + 4); j += 1) {
      addPair(bubbleIds[i], bubbleIds[j]);
    }
  }

  return requiredPairs.sort((a, b) => {
    const aGap = Math.abs((state.ratings[a[0]] ?? 1500) - (state.ratings[a[1]] ?? 1500));
    const bGap = Math.abs((state.ratings[b[0]] ?? 1500) - (state.ratings[b[1]] ?? 1500));
    return aGap - bGap;
  });
}

export function comparisonIsComplete(state: ComparisonState, songs: Song[]) {
  if (state.mode === "full") {
    return state.completed >= state.targetComparisons || !pickNextPair(state, songs);
  }

  return (
    state.completed >= state.targetComparisons &&
    missingRequiredSmartPairs(state, songs).length === 0
  );
}

export function pickNextPair(state: ComparisonState, songs: Song[]) {
  const compared = new Set(state.comparedPairs);
  const songIds = songs.map((song) => song.id);

  if (state.mode === "full") {
    return state.fullPairs?.find(([a, b]) => !compared.has(pairKey(a, b)));
  }

  const requiredSmartPair = missingRequiredSmartPairs(state, songs)[0];
  if (requiredSmartPair) return requiredSmartPair;

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
