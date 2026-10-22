import type { ContestRegion } from "../data/years";
import type { GlobalRankingState } from "../types";
import { loadGlobalRanking, saveGlobalRanking } from "./storage";

function emptyRanking(): GlobalRankingState {
  return { globalOrder: [], insertedYears: [], totalSongCount: 0, manualAdjustments: [], updatedAt: new Date().toISOString() };
}

// Keep both leaderboards in the existing synced state so no database migration is needed.
export async function loadRegionalGlobalRanking(region: ContestRegion) {
  const state = await loadGlobalRanking();
  return region === "asia" ? state?.regionalRankings?.asia ?? null : state;
}
export async function saveRegionalGlobalRanking(state: GlobalRankingState, region: ContestRegion) {
  const saved = await loadGlobalRanking();
  const regionalRankings = saved?.regionalRankings ?? {};
  return saveGlobalRanking(region === "asia"
    ? { ...(saved ?? emptyRanking()), regionalRankings: { ...regionalRankings, asia: state } }
    : { ...state, regionalRankings });
}
export async function clearRegionalGlobalRanking(region: ContestRegion) {
  await saveRegionalGlobalRanking(emptyRanking(), region);
}
