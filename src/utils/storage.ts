import type {
  ComparisonState,
  ComparisonStatus,
  GlobalRankingState,
  PredictionState,
  RankingSnapshot,
  RankingState,
} from "../types";
import { supabase } from "./supabase";

const RANKING_PREFIX = "eurovision-ranker:ranking:";
const COMPARISON_PREFIX = "eurovision-ranker:comparison:";
const COMPARISON_STATUS_PREFIX = "eurovision-ranker:comparison-status:";
const SNAPSHOT_PREFIX = "eurovision-ranker:ranking-snapshots:";
const PREDICTION_PREFIX = "eurovision-ranker:prediction:";
const GLOBAL_RANKING_KEY = "eurovision-ranker:global-ranking";
const FAVORITES_KEY = "eurovision-ranker:favorites";
const TRIVIA_SESSION_KEY = "eurovision-ranker:trivia-session";
const ACTIVE_PROFILE_KEY = "eurovision-ranker:active-profile";
const PROFILE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ActiveProfile = {
  id: string;
  name: string;
  username: string;
  expiresAt?: string;
};

export type TriviaSessionMetadata = {
  hasSession: boolean;
  savedAt: string | null;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function profileExpired(profile: ActiveProfile) {
  return profile.expiresAt
    ? Date.parse(profile.expiresAt) <= Date.now()
    : false;
}

function notifyProfileChange() {
  window.dispatchEvent(new Event("profile:changed"));
}

function clearActiveProfile() {
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
  notifyProfileChange();
}

function profileWithExpiry(profile: ActiveProfile): ActiveProfile {
  return {
    ...profile,
    expiresAt: new Date(Date.now() + PROFILE_TTL_MS).toISOString(),
  };
}

function activeProfile() {
  const profile = readJson<ActiveProfile>(ACTIVE_PROFILE_KEY);
  if (!profile) return null;

  if (!UUID_PATTERN.test(profile.id) || profileExpired(profile)) {
    clearActiveProfile();
    return null;
  }

  return profile;
}

function activeProfileId() {
  return activeProfile()?.id;
}

function rankingStorageKey(key: string) {
  return `${RANKING_PREFIX}${key}`;
}

function comparisonStorageKey(key: string) {
  return `${COMPARISON_PREFIX}${key}`;
}

function predictionStorageKey(key: string) {
  return `${PREDICTION_PREFIX}${key}`;
}

function snapshotStorageKey(key: string) {
  return `${SNAPSHOT_PREFIX}${activeProfileId() ?? "guest"}:${key}`;
}

function comparisonStatusStorageKey(key: string) {
  return `${COMPARISON_STATUS_PREFIX}${activeProfileId() ?? "guest"}:${key}`;
}

function uuid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function rankingContextFromKey(key: string): {
  scopeType: RankingSnapshot["scopeType"];
  scopeId: string;
  rankingMode: string | null;
} {
  const parts = key.split(":");
  if (parts[0] === "year") {
    return {
      scopeType: "year",
      scopeId: parts[1] ?? key,
      rankingMode: parts.slice(2).join(":") || "overall",
    };
  }
  if (parts[0] === "country") {
    return {
      scopeType: "country",
      scopeId: parts[1] ?? key,
      rankingMode: null,
    };
  }
  return { scopeType: "global", scopeId: "global", rankingMode: null };
}

async function rpc<T>(name: string, args: Record<string, unknown>) {
  if (
    !import.meta.env.VITE_SUPABASE_URL ||
    !import.meta.env.VITE_SUPABASE_ANON_KEY
  ) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.",
    );
  }

  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const rawError = [error.code, error.message, error.details]
      .filter(Boolean)
      .join(" | ");
    const missingFunction =
      error.code === "42883" ||
      error.code === "PGRST202" ||
      error.message.includes("Could not find the function") ||
      error.message.includes("function") ||
      error.message.includes("schema cache");

    if (missingFunction) {
      throw new Error(
        `Supabase setup is missing RPC function "${name}". Run the latest supabase/schema.sql in the Supabase SQL Editor, then retry after the schema cache refreshes. Supabase said: ${rawError}`,
      );
    }

    const missingTable =
      error.code === "42P01" ||
      error.message.includes("relation") ||
      error.message.includes("does not exist");

    if (missingTable) {
      throw new Error(
        `Supabase setup is missing tables. Run the latest supabase/schema.sql in the Supabase SQL Editor. Supabase said: ${rawError}`,
      );
    }

    throw new Error(rawError || error.message);
  }
  return data as T;
}

