import type { ComparisonState, RankingState } from "../types";
import { supabase } from "./supabase";

const RANKING_PREFIX = "eurovision-ranker:ranking:";
const COMPARISON_PREFIX = "eurovision-ranker:comparison:";
const FAVORITES_KEY = "eurovision-ranker:favorites";
const ACTIVE_PROFILE_KEY = "eurovision-ranker:active-profile";

export type ActiveProfile = {
  id: string;
  name: string;
  username: string;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function activeProfileId() {
  return readJson<ActiveProfile>(ACTIVE_PROFILE_KEY)?.id;
}

function rankingStorageKey(key: string) {
  return `${RANKING_PREFIX}${key}`;
}

function comparisonStorageKey(key: string) {
  return `${COMPARISON_PREFIX}${key}`;
}

async function rpc<T>(name: string, args: Record<string, unknown>) {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.");
  }

  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const rawError = [error.code, error.message, error.details].filter(Boolean).join(" | ");
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
      throw new Error(`Supabase setup is missing tables. Run the latest supabase/schema.sql in the Supabase SQL Editor. Supabase said: ${rawError}`);
    }

    throw new Error(rawError || error.message);
  }
  return data as T;
}

async function copyGuestDataToProfile() {
  if (!activeProfileId()) return;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(RANKING_PREFIX)) continue;

    const value = readJson<RankingState>(key);
    if (value) await saveRanking(key.slice(RANKING_PREFIX.length), value.songIds);
  }

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(COMPARISON_PREFIX)) continue;

    const value = readJson<ComparisonState>(key);
    if (value) await saveComparison(value);
  }

  const favorites = readJson<string[]>(FAVORITES_KEY);
  if (favorites) await saveFavorites(new Set(favorites));
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

export async function loadFavorites() {
  const profileId = activeProfileId();
  if (!profileId) return new Set(readJson<string[]>(FAVORITES_KEY) ?? []);

  return new Set(await rpc<string[]>("get_favorites", { p_profile_id: profileId }));
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
    localStorage.setItem(comparisonStorageKey(state.key), JSON.stringify(state));
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

export function validatePassword(password: string) {
  if (password.length < 8 || password.length > 20) return "Password must be 8-20 characters.";
  if (!/[a-z]/.test(password)) return "Password needs at least one lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password needs at least one capital letter.";
  if (!/[0-9]/.test(password)) return "Password needs at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password needs at least one symbol.";
  return "";
}

export function getPasswordRequirements(password: string) {
  return [
    { label: "8-20 characters", met: password.length >= 8 && password.length <= 20 },
    { label: "lowercase letter", met: /[a-z]/.test(password) },
    { label: "capital letter", met: /[A-Z]/.test(password) },
    { label: "number", met: /[0-9]/.test(password) },
    { label: "symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function loadActiveProfile() {
  return readJson<ActiveProfile>(ACTIVE_PROFILE_KEY);
}

export async function signUpProfile(name: string, username: string, password: string) {
  const profile = await rpc<ActiveProfile>("signup_profile", {
    p_name: name,
    p_username: username,
    p_password: password,
  });

  localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
  await copyGuestDataToProfile();
  return profile;
}

export async function loginProfile(username: string, password: string) {
  const profile = await rpc<ActiveProfile>("login_profile", {
    p_username: username,
    p_password: password,
  });

  localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function logoutProfile() {
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
}
