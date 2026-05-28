import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ComparisonCard from "../components/ComparisonCard";
import { allSongs, allSongsBackground, songsByYear } from "../data/years";
import type { ComparisonMode, ComparisonState, Song } from "../types";
import { updateElo } from "../utils/elo";
import { createComparisonState, pairKey, pickNextPair } from "../utils/pairing";
import {
  clearComparison,
  loadComparison,
  saveComparison,
  saveRanking,
} from "../utils/storage";

type ComparisonPageProps = {
  allSongsMode?: boolean;
};

function sortByRating(songs: Song[], ratings: Record<string, number>) {
  return [...songs].sort((a, b) => (ratings[b.id] ?? 1500) - (ratings[a.id] ?? 1500));
}

export default function ComparisonPage({ allSongsMode = false }: ComparisonPageProps) {
  const { year = "" } = useParams();
  const navigate = useNavigate();
  const yearData = allSongsMode ? null : songsByYear.get(year);
  const songs = allSongsMode ? allSongs : yearData?.songs ?? [];
  const rankingKey = allSongsMode ? "all" : `year:${year}`;
  const comparisonKey = `${rankingKey}:comparison`;
  const backgroundImage = allSongsMode ? allSongsBackground : yearData?.backgroundImage;
  const [mode, setMode] = useState<ComparisonMode>("smart");
  const [state, setState] = useState<ComparisonState>(() =>
    createComparisonState(comparisonKey, songs, "smart"),
  );
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSavedComparison() {
      try {
        const saved = await loadComparison(comparisonKey);
        const next = saved && saved.mode === mode ? saved : createComparisonState(comparisonKey, songs, mode);
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
  }, [comparisonKey, mode, songs]);

  const currentPair = useMemo(() => pickNextPair(state, songs), [state, songs]);
  const pairSongs = currentPair
    ? [songs.find((song) => song.id === currentPair[0]), songs.find((song) => song.id === currentPair[1])]
    : [];
  const isComplete = state.completed >= state.targetComparisons || !currentPair;
  const sortedSongs = sortByRating(songs, state.ratings);

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
    const [a, b] = currentPair;
    const loserId = winnerId === a ? b : a;
    const result = updateElo(
      state.ratings[winnerId] ?? 1500,
      state.ratings[loserId] ?? 1500,
      1,
    );
    const next: ComparisonState = {
      ...state,
      ratings: {
        ...state.ratings,
        [winnerId]: result.ratingA,
        [loserId]: result.ratingB,
      },
      comparedPairs: [...state.comparedPairs, pairKey(a, b)],
      completed: state.completed + 1,
      updatedAt: new Date().toISOString(),
    };
    setState(next);
    void saveComparison(next).catch((error: unknown) => {
      setDataError(error instanceof Error ? error.message : "Could not save comparison state.");
    });
  }

  function switchMode(nextMode: ComparisonMode) {
    setMode(nextMode);
    const next = createComparisonState(comparisonKey, songs, nextMode);
    setState(next);
    void saveComparison(next).catch((error: unknown) => {
      setDataError(error instanceof Error ? error.message : "Could not save comparison state.");
    });
  }

  function resetComparison() {
    void clearComparison(comparisonKey).catch((error: unknown) => {
      setDataError(error instanceof Error ? error.message : "Could not reset comparison state.");
    });
    const next = createComparisonState(comparisonKey, songs, mode);
    setState(next);
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
            Choose the entry you prefer. Smart mode estimates a ranking with Elo instead of asking
            for every possible pair.
          </p>
        </div>

        <div className="comparisonTopbar">
          <div>
            <span className="progressText">
              {Math.min(state.completed, state.targetComparisons)} / {state.targetComparisons} comparisons
            </span>
            <div className="progressTrack">
              <span
                style={{
                  width: `${Math.min(100, (state.completed / state.targetComparisons) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="segmented">
            <button
              className={mode === "smart" ? "selected" : ""}
              type="button"
              onClick={() => switchMode("smart")}
            >
              Smart
            </button>
            <button
              className={mode === "full" ? "selected" : ""}
              type="button"
              onClick={() => switchMode("full")}
            >
              Full pairwise
            </button>
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
            <p>Apply this Elo estimate to your ranking list, or reset to start over.</p>
            <ol className="resultsList">
              {sortedSongs.map((song) => (
                <li key={song.id}>
                  <span>{song.flagEmoji}</span>
                  <strong>{song.title}</strong>
                  <em>{Math.round(state.ratings[song.id] ?? 1500)}</em>
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