function missingRpcError(error: unknown, name: string) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes(`RPC function "${name}"`) ||
    error.message.includes(`function public.${name}`) ||
    error.message.includes("Could not find the function")
  );
}

async function copyGuestDataToProfile() {
  if (!activeProfileId()) return;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(RANKING_PREFIX)) continue;

    const value = readJson<RankingState>(key);
    if (value)
      await saveRanking(key.slice(RANKING_PREFIX.length), value.songIds);
  }

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(`${SNAPSHOT_PREFIX}guest:`)) continue;

    const snapshots = readJson<RankingSnapshot[]>(key);
    if (!snapshots) continue;
    for (const snapshot of snapshots) {
      await createRankingSnapshot(snapshot.key, snapshot.songIds, {
        name: snapshot.name,
        notes: snapshot.notes ?? undefined,
        createdAt: snapshot.createdAt,
      });
    }
  }

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(`${COMPARISON_STATUS_PREFIX}guest:`)) continue;

    const status = readJson<ComparisonStatus>(key);
    if (status) await saveComparisonStatus(status);
  }

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(PREDICTION_PREFIX)) continue;

    const value = readJson<PredictionState>(key);
    if (value) await savePrediction(value);
  }

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(COMPARISON_PREFIX)) continue;

    const value = readJson<ComparisonState>(key);
    if (value) await saveComparison(value);
  }

  const globalRanking = readJson<GlobalRankingState>(GLOBAL_RANKING_KEY);
  if (globalRanking) await saveGlobalRanking(globalRanking);

  const favorites = readJson<string[]>(FAVORITES_KEY);
  if (favorites) await saveFavorites(new Set(favorites));

  const triviaSession = readJson<unknown>(TRIVIA_SESSION_KEY);
  if (triviaSession) await saveRemoteTriviaSession(triviaSession);
}

export async function loadRanking(key: string) {
  const profileId = activeProfileId();
  if (!profileId) return readJson<RankingState>(rankingStorageKey(key));

  return rpc<RankingState | null>("get_ranking", {
    p_profile_id: profileId,
    p_ranking_key: key,
  });
}

export async function saveRanking(key: string, songIds: string[]) {
  const ranking: RankingState = {
    key,
    songIds,
    updatedAt: new Date().toISOString(),
  };

  if (!activeProfileId()) {
    localStorage.setItem(rankingStorageKey(key), JSON.stringify(ranking));
    return ranking;
  }

  return rpc<RankingState>("save_ranking", {
    p_profile_id: activeProfileId(),
    p_ranking_key: key,
    p_song_ids: songIds,
  });
}

export async function clearRanking(key: string) {
  if (!activeProfileId()) {
    localStorage.removeItem(rankingStorageKey(key));
    return;
  }

  await rpc<void>("clear_ranking", {
    p_profile_id: activeProfileId(),
    p_ranking_key: key,
  });
}

export async function loadRankingSnapshots(key: string) {
  const profileId = activeProfileId();
  if (!profileId) return readJson<RankingSnapshot[]>(snapshotStorageKey(key)) ?? [];

  try {
    return await rpc<RankingSnapshot[]>("get_ranking_snapshots", {
      p_profile_id: profileId,
      p_ranking_key: key,
    });
  } catch (error) {
    if (missingRpcError(error, "get_ranking_snapshots")) {
      return readJson<RankingSnapshot[]>(snapshotStorageKey(key)) ?? [];
    }
    throw error;
  }
}

