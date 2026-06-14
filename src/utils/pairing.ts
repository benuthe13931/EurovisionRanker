import type { ComparisonMode, ComparisonState, Song } from "../types";

function estimatedInsertionComparisons(songCount: number) {
  let total = 0;

  for (let sortedLength = 1; sortedLength < songCount; sortedLength += 1) {
    total += Math.ceil(Math.log2(sortedLength + 1));
  }

  return total;
}

function estimatedPendingInsertionComparisons(
  baselineCount: number,
  pendingCount: number,
) {
  let total = 0;

  for (let index = 0; index < pendingCount; index += 1) {
    total += Math.ceil(Math.log2(baselineCount + index + 1));
  }

  return total;
}

function idsForSongs(songs: Song[]) {
  return songs.map((song) => song.id);
}

function sanitizeIds(ids: string[] | undefined, validIds: Set<string>, seen = new Set<string>()) {
  return (ids ?? []).filter((id) => {
    if (!validIds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function nextInsertionState(state: ComparisonState): ComparisonState {
  const activeId = state.pendingIds[0];

  if (!activeId) {
    return {
      ...state,
      activeId: undefined,
      compareAgainstId: undefined,
      currentPair: undefined,
      low: state.sortedIds.length,
      high: state.sortedIds.length,
    };
  }

  const low = Math.max(0, Math.min(state.low, state.sortedIds.length));
  const high = Math.max(low, Math.min(state.high ?? state.sortedIds.length, state.sortedIds.length));

  if (low >= high) {
    const sortedIds = [...state.sortedIds];
    sortedIds.splice(low, 0, activeId);
    return nextInsertionState({
      ...state,
      sortedIds,
      pendingIds: state.pendingIds.filter((id) => id !== activeId),
      low: state.preservePendingOrder ? low + 1 : 0,
      high: sortedIds.length,
      activeId: undefined,
      compareAgainstId: undefined,
      currentPair: undefined,
    });
  }

  const mid = Math.floor((low + high) / 2);
  const compareAgainstId = state.sortedIds[mid];

  return {
    ...state,
    activeId,
    low,
    high,
    compareAgainstId,
    currentPair: compareAgainstId ? [activeId, compareAgainstId] : undefined,
  };
}

export function targetComparisonCount(songCount: number) {
  return estimatedInsertionComparisons(songCount);
}

export function targetPendingInsertionComparisonCount(
  baselineCount: number,
  pendingCount: number,
) {
  return estimatedPendingInsertionComparisons(baselineCount, pendingCount);
}

export function createComparisonState(
  key: string,
  songs: Song[],
  mode: ComparisonMode = "smart",
): ComparisonState {
  const songIds = idsForSongs(songs);
  const sortedIds = songIds.slice(0, 1);
  const pendingIds = songIds.slice(1);

  return nextInsertionState({
    key,
    mode,
    sortedIds,
    pendingIds,
    low: 0,
    high: sortedIds.length,
    completed: 0,
    targetComparisons: targetComparisonCount(songIds.length),
    updatedAt: new Date().toISOString(),
  });
}

export function createInsertionComparisonState(
  key: string,
  baselineIds: string[],
  pendingIds: string[],
  mode: ComparisonMode = "smart",
): ComparisonState {
  return nextInsertionState({
    key,
    mode,
    sortedIds: [...baselineIds],
    pendingIds: pendingIds.filter((id) => !baselineIds.includes(id)),
    preservePendingOrder: true,
    low: 0,
    high: baselineIds.length,
    completed: 0,
    targetComparisons: targetPendingInsertionComparisonCount(
      baselineIds.length,
      pendingIds.length,
    ),
    updatedAt: new Date().toISOString(),
  });
}

export function normalizeComparisonState(
  state: ComparisonState | null | undefined,
  key: string,
  songs: Song[],
  mode: ComparisonMode = "smart",
) {
  const freshState = createComparisonState(key, songs, mode);
  if (!state?.sortedIds || !state.pendingIds) return freshState;

  const validIds = new Set(idsForSongs(songs));
  const seen = new Set<string>();
  const sortedIds = sanitizeIds(state.sortedIds, validIds, seen);
  const pendingIds = sanitizeIds(state.pendingIds, validIds, seen);

  if (!sortedIds.length) return freshState;

  idsForSongs(songs).forEach((id) => {
    if (!seen.has(id)) pendingIds.push(id);
  });

  return nextInsertionState({
    ...freshState,
    sortedIds,
    pendingIds,
    low: state.activeId === pendingIds[0] ? state.low : 0,
    high: state.activeId === pendingIds[0] ? state.high : sortedIds.length,
    completed: state.completed ?? 0,
    updatedAt: state.updatedAt ?? freshState.updatedAt,
  });
}

export function comparisonIsComplete(state: ComparisonState) {
  return state.pendingIds.length === 0 && !state.activeId;
}

export function rankedIdsForState(state: ComparisonState) {
  const pendingIds = state.pendingIds.filter((id) => !state.sortedIds.includes(id));
  return [...state.sortedIds, ...pendingIds];
}

export function songsForComparisonState(state: ComparisonState, songs: Song[]) {
  const byId = new Map(songs.map((song) => [song.id, song]));
  return rankedIdsForState(state).flatMap((id) => {
    const song = byId.get(id);
    return song ? [song] : [];
  });
}

export function chooseInsertionWinner(state: ComparisonState, winnerId: string) {
  const activeId = state.activeId;
  const compareAgainstId = state.compareAgainstId;
  if (!activeId || !compareAgainstId) return nextInsertionState(state);
  if (winnerId !== activeId && winnerId !== compareAgainstId) return nextInsertionState(state);

  const mid = Math.floor((state.low + state.high) / 2);
  let low = state.low;
  let high = state.high;

  if (winnerId === activeId) {
    high = mid;
  } else {
    low = mid + 1;
  }

  let sortedIds = state.sortedIds;
  let pendingIds = state.pendingIds;

  if (low >= high) {
    sortedIds = [...state.sortedIds];
    sortedIds.splice(low, 0, activeId);
    pendingIds = state.pendingIds.filter((id) => id !== activeId);
    low = state.preservePendingOrder ? low + 1 : 0;
    high = sortedIds.length;
  }

  return nextInsertionState({
    ...state,
    sortedIds,
    pendingIds,
    low,
    high,
    completed: state.completed + 1,
    updatedAt: new Date().toISOString(),
  });
}
