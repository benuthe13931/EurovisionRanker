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
import RankingList from "../components/RankingList";
import RankingSnapshotControls from "../components/RankingSnapshotControls";
import { countriesBySlug } from "../data/years";
import type { Song } from "../types";
import {
  clearComparison,
  clearRanking,
  loadComparison,
  loadComparisonStatus,
  loadFavorites,
  loadRanking,
  saveFavorites,
  saveRanking,
} from "../utils/storage";
import { comparisonIsComplete } from "../utils/pairing";

function orderSongs(songs: Song[], savedIds?: string[]) {
  if (!savedIds?.length) return songs;
  const byId = new Map(songs.map((song) => [song.id, song]));
  const ordered = savedIds.flatMap((id) =>
    byId.has(id) ? [byId.get(id)!] : [],
  );
  const missing = songs.filter((song) => !savedIds.includes(song.id));
  return [...ordered, ...missing];
}

export default function CountryPage() {
  const { countrySlug = "" } = useParams();
  const countryData = countriesBySlug.get(countrySlug);
  const rankingKey = `country:${countrySlug}`;
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [dataError, setDataError] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [hasUnfinishedComparison, setHasUnfinishedComparison] = useState(false);
  const [comparisonStatusRefresh, setComparisonStatusRefresh] = useState(0);
  const [comparisonCompletedAt, setComparisonCompletedAt] = useState("");
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
  }, [countryData, rankingKey]);

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
      setDataError(
        error instanceof Error ? error.message : "Could not save favorite.",
      );
    });
  }

  async function autosaveRanking(nextSongs: Song[]) {
    hasLocalRankingChange.current = true;
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
      hasLocalRankingChange.current = true;
      setSongs(currentCountryData.songs);
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

  return (
    <main
      className="pageShell"
      style={
        {
          "--bg-image": `url(${currentCountryData.backgroundImage})`,
        } as CSSProperties
      }
    >
      <section className="contentColumn">
        <div className="pageHeader">
          <Link
            className="backButton"
            to="/countries"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <h1>{currentCountryData.country} Ranking</h1>
          <p>
            Rank every {currentCountryData.country} entry across all loaded
            years. The row detail shows the contest year since this leaderboard
            is already country-specific.
          </p>
        </div>

        <div className="toolbar">
          <span className="countLine">{songs.length} songs to rank</span>
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
              sourceSongs={currentCountryData.songs}
              title={`${currentCountryData.country} Ranking`}
              favorites={favorites}
              metaMode="year"
              onToggleFavorite={toggleFavorite}
              onRestore={(nextSongs) => {
                hasLocalRankingChange.current = true;
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
          onComplete={() => {
            setHasUnfinishedComparison(false);
            setComparisonStatusRefresh((value) => value + 1);
          }}
          onRankingUpdate={(nextSongs) => {
            hasLocalRankingChange.current = true;
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
