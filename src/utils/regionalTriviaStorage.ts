import type { ContestRegion } from "../data/years";
import {
  loadLocalTriviaSession as loadLocal, saveLocalTriviaSession as saveLocal,
  loadRemoteTriviaSession as loadRemote, saveRemoteTriviaSession as saveRemote,
  loadActiveProfile,
} from "./storage";

type Session = { settings?: { region?: ContestRegion }; savedAt?: string };
type Envelope = { regionalSessions: Partial<Record<ContestRegion, Session | null>>; savedAt?: string };
function unpack(value: Session | Envelope | null): Envelope["regionalSessions"] {
  if (!value) return {};
  if ("regionalSessions" in value) return value.regionalSessions;
  return { [value.settings?.region ?? "europe"]: value };
}
export function regionalTriviaStorage(region: ContestRegion) {
  function loadLocalTriviaSession<T>() {
    return (unpack(loadLocal<Session | Envelope>())[region] ?? null) as T | null;
  }
  function saveLocalTriviaSession<T>(state: T) {
    const regionalSessions = unpack(loadLocal<Session | Envelope>());
    saveLocal({ regionalSessions: { ...regionalSessions, [region]: state }, savedAt: new Date().toISOString() });
    return state;
  }
  async function loadRemoteTriviaSession<T>() {
    return (unpack(await loadRemote<Session | Envelope>())[region] ?? null) as T | null;
  }
  async function saveRemoteTriviaSession<T>(state: T) {
    if (!loadActiveProfile()) return;
    const regionalSessions = unpack(await loadRemote<Session | Envelope>());
    await saveRemote({ regionalSessions: { ...regionalSessions, [region]: state }, savedAt: new Date().toISOString() });
  }
  async function getTriviaSessionMetadata() {
    const session = await loadRemoteTriviaSession<Session>();
    return { hasSession: Boolean(session), savedAt: session?.savedAt ?? null };
  }
  async function clearTriviaSession() {
    saveLocalTriviaSession(null);
    await saveRemoteTriviaSession(null);
  }
  return { loadLocalTriviaSession, saveLocalTriviaSession, loadRemoteTriviaSession, saveRemoteTriviaSession, getTriviaSessionMetadata, clearTriviaSession };
}
