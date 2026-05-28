import { ArrowLeft, RotateCcw, Save, Scale } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ComparisonOverlay from "../components/ComparisonOverlay";
import RankingList from "../components/RankingList";
import { songsByYear } from "../data/years";
import type { Song } from "../types";
import {
  clearRanking,
  loadFavorites,
  loadRanking,
  saveFavorites,
  saveRanking,
} from "../utils/storage";

function orderSongs(songs: Song[], savedIds?: string[]) {
  if (!savedIds?.length) return songs;
  const byId = new Map(songs.map((song) => [song.id, song]));
  const ordered = savedIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const missing = songs.filter((song) => !savedIds.includes(song.id));
  return [...ordered, ...missing];
}

export default function YearPage() {
  const { year = "" } = useParams();
  const navigate = useNavigate();
  const yearData = songsByYear.get(year);
  const rankingKey = `year:${year}`;
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [savedNotice, setSavedNotice] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);

  const initialSongs = useMemo(() => yearData?.songs ?? [], [yearData]);
  const [songs, setSongs] = useState(initialSongs);

  useEffect(() => setSongs(initialSongs), [initialSongs]);

  useEffect(() => {
    let active = true;

    async function loadSavedState() {
      if (!yearData) return;
      const [savedRanking, savedFavorites] = await Promise.all([
        loadRanking(rankingKey),
        loadFavorites(),
      ]);

      if (!active) return;
      setSongs(orderSongs(yearData.songs, savedRanking?.songIds));
      setFavorites(savedFavorites);
    }

    void loadSavedState();
    return () => {
      active = false;
    };
  }, [rankingKey, yearData]);

  if (!yearData) {
    return (
      <main className="pageShell">
        <section className="contentColumn pageHeader">
          <h1>Year not found</h1>
          <Link to="/">Back home</Link>
        </section>
      </main>
    );
  }

  const currentYearData = yearData;

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
    setSongs(currentYearData.songs);
    setSavedNotice("Reset");
    window.setTimeout(() => setSavedNotice(""), 1800);
  }

  return (
    <main
      className="pageShell"
      style={{ "--bg-image": `url(${currentYearData.backgroundImage})` } as CSSProperties}
    >
      <section className="contentColumn">
        <div className="pageHeader">
          <button className="backButton" type="button" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
          <h1>Eurovision Song Contest {currentYearData.year}</h1>
          <p>
            Rank songs from {currentYearData.hostCity}, {currentYearData.country}. Drag rows into your order,
            preview clips, and save the result in this browser.
          </p>
        </div>

        <div className="toolbar">
          <span className="countLine">{songs.length} songs to rank</span>
          <div className="toolbarActions">
            <button className="primaryButton" type="button" onClick={() => setComparisonOpen(true)}>
              <Scale size={17} /> Rank by Comparison
            </button>
            <button className="secondaryButton" type="button" onClick={handleReset}>
              <RotateCcw size={17} /> Reset Ranking
            </button>
            <button className="secondaryButton" type="button" onClick={handleSave}>
              <Save size={17} /> Save Ranking
            </button>
            {savedNotice ? <span className="savedNotice">{savedNotice}</span> : null}
          </div>
        </div>

        <RankingList
          songs={songs}
          onReorder={setSongs}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      </section>
      {comparisonOpen ? (
        <ComparisonOverlay
          songs={songs}
          resetSongs={currentYearData.songs}
          rankingKey={rankingKey}
          onClose={() => setComparisonOpen(false)}
          onRankingUpdate={setSongs}
        />
      ) : null}
    </main>
  );
}
