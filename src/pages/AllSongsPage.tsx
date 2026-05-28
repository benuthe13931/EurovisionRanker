import { RotateCcw, Save, Scale } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import ComparisonOverlay from "../components/ComparisonOverlay";
import RankingList from "../components/RankingList";
import { allSongs, allSongsBackground } from "../data/years";
import type { Song } from "../types";
import {
  clearRanking,
  loadFavorites,
  loadRanking,
  saveFavorites,
  saveRanking,
} from "../utils/storage";

type AllSongsPageProps = {
  favoritesOnly?: boolean;
};

function orderSongs(songs: Song[], savedIds?: string[]) {
  if (!savedIds?.length) return songs;
  const byId = new Map(songs.map((song) => [song.id, song]));
  const ordered = savedIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const missing = songs.filter((song) => !savedIds.includes(song.id));
  return [...ordered, ...missing];
}

export default function AllSongsPage({ favoritesOnly = false }: AllSongsPageProps) {
  const rankingKey = favoritesOnly ? "favorites" : "all";
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const sourceSongs = useMemo(
    () => (favoritesOnly ? allSongs.filter((song) => favorites.has(song.id)) : allSongs),
    [favorites, favoritesOnly],
  );
  const initialSongs = useMemo(() => sourceSongs, [sourceSongs]);
  const [songs, setSongs] = useState(initialSongs);
  const [savedNotice, setSavedNotice] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);

  useEffect(() => setSongs(initialSongs), [initialSongs]);

  useEffect(() => {
    let active = true;

    async function loadSavedState() {
      const savedFavorites = await loadFavorites();
      if (!active) return;
      setFavorites(savedFavorites);
    }

    void loadSavedState();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSavedRanking() {
      const savedRanking = await loadRanking(rankingKey);
      if (!active) return;
      setSongs(orderSongs(sourceSongs, savedRanking?.songIds));
    }

    void loadSavedRanking();
    return () => {
      active = false;
    };
  }, [rankingKey, sourceSongs]);

  function toggleFavorite(songId: string) {
    const next = new Set(favorites);
    if (next.has(songId)) next.delete(songId);
    else next.add(songId);
    setFavorites(next);
    void saveFavorites(next);
  }

  async function handleSave() {
    await saveRanking(rankingKey, songs.map((song) => song.id));
    setSavedNotice("Saved");
    window.setTimeout(() => setSavedNotice(""), 1800);
  }

  async function handleReset() {
    await clearRanking(rankingKey);
    setSongs(sourceSongs);
    setSavedNotice("Reset");
    window.setTimeout(() => setSavedNotice(""), 1800);
  }

  return (
    <main
      className="pageShell"
      style={{ "--bg-image": `url(${allSongsBackground})` } as CSSProperties}
    >
      <section className="contentColumn">
        <div className="pageHeader">
          <p className="eyebrow">{favoritesOnly ? "Saved favorites" : "Combined leaderboard"}</p>
          <h1>{favoritesOnly ? "Favorite Songs" : "All Songs Ranking"}</h1>
          <p>
            {favoritesOnly
              ? "Your favorited entries in one compact ranking list."
              : "Every song from every JSON year file appears here automatically."}
          </p>
        </div>

        <div className="toolbar">
          <span className="countLine">{songs.length} songs to rank</span>
          <div className="toolbarActions">
            {!favoritesOnly ? (
              <button className="primaryButton" type="button" onClick={() => setComparisonOpen(true)}>
                <Scale size={17} /> Rank by Comparison
              </button>
            ) : null}
            <button className="secondaryButton" type="button" onClick={handleReset}>
              <RotateCcw size={17} /> Reset Ranking
            </button>
            <button className="secondaryButton" type="button" onClick={handleSave}>
              <Save size={17} /> Save Ranking
            </button>
            {savedNotice ? <span className="savedNotice">{savedNotice}</span> : null}
          </div>
        </div>

        {songs.length ? (
          <RankingList
            songs={songs}
            onReorder={setSongs}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            showYear
          />
        ) : (
          <div className="emptyState">No favorite songs yet.</div>
        )}
      </section>
      {comparisonOpen ? (
        <ComparisonOverlay
          songs={songs}
          resetSongs={sourceSongs}
          rankingKey={rankingKey}
          onClose={() => setComparisonOpen(false)}
          onRankingUpdate={setSongs}
        />
      ) : null}
    </main>
  );
}