export async function createRankingSnapshot(
  key: string,
  songIds: string[],
  options?: { name?: string; notes?: string; createdAt?: string },
) {
  const existing = await loadRankingSnapshots(key);
  const { scopeType, scopeId, rankingMode } = rankingContextFromKey(key);
  const now = options?.createdAt ?? new Date().toISOString();
  const snapshot: RankingSnapshot = {
    id: uuid(),
    key,
    scopeType,
    scopeId,
    rankingMode,
    name: options?.name?.trim() || `Snapshot #${existing.length + 1}`,
    notes: options?.notes?.trim() || null,
    songIds,
    createdAt: now,
    updatedAt: now,
  };

  const profileId = activeProfileId();
  if (!profileId) {
    localStorage.setItem(
      snapshotStorageKey(key),
      JSON.stringify([...existing, snapshot]),
    );
    return snapshot;
  }

  try {
    return await rpc<RankingSnapshot>("create_ranking_snapshot", {
      p_profile_id: profileId,
      p_snapshot: snapshot,
    });
  } catch (error) {
    if (missingRpcError(error, "create_ranking_snapshot")) {
      localStorage.setItem(
        snapshotStorageKey(key),
        JSON.stringify([...existing, snapshot]),
      );
      return snapshot;
    }
    throw error;
  }
}

export async function deleteRankingSnapshot(key: string, snapshotId: string) {
  const profileId = activeProfileId();
  if (!profileId) {
    const snapshots = await loadRankingSnapshots(key);
    localStorage.setItem(
      snapshotStorageKey(key),
      JSON.stringify(snapshots.filter((snapshot) => snapshot.id !== snapshotId)),
    );
    return;
  }

  try {
    await rpc<void>("delete_ranking_snapshot", {
      p_profile_id: profileId,
      p_snapshot_id: snapshotId,
    });
  } catch (error) {
    if (missingRpcError(error, "delete_ranking_snapshot")) {
      const snapshots = await loadRankingSnapshots(key);
      localStorage.setItem(
        snapshotStorageKey(key),
        JSON.stringify(
          snapshots.filter((snapshot) => snapshot.id !== snapshotId),
        ),
      );
      return;
    }
    throw error;
  }
}

export async function loadGlobalRanking() {
  const profileId = activeProfileId();
  if (!profileId) return readJson<GlobalRankingState>(GLOBAL_RANKING_KEY);

  try {
    return await rpc<GlobalRankingState | null>("get_global_ranking", {
      p_profile_id: profileId,
    });
  } catch (error) {
    if (missingRpcError(error, "get_global_ranking")) {
      return readJson<GlobalRankingState>(GLOBAL_RANKING_KEY);
    }
    throw error;
  }
}

export async function saveGlobalRanking(state: GlobalRankingState) {
  const updatedState: GlobalRankingState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };

  if (!activeProfileId()) {
    localStorage.setItem(GLOBAL_RANKING_KEY, JSON.stringify(updatedState));
    return updatedState;
  }

  try {
    return await rpc<GlobalRankingState>("save_global_ranking", {
      p_profile_id: activeProfileId(),
      p_state: updatedState,
    });
  } catch (error) {
    if (missingRpcError(error, "save_global_ranking")) {
      localStorage.setItem(GLOBAL_RANKING_KEY, JSON.stringify(updatedState));
      return updatedState;
    }
    throw error;
  }
}

export async function clearGlobalRanking() {
  if (!activeProfileId()) {
    localStorage.removeItem(GLOBAL_RANKING_KEY);
    return;
  }

  try {
    await rpc<void>("clear_global_ranking", {
      p_profile_id: activeProfileId(),
    });
  } catch (error) {
    if (missingRpcError(error, "clear_global_ranking")) {
      localStorage.removeItem(GLOBAL_RANKING_KEY);
      return;
    }
    throw error;
  }
}

export async function loadFavorites() {
  const profileId = activeProfileId();
  if (!profileId) return new Set(readJson<string[]>(FAVORITES_KEY) ?? []);

  return new Set(
    await rpc<string[]>("get_favorites", { p_profile_id: profileId }),
  );
}

