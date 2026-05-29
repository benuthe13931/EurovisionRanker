import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ComparisonCard from "../components/ComparisonCard";
import { allSongs, allSongsBackground, songsByYear } from "../data/years";
import type { ComparisonState } from "../types";
import {
  chooseInsertionWinner,
  comparisonIsComplete,
  createComparisonState,
  normalizeComparisonState,
  songsForComparisonState,
} from "../utils/pairing";
import {
  clearComparison,
  loadComparison,
  saveComparison,
  saveRanking,
} from "../utils/storage";

type ComparisonPageProps = {
  allSongsMode?: boolean;
};

export default function ComparisonPage({ allSongsMode = false }: ComparisonPageProps) {
  const { year = "" } = useParams();
  const navigate = useNavigate();
  const yearData = allSongsMode ? null : songsByYear.get(year);
  const songs = allSongsMode ? allSongs : yearData?.songs ?? [];
  const rankingKey = allSongsMode ? "all" : `year:${year}`;
  const comparisonKey = `${rankingKey}:comparison`;
  const backgroundImage = allSongsMode ? allSongsBackground : yearData?.backgroundImage;
  const [state, setState] = useState<ComparisonState>(() =>
    createComparisonState(comparisonKey, songs, "smart"),
  );
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSavedComparison() {
      try {
        const saved = await loadComparison(comparisonKey);
        const next = normalizeComparisonState(saved, comparisonKey, songs, "smart");
        if (active) {
          setState(next);
          setDataError("");
        }
      } catch (error) {
        if (active) setDataError(error instanceof Error ? error.message : "Could not load comparison state.");
      }
    }

    void loadSavedComparison();
    return () => {
      active = false;
    };
  }, [comparisonKey, songs]);

  const currentPair = state.currentPair;
  const pairSongs = currentPair
    ? [songs.find((song) => song.id === currentPair[0]), songs.find((song) => song.id === currentPair[1])]
    : [];
  const isComplete = comparisonIsComplete(state);
  const sortedSongs = useMemo(() => songsForComparisonState(state, songs), [state, songs]);

  if (!allSongsMode && !yearData) {
    return (
      <main className="pageShell">
        <section className="contentColumn pageHeader">
          <h1>Year not found</h1>
          <Link to="/">Back home</Link>
        </section>
      </main>
    );
  }

  function chooseWinner(winnerId: string) {
    if (!currentPair) return;
    const next = chooseInsertionWinner(state, winnerId);
    setState(next);
    void saveComparison(next).catch((error: unknown) => {
      setDataError(error instanceof Error ? error.message : "Could not save comparison state.");
    });
  }

  function resetComparison() {
    void clearComparison(comparisonKey).catch((error: unknown) => {
      setDataError(error instanceof Error ? error.message : "Could not reset comparison state.");
    });
    setState(createComparisonState(comparisonKey, songs, "smart"));
  }

  function applyRanking() {
    void saveRanking(rankingKey, sortedSongs.map((song) => song.id))
      .then(() => clearComparison(comparisonKey))
      .then(() => navigate(allSongsMode ? "/all-songs" : `/year/${year}`))
      .catch((error: unknown) => {
        setDataError(error instanceof Error ? error.message : "Could not apply ranking.");
      });
  }

  return (
    <main
      className="pageShell"
      style={{ "--bg-image": `url(${backgroundImage})` } as CSSProperties}
    >
      <section className="contentColumn">
        <div className="pageHeader compactHeader">
          <button className="backButton" type="button" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
          <h1>{allSongsMode ? "All Songs Comparison" : `Eurovision ${year} Comparison`}</h1>
          <p>
            Choose the entry you prefer. Each song is inserted into your current ranking with a
            deterministic binary search.
          </p>
        </div>

        <div className="comparisonTopbar">
          <div>
            <span className="progressText">
              {Math.min(state.completed, state.targetComparisons)} / ~{state.targetComparisons} comparisons
            </span>
            <div className="progressTrack">
              <span
                style={{
                  width: `${Math.min(100, (state.completed / Math.max(state.targetComparisons, 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
          <button className="secondaryButton" type="button" onClick={resetComparison}>
            <RotateCcw size={16} /> Reset
          </button>
        </div>
        {dataError ? <div className="dataError">{dataError}</div> : null}

        {!isComplete && pairSongs[0] && pairSongs[1] ? (
          <div className="comparisonGrid">
            <ComparisonCard song={pairSongs[0]} onChoose={chooseWinner} />
            <ComparisonCard song={pairSongs[1]} onChoose={chooseWinner} />
          </div>
        ) : (
          <div className="resultsPanel">
            <h2>Comparison ranking ready</h2>
            <p>Apply this exact insertion ranking to your list, or reset to start over.</p>
            <ol className="resultsList">
              {sortedSongs.map((song) => (
                <li key={song.id}>
                  <span>{song.flagEmoji}</span>
                  <strong>{song.title}</strong>
                </li>
              ))}
            </ol>
            <button className="primaryButton" type="button" onClick={applyRanking}>
              <Check size={17} /> Apply to ranking list
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
