import { RotateCcw, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ComparisonState, Song } from "../types";
import { updateElo } from "../utils/elo";
import { createComparisonState, pairKey, pickNextPair } from "../utils/pairing";
import {
  clearComparison,
  clearRanking,
  loadComparison,
  saveComparison,
  saveRanking,
} from "../utils/storage";
import AudioButton from "./AudioButton";
import { useAudio } from "./AudioProvider";
import VideoPreview from "./VideoPreview";

type ComparisonOverlayProps = {
  songs: Song[];
  resetSongs: Song[];
  rankingKey: string;
  onClose: () => void;
  onRankingUpdate: (songs: Song[]) => void;
};

function sortByRating(songs: Song[], ratings: Record<string, number>) {
  return [...songs].sort((a, b) => (ratings[b.id] ?? 1500) - (ratings[a.id] ?? 1500));
}

function FlagBadge({ song }: { song: Song }) {
  return (
    <span className="compareFlag">
      <img
        src={song.flagImageUrl ?? `https://flagcdn.com/w80/${song.countryCode.toLowerCase()}.png`}
        alt=""
      />
    </span>
  );
}

function OverlayCard({
  badge,
  song,
  onPick,
}: {
  badge: "A" | "B";
  song: Song;
  onPick: () => void;
}) {
  const { activeSongId, activePreviewMode, setStatusForSong, stopAudio } = useAudio();
  const isActiveInline = activeSongId === song.id && activePreviewMode === "inline";

  return (
    <section
      className="overlayCompareCard"
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPick();
        }
      }}
    >
      <div className="compareCardTop">
        <FlagBadge song={song} />
        <span className="choiceBadge">{badge}</span>
      </div>
      <div
        className={`compareMedia ${isActiveInline ? "activePreview" : ""}`}
        onClick={(event) => {
          if (isActiveInline) event.stopPropagation();
        }}
        onPointerDown={(event) => {
          if (isActiveInline) event.stopPropagation();
        }}
      >
        {isActiveInline && song.previewVideoUrl ? (
          <>
            <VideoPreview
              url={song.previewVideoUrl}
              title={`${song.artist} - ${song.title}`}
              onReady={() => setStatusForSong(song.id, "playing")}
              onEnded={() => stopAudio()}
              onError={() => {
                setStatusForSong(song.id, "error");
                stopAudio();
              }}
            />
            <div className="compareMediaShade" />
          </>
        ) : (
          <>
            <img src={song.imageUrl} alt="" loading="lazy" />
            <div className="compareMediaShade" />
          </>
        )}
      </div>
      <div className="compareCardBody">
        <div>
          <h2>{song.title}</h2>
          <p>{song.artist}</p>
          <span>{song.country}</span>
        </div>
        <div className="compareIconRow" onClick={(event) => event.stopPropagation()}>
          <AudioButton songId={song.id} url={song.previewVideoUrl ?? ""} mode="inline" />
        </div>
        <button
          className="pickButton"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPick();
          }}
        >
          Pick this song
        </button>
      </div>
    </section>
  );
}