export async function saveFavorites(favorites: Set<string>) {
  const songIds = [...favorites];

  if (!activeProfileId()) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(songIds));
    return { songIds, updatedAt: new Date().toISOString() };
  }

  return rpc<{ songIds: string[]; updatedAt: string }>("save_favorites", {
    p_profile_id: activeProfileId(),
    p_song_ids: songIds,
  });
}

export async function loadComparison(key: string) {
  const profileId = activeProfileId();
  if (!profileId) return readJson<ComparisonState>(comparisonStorageKey(key));

  return rpc<ComparisonState | null>("get_comparison", {
    p_profile_id: profileId,
    p_comparison_key: key,
  });
}

export async function saveComparison(state: ComparisonState) {
  if (!activeProfileId()) {
    localStorage.setItem(
      comparisonStorageKey(state.key),
      JSON.stringify(state),
    );
    return state;
  }

  return rpc<ComparisonState>("save_comparison", {
    p_profile_id: activeProfileId(),
    p_comparison_key: state.key,
    p_state: state,
  });
}

export async function clearComparison(key: string) {
  if (!activeProfileId()) {
    localStorage.removeItem(comparisonStorageKey(key));
    return;
  }

  await rpc<void>("clear_comparison", {
    p_profile_id: activeProfileId(),
    p_comparison_key: key,
  });
}

export async function loadComparisonStatus(key: string) {
  const profileId = activeProfileId();
  if (!profileId)
    return readJson<ComparisonStatus>(comparisonStatusStorageKey(key));

  try {
    return await rpc<ComparisonStatus | null>("get_comparison_status", {
      p_profile_id: profileId,
      p_status_key: key,
    });
  } catch (error) {
    if (missingRpcError(error, "get_comparison_status")) {
      return readJson<ComparisonStatus>(comparisonStatusStorageKey(key));
    }
    throw error;
  }
}

export async function saveComparisonStatus(status: ComparisonStatus) {
  const profileId = activeProfileId();
  const context = rankingContextFromKey(status.key);
  const nextStatus: ComparisonStatus = {
    ...context,
    ...status,
    completedAt: status.completedAt || new Date().toISOString(),
  };

  if (!profileId) {
    localStorage.setItem(
      comparisonStatusStorageKey(status.key),
      JSON.stringify(nextStatus),
    );
    return nextStatus;
  }

  try {
    return await rpc<ComparisonStatus>("save_comparison_status", {
      p_profile_id: profileId,
      p_status: nextStatus,
    });
  } catch (error) {
    if (missingRpcError(error, "save_comparison_status")) {
      localStorage.setItem(
        comparisonStatusStorageKey(status.key),
        JSON.stringify(nextStatus),
      );
      return nextStatus;
    }
    throw error;
  }
}

export async function loadPrediction(key: string) {
  const profileId = activeProfileId();
  if (!profileId) return readJson<PredictionState>(predictionStorageKey(key));

  try {
    return await rpc<PredictionState | null>("get_prediction", {
      p_prediction_key: key,
      p_profile_id: profileId,
    });
  } catch (error) {
    if (missingRpcError(error, "get_prediction")) {
      return readJson<PredictionState>(predictionStorageKey(key));
    }
    throw error;
  }
}

export async function savePrediction(state: PredictionState) {
  const updatedState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };

  if (!activeProfileId()) {
    localStorage.setItem(
      predictionStorageKey(state.key),
      JSON.stringify(updatedState),
    );
    return updatedState;
  }

  try {
    return await rpc<PredictionState>("save_prediction", {
      p_prediction_key: state.key,
      p_profile_id: activeProfileId(),
      p_state: updatedState,
    });
  } catch (error) {
    if (missingRpcError(error, "save_prediction")) {
      localStorage.setItem(
        predictionStorageKey(state.key),
        JSON.stringify(updatedState),
      );
      return updatedState;
    }
    throw error;
  }
}

