import { ArrowLeft, RotateCcw, Scale } from "lucide-react";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ComparisonOverlay from "../components/ComparisonOverlay";
import PredictionPanel from "../components/PredictionPanel";
import RankingList from "../components/RankingList";
import { songsByYear } from "../data/years";
import type { Song } from "../types";
import {
  grandFinalWarningKeyForYear,
  getContestStages,
  rankingKeyForStage,
  songsForContestStage,
  type ContestStage,
  type ContestStageKey,
} from "../utils/contestStages";
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
  const ordered = savedIds.flatMap((id) =>
    byId.has(id) ? [byId.get(id)!] : [],
  );
  const missing = songs.filter((song) => !savedIds.includes(song.id));
  return [...ordered, ...missing];
}

export default function YearPage() {
  const { year = "" } = useParams();
  const navigate = useNavigate();
  const yearData = songsByYear.get(year);
  const stages = useMemo(
    () => getContestStages(Number(yearData?.year ?? year)),
    [year, yearData],
  );
  const [activeStageKey, setActiveStageKey] =
    useState<ContestStageKey>("overall");
  const activeStage =
    stages.find((stage) => stage.key === activeStageKey) ?? stages[0];
  const rankingKey = rankingKeyForStage(year, activeStage.key);
  const grandFinalWarningKey = grandFinalWarningKeyForYear(year);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [yearMode, setYearMode] = useState<"rankings" | "predictions">(
    "rankings",
  );
  const [dataError, setDataError] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [pendingStage, setPendingStage] = useState<ContestStage | null>(null);
  const [skipGrandFinalWarning, setSkipGrandFinalWarning] = useState(false);
  const [dontWarnAgain, setDontWarnAgain] = useState(false);
  const localSongOrders = useRef(new Map<string, Song[]>());

  const stageSourceSongs = useMemo(
    () => songsForContestStage(yearData?.songs ?? [], activeStage.key),
    [activeStage.key, yearData],
  );
  const initialSongs = useMemo(() => stageSourceSongs, [stageSourceSongs]);
  const [songs, setSongs] = useState(initialSongs);

  useEffect(() => {
    setSongs(localSongOrders.current.get(rankingKey) ?? initialSongs);
  }, [initialSongs, rankingKey]);

  useEffect(() => {
    setActiveStageKey("overall");
    setPendingStage(null);
    localSongOrders.current.clear();
  }, [year]);

  useEffect(() => {
    setSkipGrandFinalWarning(
      localStorage.getItem(grandFinalWarningKey) === "true",
    );
  }, [grandFinalWarningKey]);

  useEffect(() => {
    let active = true;

    async function loadSavedState() {
      if (!yearData) return;
      try {
        const [savedRanking, savedFavorites] = await Promise.all([
          loadRanking(rankingKey),
          loadFavorites(),
        ]);

        if (!active) return;
        setSongs(
          localSongOrders.current.get(rankingKey) ??
            orderSongs(stageSourceSongs, savedRanking?.songIds),
        );
        setFavorites(savedFavorites);
        setDataError("");
      } catch (error) {
        if (!active) return;
        setDataError(
          error instanceof Error
            ? error.message
            : "Could not load saved ranking.",
        );
      }
    }

    void loadSavedState();
    return () => {
      active = false;
    };
  }, [rankingKey, stageSourceSongs, yearData]);

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

  function activateStage(stage: ContestStage) {
    setDataError("");
    setActiveStageKey(stage.key);
  }

  function handleStageSelect(stage: ContestStage) {
    if (stage.key === activeStage.key) return;
    if (stage.spoilerWarning && !skipGrandFinalWarning) {
      setPendingStage(stage);
      return;
    }
    activateStage(stage);
  }

  function continueToPendingStage() {
    if (!pendingStage) return;
    if (dontWarnAgain) {
      localStorage.setItem(grandFinalWarningKey, "true");
      setSkipGrandFinalWarning(true);
    }
    activateStage(pendingStage);
    setPendingStage(null);
    setDontWarnAgain(false);
  }

  function toggleFavorite(songId: string) {
    const next = new Set(favorites);
    if (next.has(songId)) next.delete(songId);
    else next.add(songId);
    setFavorites(next);
    void saveFavorites(next).catch((error: unknown) => {
      setDataError(
        error instanceof Error ? error.message : "Could not save favorite.",
      );
    });
  }

  async function autosaveRanking(nextSongs: Song[]) {
    localSongOrders.current.set(rankingKey, nextSongs);
    setSongs(nextSongs);
    try {
      await saveRanking(
        rankingKey,
        nextSongs.map((song) => song.id),
      );
      setDataError("");
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : "Could not autosave ranking.",
      );
    }
  }

  async function handleReset() {
    try {
      await clearRanking(rankingKey);
      localSongOrders.current.set(rankingKey, stageSourceSongs);
      setSongs(stageSourceSongs);
      setDataError("");
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : "Could not reset ranking.",
      );
    }
  }

  return (
    <main
      className="pageShell"
      style={
        {
          "--bg-image": `url(${currentYearData.backgroundImage})`,
        } as CSSProperties
      }
    >
      <section className="contentColumn">
        <div className={pendingStage ? "stageContent blurred" : "stageContent"}>
          <div className="pageHeader">
            <button
              className="backButton"
              type="button"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <h1>Eurovision Song Contest {currentYearData.year}</h1>
            <p>
              Rank songs from {currentYearData.hostCity},{" "}
              {currentYearData.country}. Drag rows into your order, preview
              clips, and save the result in this browser.
            </p>
          </div>

          <nav
            className="yearModeTabs"
            aria-label={`${currentYearData.year} sections`}
          >
            <button
              className={yearMode === "rankings" ? "selected" : ""}
              type="button"
              onClick={() => setYearMode("rankings")}
            >
              Rankings
            </button>
            {Number(year) >= 2004 ? (
              <button
                className={yearMode === "predictions" ? "selected" : ""}
                type="button"
                onClick={() => setYearMode("predictions")}
              >
                Predictions
              </button>
            ) : null}
          </nav>

          {yearMode === "rankings" ? (
            <>
              <nav
                className="stageTabs"
                aria-label={`${currentYearData.year} ranking stages`}
              >
                {stages.map((stage) => (
                  <button
                    key={stage.key}
                    className={stage.key === activeStage.key ? "selected" : ""}
                    type="button"
                    aria-current={
                      stage.key === activeStage.key ? "page" : undefined
                    }
                    onClick={() => handleStageSelect(stage)}
                  >
                    {stage.label}
                  </button>
                ))}
              </nav>

              <div className="toolbar">
                <span className="countLine">
                  {activeStage.label} - {songs.length} songs to rank
                </span>
                <div className="toolbarActions">
                  <button
                    className="primaryButton"
                    type="button"
                    onClick={() => setComparisonOpen(true)}
                  >
                    <Scale size={17} /> Rank by Comparison
                  </button>
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={handleReset}
                  >
                    <RotateCcw size={17} /> Reset Ranking
                  </button>
                </div>
              </div>
              {dataError ? <div className="dataError">{dataError}</div> : null}

              <RankingList
                songs={songs}
                onReorder={(nextSongs) => {
                  void autosaveRanking(nextSongs);
                }}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
            </>
          ) : (
            <PredictionPanel year={year} songs={currentYearData.songs} />
          )}
        </div>
      </section>
      {pendingStage ? (
        <div
          className="spoilerModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="spoiler-title"
        >
          <div className="spoilerBackdrop" />
          <section className="spoilerDialog">
            <h2 id="spoiler-title">Grand Final spoilers ahead</h2>
            <p>
              Opening the Grand Final ranking may reveal which entries qualified
              and which did not. Continue only if you are ready to see the
              finalist dataset.
            </p>
            <label className="spoilerCheckbox">
              <input
                type="checkbox"
                checked={dontWarnAgain}
                onChange={(event) => setDontWarnAgain(event.target.checked)}
              />
              Don't warn me again
            </label>
            <div className="spoilerActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  setPendingStage(null);
                  setDontWarnAgain(false);
                }}
              >
                Cancel
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={continueToPendingStage}
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {comparisonOpen ? (
        <ComparisonOverlay
          songs={songs}
          resetSongs={stageSourceSongs}
          rankingKey={rankingKey}
          onClose={() => setComparisonOpen(false)}
          onRankingUpdate={(nextSongs) => {
            localSongOrders.current.set(rankingKey, nextSongs);
            setSongs(nextSongs);
          }}
        />
      ) : null}
    </main>
  );
}
