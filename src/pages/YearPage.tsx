import { ArrowLeft, CheckCircle, ListOrdered, RotateCcw } from "lucide-react";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import ComparisonOverlay from "../components/ComparisonOverlay";
import PredictionPanel from "../components/PredictionPanel";
import RankingList from "../components/RankingList";
import RankingSnapshotControls from "../components/RankingSnapshotControls";
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
  clearComparison,
  clearRanking,
  loadComparison,
  loadComparisonStatus,
  loadActiveProfile,
  loadFavorites,
  loadRanking,
  saveFavorites,
  saveRanking,
} from "../utils/storage";
import { comparisonIsComplete } from "../utils/pairing";

const GUEST_SAVE_PROMPT_KEY = "eurovision-ranker:hide-guest-save-prompt";

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
  const [yearMode, setYearMode] = useState<
    "rankings" | "predictions" | "results"
  >("rankings");
  const [resultsStageKey, setResultsStageKey] =
    useState<ContestStageKey | undefined>();
  const [dataError, setDataError] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [hasUnfinishedComparison, setHasUnfinishedComparison] = useState(false);
  const [comparisonStatusRefresh, setComparisonStatusRefresh] = useState(0);
  const [comparisonCompletedAt, setComparisonCompletedAt] = useState("");
  const [pendingStage, setPendingStage] = useState<ContestStage | null>(null);
  const [skipGrandFinalWarning, setSkipGrandFinalWarning] = useState(false);
  const [dontWarnAgain, setDontWarnAgain] = useState(false);
  const [guestSavePromptOpen, setGuestSavePromptOpen] = useState(false);
  const [dontShowGuestSavePrompt, setDontShowGuestSavePrompt] = useState(false);
  const guestSavePromptShown = useRef(false);
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

  useEffect(() => {
    let active = true;
    loadComparison(`${rankingKey}:comparison`)
      .then((saved) => {
        if (active) setHasUnfinishedComparison(Boolean(saved && !comparisonIsComplete(saved)));
      })
      .catch(() => {
        if (active) setHasUnfinishedComparison(false);
      });
    return () => {
      active = false;
    };
  }, [rankingKey, comparisonOpen]);

  useEffect(() => {
    let active = true;
    loadComparisonStatus(rankingKey)
      .then((status) => {
        if (active) setComparisonCompletedAt(status?.completedAt ?? "");
      })
      .catch(() => {
        if (active) setComparisonCompletedAt("");
      });
    return () => {
      active = false;
    };
  }, [rankingKey, comparisonStatusRefresh]);

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

  function shouldShowGuestSavePrompt() {
    if (loadActiveProfile()) return false;
    if (guestSavePromptShown.current) return false;
    return localStorage.getItem(GUEST_SAVE_PROMPT_KEY) !== "true";
  }

  function closeGuestSavePrompt() {
    if (dontShowGuestSavePrompt) {
      localStorage.setItem(GUEST_SAVE_PROMPT_KEY, "true");
    }
    setGuestSavePromptOpen(false);
    setDontShowGuestSavePrompt(false);
  }

  function openAuthFromGuestPrompt(mode: "login" | "signup") {
    if (dontShowGuestSavePrompt) {
      localStorage.setItem(GUEST_SAVE_PROMPT_KEY, "true");
    }
    setGuestSavePromptOpen(false);
    setDontShowGuestSavePrompt(false);
    window.dispatchEvent(new CustomEvent("auth:open", { detail: { mode } }));
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
      if (shouldShowGuestSavePrompt()) {
        guestSavePromptShown.current = true;
        setGuestSavePromptOpen(true);
      }
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

  function requestComparison() {
    if (hasUnfinishedComparison) {
      setResumePromptOpen(true);
      return;
    }
    setComparisonOpen(true);
  }

  async function startComparisonOver() {
    if (
      !window.confirm(
        "Start over and delete the unfinished comparison session for this ranking?",
      )
    ) {
      return;
    }
    try {
      await clearComparison(`${rankingKey}:comparison`);
      setHasUnfinishedComparison(false);
      setResumePromptOpen(false);
      setComparisonOpen(true);
    } catch (error) {
      setDataError(
        error instanceof Error
          ? error.message
          : "Could not clear comparison session.",
      );
    }
  }

  async function songsForExportStage(stage: ContestStage) {
    const stageRankingKey = rankingKeyForStage(year, stage.key);
    const sourceSongs = songsForContestStage(
      currentYearData.songs,
      stage.key,
    );
    const localOrder = localSongOrders.current.get(stageRankingKey);
    if (localOrder) return localOrder;

    const savedRanking = await loadRanking(stageRankingKey);
    return orderSongs(sourceSongs, savedRanking?.songIds);
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
            <Link
              className="backButton"
              to="/"
            >
              <ArrowLeft size={16} /> Back
            </Link>
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
              <>
                <button
                  className={yearMode === "predictions" ? "selected" : ""}
                  type="button"
                  onClick={() => setYearMode("predictions")}
                >
                  Predictions
                </button>
                <button
                  className={yearMode === "results" ? "selected" : ""}
                  type="button"
                  onClick={() => setYearMode("results")}
                >
                  Results
                </button>
              </>
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
                    className={`primaryButton ${
                      comparisonCompletedAt && !hasUnfinishedComparison
                        ? "comparisonCompleteButton"
                        : ""
                    }`}
                    type="button"
                    onClick={requestComparison}
                    title={
                      comparisonCompletedAt && !hasUnfinishedComparison
                        ? `Head-to-Head Ranking completed ${new Date(
                            comparisonCompletedAt,
                          ).toLocaleString()}`
                        : undefined
                    }
                  >
                    <ListOrdered size={17} />{" "}
                    {hasUnfinishedComparison
                      ? "Continue Head-to-Head"
                      : "Rank Head-to-Head"}
                    {comparisonCompletedAt && !hasUnfinishedComparison ? (
                      <CheckCircle size={16} />
                    ) : null}
                  </button>
                  <button
                    className="secondaryButton iconOnlyAction resetAction"
                    type="button"
                    aria-label="Reset"
                    title="Reset"
                    onClick={handleReset}
                  >
                    <RotateCcw size={17} />
                  </button>
                  <RankingSnapshotControls
                    rankingKey={rankingKey}
                    songs={songs}
                    sourceSongs={stageSourceSongs}
                    title={`Eurovision ${currentYearData.year} - ${activeStage.label}`}
                    exportSectionOptions={stages.map((stage) => ({
                      id: stage.key,
                      label: stage.label,
                      getSongs: () => songsForExportStage(stage),
                    }))}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onRestore={(nextSongs) => {
                      localSongOrders.current.set(rankingKey, nextSongs);
                      setSongs(nextSongs);
                    }}
                    onError={setDataError}
                    refreshKey={comparisonStatusRefresh}
                  />
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
          ) : yearMode === "predictions" ? (
            <PredictionPanel
              year={year}
              songs={currentYearData.songs}
              mode="predictions"
              onOpenResults={(stageKey) => {
                setResultsStageKey(stageKey);
                setYearMode("results");
              }}
            />
          ) : (
            <PredictionPanel
              year={year}
              songs={currentYearData.songs}
              mode="results"
              initialStageKey={resultsStageKey}
              onOpenPredictions={(stageKey) => {
                setResultsStageKey(stageKey);
                setYearMode("predictions");
              }}
            />
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
      {guestSavePromptOpen ? (
        <div
          className="guestSaveModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-save-title"
        >
          <div className="guestSaveBackdrop" />
          <section className="guestSaveDialog">
            <h2 id="guest-save-title">Save rankings across devices</h2>
            <p>
              You're currently ranking as a guest. Your changes are saved in
              this browser, but signing in keeps them available if browser data
              is cleared or you switch devices.
            </p>
            <label className="spoilerCheckbox">
              <input
                type="checkbox"
                checked={dontShowGuestSavePrompt}
                onChange={(event) =>
                  setDontShowGuestSavePrompt(event.target.checked)
                }
              />
              Don't show this again
            </label>
            <div className="guestSaveActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={closeGuestSavePrompt}
              >
                No Thanks
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => openAuthFromGuestPrompt("login")}
              >
                Login
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => openAuthFromGuestPrompt("signup")}
              >
                Create Account
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
          onComplete={() => {
            setHasUnfinishedComparison(false);
            setComparisonStatusRefresh((value) => value + 1);
          }}
          onRankingUpdate={(nextSongs) => {
            localSongOrders.current.set(rankingKey, nextSongs);
            setSongs(nextSongs);
          }}
        />
      ) : null}
      {resumePromptOpen ? (
        <div
          className="globalModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-comparison-title"
        >
          <div className="globalModalBackdrop" />
          <section className="globalDialog">
            <h2 id="resume-comparison-title">Resume comparison?</h2>
            <div className="globalDialogBody">
              <p>
                You have an unfinished comparison session for this ranking.
                Would you like to resume where you left off?
              </p>
            </div>
            <div className="globalDialogActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => setResumePromptOpen(false)}
              >
                Cancel
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => void startComparisonOver()}
              >
                Start Over
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => {
                  setResumePromptOpen(false);
                  setComparisonOpen(true);
                }}
              >
                Resume
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