export async function clearPrediction(key: string) {
  if (!activeProfileId()) {
    localStorage.removeItem(predictionStorageKey(key));
    return;
  }

  try {
    await rpc<void>("clear_prediction", {
      p_prediction_key: key,
      p_profile_id: activeProfileId(),
    });
  } catch (error) {
    if (missingRpcError(error, "clear_prediction")) {
      localStorage.removeItem(predictionStorageKey(key));
      return;
    }
    throw error;
  }
}

export function loadLocalTriviaSession<T>() {
  return readJson<T>(TRIVIA_SESSION_KEY);
}

export function saveLocalTriviaSession<T>(state: T) {
  localStorage.setItem(TRIVIA_SESSION_KEY, JSON.stringify(state));
  return state;
}

export function clearLocalTriviaSession() {
  localStorage.removeItem(TRIVIA_SESSION_KEY);
}

export async function getTriviaSessionMetadata() {
  const profileId = activeProfileId();
  if (!profileId) {
    return { hasSession: false, savedAt: null } satisfies TriviaSessionMetadata;
  }

  return rpc<TriviaSessionMetadata>("get_trivia_session_metadata", {
    p_profile_id: profileId,
  });
}

export async function loadRemoteTriviaSession<T>() {
  const profileId = activeProfileId();
  if (!profileId) return null;

  return rpc<T | null>("get_trivia_session", {
    p_profile_id: profileId,
  });
}

export async function saveRemoteTriviaSession<T>(state: T) {
  const profileId = activeProfileId();
  if (!profileId) return state;

  return rpc<T>("save_trivia_session", {
    p_profile_id: profileId,
    p_state: state,
  });
}

export async function clearRemoteTriviaSession() {
  const profileId = activeProfileId();
  if (!profileId) return;

  await rpc<void>("clear_trivia_session", {
    p_profile_id: profileId,
  });
}

export async function loadTriviaSession<T>(
  options: { remote?: boolean } = {},
) {
  if (options.remote === false) return loadLocalTriviaSession<T>();

  try {
    return (await loadRemoteTriviaSession<T>()) ?? loadLocalTriviaSession<T>();
  } catch (error) {
    return loadLocalTriviaSession<T>();
  }
}

export async function saveTriviaSession<T>(
  state: T,
  options: { remote?: boolean } = {},
) {
  saveLocalTriviaSession(state);

  if (options.remote === false) return state;

  try {
    return await saveRemoteTriviaSession(state);
  } catch (error) {
    return state;
  }
}

export async function clearTriviaSession() {
  clearLocalTriviaSession();

  try {
    await clearRemoteTriviaSession();
  } catch (error) {
    return;
  }
}

export function validatePassword(password: string) {
  if (password.length < 8 || password.length > 20)
    return "Password must be 8-20 characters.";
  if (!/[a-z]/.test(password))
    return "Password needs at least one lowercase letter.";
  if (!/[A-Z]/.test(password))
    return "Password needs at least one capital letter.";
  if (!/[0-9]/.test(password)) return "Password needs at least one number.";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Password needs at least one symbol.";
  return "";
}

export function getPasswordRequirements(password: string) {
  return [
    {
      label: "8-20 characters",
      met: password.length >= 8 && password.length <= 20,
    },
    { label: "lowercase letter", met: /[a-z]/.test(password) },
    { label: "capital letter", met: /[A-Z]/.test(password) },
    { label: "number", met: /[0-9]/.test(password) },
    { label: "symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function loadActiveProfile() {
  return activeProfile();
}

export async function signUpProfile(
  name: string,
  username: string,
  password: string,
) {
  const profile = await rpc<ActiveProfile>("signup_profile", {
    p_name: name,
    p_username: username,
    p_password: password,
  });

  const activeProfile = profileWithExpiry(profile);
  localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(activeProfile));
  notifyProfileChange();
  await copyGuestDataToProfile();
  return activeProfile;
}

export async function loginProfile(username: string, password: string) {
  const profile = await rpc<ActiveProfile>("login_profile", {
    p_username: username,
    p_password: password,
  });

  const activeProfile = profileWithExpiry(profile);
  localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(activeProfile));
  notifyProfileChange();
  return activeProfile;
}

export function logoutProfile() {
  clearActiveProfile();
}