export default function ComparisonOverlay({
  songs,
  resetSongs,
  rankingKey,
  onClose,
  onRankingUpdate,
}: ComparisonOverlayProps) {
  const { stopAudio } = useAudio();
  const comparisonKey = `${rankingKey}:comparison`;
  const [state, setState] = useState<ComparisonState>(() =>
    createComparisonState(comparisonKey, songs, "smart"),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dataError, setDataError] = useState("");
  const rankingItemRefs = useRef(new Map<string, HTMLLIElement>());
  const previousRankingPositions = useRef(new Map<string, number>());

  useEffect(() => {
    let active = true;

    async function loadSavedComparison() {
      try {
        const saved = await loadComparison(comparisonKey);
        if (!active) return;
        setState(saved ?? createComparisonState(comparisonKey, songs, "smart"));
        setDataError("");
      } catch (error) {
        if (!active) return;
        setDataError(error instanceof Error ? error.message : "Could not load comparison state.");
      }
    }

    void loadSavedComparison();
    return () => {
      active = false;
    };
  }, [comparisonKey, songs]);

  const currentPair = useMemo(() => pickNextPair(state, songs), [state, songs]);
  const pairSongs = currentPair
    ? [
        songs.find((song) => song.id === currentPair[0]),
        songs.find((song) => song.id === currentPair[1]),
      ]
    : [];
  const sortedSongs = useMemo(() => sortByRating(songs, state.ratings), [songs, state.ratings]);
  const progress = Math.min(state.completed, state.targetComparisons);
  const progressPercent = Math.min(100, (progress / state.targetComparisons) * 100);

  useEffect(() => {
    document.body.classList.add("comparisonOpen");
    return () => document.body.classList.remove("comparisonOpen");
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && pairSongs[0]) chooseWinner(pairSongs[0].id);
      if (event.key === "ArrowRight" && pairSongs[1]) chooseWinner(pairSongs[1].id);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useLayoutEffect(() => {
    const nextPositions = new Map<string, number>();

    sortedSongs.forEach((song) => {
      const node = rankingItemRefs.current.get(song.id);
      if (!node) return;

      const top = node.getBoundingClientRect().top;
      const previousTop = previousRankingPositions.current.get(song.id);
      nextPositions.set(song.id, top);

      if (previousTop === undefined) return;
      const delta = previousTop - top;
      if (Math.abs(delta) < 1) return;

      node.animate(
        [
          { transform: `translateY(${delta}px)`, zIndex: 2 },
          { transform: "translateY(0)", zIndex: 2 },
        ],
        {
          duration: 260,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        },
      );
    });

    previousRankingPositions.current = nextPositions;
  }, [sortedSongs]);

  function chooseWinner(winnerId: string) {
    if (!currentPair) return;

    stopAudio();

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
    const nextRanking = sortByRating(songs, next.ratings);

    setState(next);
    void saveComparison(next).catch((error: unknown) => {
      setDataError(error instanceof Error ? error.message : "Could not save comparison state.");
    });
    void saveRanking(rankingKey, nextRanking.map((song) => song.id)).catch((error: unknown) => {
      setDataError(error instanceof Error ? error.message : "Could not save ranking.");
    });
    onRankingUpdate(nextRanking);
  }

  function resetComparisonAndRanking() {
    const next = createComparisonState(comparisonKey, resetSongs, "smart");
    void clearComparison(comparisonKey).catch((error: unknown) => {
      setDataError(error instanceof Error ? error.message : "Could not clear comparison state.");
    });
    void clearRanking(rankingKey).catch((error: unknown) => {
      setDataError(error instanceof Error ? error.message : "Could not clear ranking.");
    });
    previousRankingPositions.current.clear();
    setState(next);
    onRankingUpdate(resetSongs);
  }

  const isComplete = !currentPair || progress >= state.targetComparisons;
  const highlightedIds = new Set(currentPair ?? []);

  return createPortal(
    <div className="comparisonOverlay" role="dialog" aria-modal="true">
      <div className="overlayBackdrop" />
      <div className="comparisonLayer">
        <header className="overlayHeader">
          <div className="overlayTitle">
            <h1>Rank by Comparison</h1>
            <p>Use ← or → or click Pick. Result applied to your drag-and-drop list.</p>
          </div>
          <div className="overlayProgress" aria-label="Comparison progress">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="overlayHeaderActions">
            <span className="overlayProgressText">
              {progress} / ~{state.targetComparisons} comparisons
            </span>
            <button
              className="overlayReset"
              type="button"
              onClick={resetComparisonAndRanking}
              title="Reset comparison and ranking"
            >
              <RotateCcw size={15} /> Reset
            </button>
            <button className="overlayClose" type="button" onClick={onClose} aria-label="Close comparison">
              <X size={18} />
            </button>
          </div>
          {dataError ? <div className="overlayError">{dataError}</div> : null}
        </header>

        <button className="rankingDrawerButton" type="button" onClick={() => setSidebarOpen(true)}>
          Current Ranking
        </button>

        <main className="overlayMain">
          <div className="compareStage">
            {!isComplete && pairSongs[0] && pairSongs[1] ? (
              <>
                <OverlayCard badge="A" song={pairSongs[0]} onPick={() => chooseWinner(pairSongs[0]!.id)} />
                <div className="versusDivider">
                  <span>VS</span>
                </div>
                <OverlayCard badge="B" song={pairSongs[1]} onPick={() => chooseWinner(pairSongs[1]!.id)} />
              </>
            ) : (
              <section className="comparisonComplete">
                <h2>Comparison ranking complete</h2>
                <p>Your drag-and-drop list has been updated with the latest Elo order.</p>
                <button className="pickButton" type="button" onClick={onClose}>
                  Back to ranking
                </button>
              </section>
            )}
          </div>

          <aside className={`currentRankingPanel ${sidebarOpen ? "open" : ""}`}>
            <div className="rankingPanelHeader">
              <div>
                <h2>Current Ranking</h2>
                <p>Updates after each pick</p>
              </div>
              <button className="overlayClose mobileOnly" type="button" onClick={() => setSidebarOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <ol className="liveRankingList">
              {sortedSongs.map((song, index) => (
                <li
                  className={highlightedIds.has(song.id) ? "comparing" : ""}
                  key={song.id}
                  ref={(node) => {
                    if (node) rankingItemRefs.current.set(song.id, node);
                    else rankingItemRefs.current.delete(song.id);
                  }}
                >
                  <span className="liveRank">{index + 1}</span>
                  <FlagBadge song={song} />
                  <div>
                    <strong>{song.title}</strong>
                    <p>{song.artist}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </main>
      </div>
    </div>,
    document.body,
  );
}
