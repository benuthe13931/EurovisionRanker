import { ArrowLeft, RotateCcw, Save, Scale } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ComparisonOverlay from "../components/ComparisonOverlay";
import RankingList from "../components/RankingList";
import { countriesBySlug } from "../data/years";
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

export default function CountryPage() {
  const { countrySlug = "" } = useParams();
  const navigate = useNavigate();
  const countryData = countriesBySlug.get(countrySlug);
  const rankingKey = `country:${countrySlug}`;
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [savedNotice, setSavedNotice] = useState("");
  const [dataError, setDataError] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const hasLocalRankingChange = useRef(false);

  const initialSongs = useMemo(() => countryData?.songs ?? [], [countryData]);
  const [songs, setSongs] = useState(initialSongs);

  useEffect(() => setSongs(initialSongs), [initialSongs]);

  useEffect(() => {
    let active = true;

    async function loadSavedState() {
      if (!countryData) return;
      try {
        const [savedRanking, savedFavorites] = await Promise.all([
          loadRanking(rankingKey),
          loadFavorites(),
        ]);

        if (!active || hasLocalRankingChange.current) return;
        setSongs(orderSongs(countryData.songs, savedRanking?.songIds));
        setFavorites(savedFavorites);
        setDataError("");
      } catch (error) {
        if (!active) return;
        setDataError(error instanceof Error ? error.message : "Could not load saved ranking.");
      }
    }

    void loadSavedState();
    return () => {
      active = false;
    };
  }, [countryData, rankingKey]);

  if (!countryData) {
    return (
      <main className="pageShell">
        <section className="contentColumn pageHeader">
          <h1>Country not found</h1>
          <Link to="/countries">Back to countries</Link>
        </section>
      </main>
    );
  }

  const currentCountryData = countryData;

  function toggleFavorite(songId: string) {
    const next = new Set(favorites);
    if (next.has(songId)) next.delete(songId);
    else next.add(songId);
    setFavorites(next);
    void saveFavorites(next).catch((error: unknown) => {
      setDataError(error instanceof Error ? error.message : "Could not save favorite.");
    });
  }

  async function handleSave() {
    try {
      hasLocalRankingChange.current = true;
      await saveRanking(rankingKey, songs.map((song) => song.id));
      setDataError("");
      setSavedNotice("Saved");
      window.setTimeout(() => setSavedNotice(""), 1800);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not save ranking.");
    }
  }

  async function handleReset() {
    try {
      await clearRanking(rankingKey);
      hasLocalRankingChange.current = true;
      setSongs(currentCountryData.songs);
      setDataError("");
      setSavedNotice("Reset");
      window.setTimeout(() => setSavedNotice(""), 1800);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not reset ranking.");
    }
  }

  return (
    <main
      className="pageShell"
      style={{ "--bg-image": `url(${currentCountryData.backgroundImage})` } as CSSProperties}
    >
      <section className="contentColumn">
        <div className="pageHeader">
          <button className="backButton" type="button" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
          <p className="eyebrow">
            {currentCountryData.flagEmoji} {currentCountryData.countryCode}
          </p>
          <h1>{currentCountryData.country} Ranking</h1>
          <p>
            Rank every {currentCountryData.country} entry across all loaded years. The row detail shows
            the contest year since this leaderboard is already country-specific.
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
        {dataError ? <div className="dataError">{dataError}</div> : null}

        <RankingList
          songs={songs}
          onReorder={(nextSongs) => {
            hasLocalRankingChange.current = true;
            setSongs(nextSongs);
          }}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          metaMode="year"
        />
      </section>
      {comparisonOpen ? (
        <ComparisonOverlay
          songs={songs}
          resetSongs={currentCountryData.songs}
          rankingKey={rankingKey}
          metaMode="year"
          onClose={() => setComparisonOpen(false)}
          onRankingUpdate={(nextSongs) => {
            hasLocalRankingChange.current = true;
            setSongs(nextSongs);
          }}
        />
      ) : null}
    </main>
  );
}
