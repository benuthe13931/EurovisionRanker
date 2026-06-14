import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, LockKeyhole, RotateCcw, X } from "lucide-react";
import {
  type CSSProperties,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { resultsByYear } from "../data/results";
import type { ContestStage, ContestStageKey } from "../utils/contestStages";
import {
  isAutoQualifier,
  isOfficialQualifier,
  predictionKeyForStage,
  predictionStagesForYear,
  songsForContestStage,
} from "../utils/contestStages";
import {
  clearPrediction,
  loadPrediction,
  savePrediction,
} from "../utils/storage";
import type {
  PredictionState,
  ResultCountryInput,
  Song,
  YearResultData,
} from "../types";
import FlagEmoji from "./FlagEmoji";

type PredictionPanelProps = {
  year: string;
  songs: Song[];
};

type ResultDelegation = {
  id: string;
  country: string;
  countryCode?: string;
  flagEmoji?: string;
  flagImageUrl?: string;
  result: ResultCountryInput;
};

type FinalistResult = Song & {
  result: ResultCountryInput;
  actualPlacement: number;
};

type AwardAnimation = {
  songId: string;
  points: number;
  delay: number;
};

type JuryVote = {
  country: string;
  points: number;
};

type EurovisionNightPhase =
  | "ready"
  | "jury"
  | "jury-complete"
  | "televote-intro"
  | "televote"
  | "winner";

type ScoreboardSnapshot = Record<string, number>;
type FinalsRevealProgress = NonNullable<PredictionState["finalsRevealProgress"]>;

type VideoSyncState =
  | {
      kind: "jury";
      twelvePointVote?: JuryVote;
      twelveRecipientId?: string;
      twelvePointTimestamp?: number;
      delegationEndTime?: number;
      lowerAwards: AwardAnimation[];
      lowerVotes: JuryVote[];
      firedLowerAwards: boolean;
      firedTwelve: boolean;
      firedEnd: boolean;
      finishOnVideoEnd?: boolean;
    }
  | {
      kind: "televote";
      firedSongIds: Set<string>;
      firedEnd: boolean;
      endTimestamp?: number;
      useAssetTimestamps?: boolean;
    };

type YouTubePlayer = {
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
};

type ActiveResultVideo = {
  title: string;
  url: string;
  source: "asset" | "youtube";
  start?: number;
  end?: number;
  key: string;
  syncTwelvePointTimestamp?: number;
  syncDelegationEndTime?: number;
  syncTelevoteEndTimestamp?: number;
  fallback?: Omit<ActiveResultVideo, "fallback">;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: { target: YouTubePlayer }) => void;
        onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
      };
    },
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const PREDICTION_SIZE = 10;
const FLYING_DURATION_MS = 1650;
const INSTANT_REVEAL_STEP_MS = 120;
const INSTANT_REVEAL_SETTLE_MS = 900;
const RESULTS_VIDEO_LEAD_IN_MS = 1000;
const YOUTUBE_PLAYER_PLAYING = 1;
const RESULTS_VIDEO_PREROLL_MS = 500;
const JURY_AWARD_STAGGER_MS = 100;
const JURY_AWARD_MERGE_PAUSE_MS = 2500;
const JURY_AWARD_MERGE_STAGGER_MS = 200;
const JURY_AWARD_REMOVE_AFTER_MERGE_MS = 300;
const JURY_SCORE_APPLY_MS = 9000;
const TWELVE_POINT_HOLD_MS = 1000;
const TWELVE_POINT_FLIGHT_MS = 2400;
const TELEVOTE_REVEAL_GROW_MS = 2600;
const TELEVOTE_REVEAL_HOLD_MS = 1000;
const TELEVOTE_REVEAL_FLIGHT_MS = 900;
const SCORE_RESHUFFLE_MS = 4200;

function emptyPredictionState(key: string): PredictionState {
  return {
    key,
    selectedSongIds: [],
    revealedSongIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function orderedQualifiers(qualifiers: Song[]) {
  const allHaveAnnouncementPosition = qualifiers.every(
    (song) =>
      typeof song.qualifiedAnnouncedPosition === "number" &&
      song.qualifiedAnnouncedPosition > 0,
  );

  if (allHaveAnnouncementPosition) {
    return [...qualifiers].sort(
      (a, b) =>
        (a.qualifiedAnnouncedPosition ?? 0) -
        (b.qualifiedAnnouncedPosition ?? 0),
    );
  }

  return [...qualifiers].sort(() => Math.random() - 0.5);
}

function ordinal(value: number) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function countryKey(country: string) {
  return country.trim().toLocaleLowerCase();
}

function assetSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scoreSort(
  a: FinalistResult,
  b: FinalistResult,
  scores: ScoreboardSnapshot,
) {
  const scoreDiff = (scores[b.id] ?? 0) - (scores[a.id] ?? 0);
  if (scoreDiff !== 0) return scoreDiff;
  return a.actualPlacement - b.actualPlacement;
}

function initialScores(songs: FinalistResult[]) {
  return Object.fromEntries(songs.map((song) => [song.id, 0]));
}

function juryScoreSnapshot(songs: FinalistResult[]) {
  return Object.fromEntries(
    songs.map((song) => [song.id, song.result.juryPoints ?? 0]),
  );
}

function totalScoreSnapshot(songs: FinalistResult[]) {
  return Object.fromEntries(
    songs.map((song) => [
      song.id,
      song.result.totalPoints ??
        (song.result.juryPoints ?? 0) + (song.result.televotePoints ?? 0),
    ]),
  );
}

function hasTelevoting(songs: FinalistResult[]) {
  return songs.some((song) => (song.result.televotePoints ?? 0) > 0);
}

function votingDelegations(
  songs: ResultDelegation[],
  juryAnnouncementOrder?: string[],
) {
  const orderByCountry = new Map(
    (juryAnnouncementOrder ?? []).map((country, index) => [
      countryKey(country),
      index,
    ]),
  );

  return songs
    .filter((song) =>
      song.result.jury?.votesAwarded?.some((vote) => vote.points > 0),
    )
    .sort((a, b) => {
      const aOrder = orderByCountry.get(countryKey(a.country));
      const bOrder = orderByCountry.get(countryKey(b.country));
      if (typeof aOrder === "number" && typeof bOrder === "number") {
        return aOrder - bOrder;
      }
      if (typeof aOrder === "number") return -1;
      if (typeof bOrder === "number") return 1;
      return a.country.localeCompare(b.country);
    });
}

function juryVotesForDisplay(delegation?: ResultDelegation, hideTwelve = false) {
  return [...(delegation?.result.jury?.votesAwarded ?? [])]
    .filter((vote) => vote.points > 0 && (!hideTwelve || vote.points !== 12))
    .sort((a, b) => b.points - a.points);
}

function juryVotesForCascade(delegation?: ResultDelegation) {
  return [...(delegation?.result.jury?.votesAwarded ?? [])]
    .filter((vote) => vote.points > 0)
    .sort((a, b) => a.points - b.points);
}

function televoteOrder(songs: FinalistResult[]) {
  return [...songs]
    .filter((song) => typeof song.result.televotePoints === "number")
    .sort((a, b) => {
      const juryDiff = (a.result.juryPoints ?? 0) - (b.result.juryPoints ?? 0);
      if (juryDiff !== 0) return juryDiff;
      return b.actualPlacement - a.actualPlacement;
    });
}

function timestampSeconds(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return value;
}

let youtubeApiPromise: Promise<YouTubeApi> | undefined;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT) resolve(window.YT);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

function youtubeVideoId(url: string) {
  const idMatch =
    url.match(/[?&]v=([^&]+)/) ??
    url.match(/youtu\.be\/([^?&]+)/) ??
    url.match(/embed\/([^?&]+)/);
  return idMatch?.[1];
}

function juryAssetVideoUrl(year: number, country: string) {
  return `/assets/juryvotes/${year}-${assetSlug(country)}.webm`;
}

function televoteAssetVideoUrl(year: number) {
  return `/assets/televote/${year}-televote.webm`;
}

function hasJuryAssetTimestamps(delegation?: ResultDelegation) {
  const jury = delegation?.result.jury;
  return Boolean(
    typeof timestampSeconds(jury?.assetsTwelvePointAnnouncementStartTime) ===
      "number" &&
      typeof timestampSeconds(jury?.assetsTwelvePointTimestamp) === "number",
  );
}

function hasJuryAssetVideo(
  year: number | undefined,
  country: string | undefined,
  delegation?: ResultDelegation,
) {
  return Boolean(year && country && hasJuryAssetTimestamps(delegation));
}

function hasJuryVideo(
  delegation?: ResultDelegation,
  resultData?: YearResultData,
  juryVideoSegment: NonNullable<PredictionState["juryVideoSegment"]> = "full-call",
) {
  const jury = delegation?.result.jury;
  if (hasJuryAssetVideo(resultData?.year, delegation?.country, delegation)) {
    return true;
  }

  const startTime =
    juryVideoSegment === "twelve-point"
      ? jury?.twelvePointAnnouncementStartTime
      : jury?.delegationStartTime;

  return Boolean(
    resultData?.livestreamUrl &&
    typeof timestampSeconds(startTime) === "number" &&
    typeof timestampSeconds(jury?.delegationEndTime) === "number",
  );
}

function hasTelevoteVideo(resultData?: YearResultData) {
  return Boolean(
    resultData?.livestreamUrl &&
    typeof timestampSeconds(resultData.televote?.beginTimestamp) === "number" &&
    typeof timestampSeconds(resultData.televote?.endTimestamp) === "number",
  );
}

function placementMetrics(
  predictedIds: string[],
  officialSongs: FinalistResult[],
  revealedIds = officialSongs.map((song) => song.id),
) {
  const predictedPlaceById = new Map(
    predictedIds.map((songId, index) => [songId, index + 1]),
  );
  const officialById = new Map(officialSongs.map((song) => [song.id, song]));
  const revealedSongs = revealedIds
    .map((songId) => officialById.get(songId))
    .filter((song): song is FinalistResult => Boolean(song));
  const diffs = revealedSongs
    .map((song) => {
      const predictedPlace = predictedPlaceById.get(song.id);
      if (!predictedPlace) return undefined;
      return Math.abs(predictedPlace - song.actualPlacement);
    })
    .filter((value): value is number => typeof value === "number");
  const averageError =
    diffs.length > 0
      ? diffs.reduce((total, value) => total + value, 0) / diffs.length
      : 0;
  const predictedTop5 = new Set(predictedIds.slice(0, 5));
  const predictedTop10 = new Set(predictedIds.slice(0, 10));
  const revealedTop5 = revealedSongs.filter(
    (song) => song.actualPlacement <= 5,
  );
  const revealedTop10 = revealedSongs.filter(
    (song) => song.actualPlacement <= 10,
  );

  return {
    exact: diffs.filter((diff) => diff === 0).length,
    averageError,
    currentAccuracy:
      diffs.length > 0
        ? Math.round(
            (diffs.filter((diff) => diff === 0).length / diffs.length) * 100,
          )
        : 0,
    top5: revealedTop5.filter((song) => predictedTop5.has(song.id)).length,
    top10: revealedTop10.filter((song) => predictedTop10.has(song.id)).length,
  };
}

function finalPlacementSummary(
  predictedIds: string[],
  officialSongs: FinalistResult[],
) {
  const predictedPlaceById = new Map(
    predictedIds.map((songId, index) => [songId, index + 1]),
  );
  const actualWinner = officialSongs.find((song) => song.actualPlacement === 1);
  const metrics = placementMetrics(predictedIds, officialSongs);
  const deltas = officialSongs
    .map((song) => {
      const predictedPlace = predictedPlaceById.get(song.id);
      if (!predictedPlace) return undefined;
      return {
        song,
        predictedPlace,
        actualPlace: song.actualPlacement,
        overrate: song.actualPlacement - predictedPlace,
        underrate: predictedPlace - song.actualPlacement,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const mostOverrated = [...deltas].sort((a, b) => b.overrate - a.overrate)[0];
  const mostUnderrated = [...deltas].sort(
    (a, b) => b.underrate - a.underrate,
  )[0];

  return {
    actualWinner,
    winnerCorrect: predictedIds[0] === actualWinner?.id,
    metrics,
    mostOverrated,
    mostUnderrated,
  };
}

function PredictionStagePanel({
  year,
  stage,
  songs,
}: {
  year: string;
  stage: ContestStage;
  songs: Song[];
}) {
  const predictionKey = predictionKeyForStage(year, stage.key);
  const semiSongs = useMemo(
    () =>
      songsForContestStage(songs, stage.key).filter(
        (song) => !isAutoQualifier(song),
      ),
    [songs, stage.key],
  );
  const officialQualifiers = useMemo(
    () => semiSongs.filter(isOfficialQualifier),
    [semiSongs],
  );
  const hasOfficialResults =
    semiSongs.some((song) => song.qualifiedForFinal === false) &&
    officialQualifiers.length === PREDICTION_SIZE;
  const randomRevealOrder =
    hasOfficialResults &&
    officialQualifiers.some(
      (song) =>
        typeof song.qualifiedAnnouncedPosition !== "number" ||
        song.qualifiedAnnouncedPosition <= 0,
    );
  const [state, setState] = useState<PredictionState>(() =>
    emptyPredictionState(predictionKey),
  );
  const [dataError, setDataError] = useState("");
  const [resultsWarningOpen, setResultsWarningOpen] = useState(false);
  const [flyingSongId, setFlyingSongId] = useState<string | null>(null);
  const [justLandedSongId, setJustLandedSongId] = useState<string | null>(null);
  const [flyingStyle, setFlyingStyle] = useState<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    width: number;
  } | null>(null);
  const sourceRefs = useRef(new Map<string, HTMLSpanElement>());
  const nextLandingRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let active = true;
    setState(emptyPredictionState(predictionKey));
    setFlyingSongId(null);
    setJustLandedSongId(null);
    setFlyingStyle(null);
    setResultsWarningOpen(false);

    async function loadSaved() {
      try {
        const saved = await loadPrediction(predictionKey);
        if (!active) return;
        setState(saved ?? emptyPredictionState(predictionKey));
        setDataError("");
      } catch (error) {
        if (!active) return;
        setDataError(
          error instanceof Error ? error.message : "Could not load prediction.",
        );
      }
    }

    void loadSaved();
    return () => {
      active = false;
    };
  }, [predictionKey]);

  const selectedIds = new Set(state.selectedSongIds);
  const revealedIds = new Set(state.revealedSongIds);
  const predictedAndQualified = officialQualifiers.filter((song) =>
    selectedIds.has(song.id),
  );
  const revealedCorrect = officialQualifiers.filter(
    (song) => revealedIds.has(song.id) && selectedIds.has(song.id),
  );
  const revealOrderIds = state.revealOrderIds ?? [];
  const revealComplete =
    Boolean(state.revealStartedAt) &&
    state.revealedSongIds.length >= PREDICTION_SIZE;
  const summaryVisible = revealComplete && Boolean(state.summaryViewedAt);
  const nextRevealId = revealOrderIds.find((id) => !revealedIds.has(id));
  const nextRevealSong = nextRevealId
    ? semiSongs.find((song) => song.id === nextRevealId)
    : undefined;
  const flyingSong = flyingSongId
    ? semiSongs.find((song) => song.id === flyingSongId)
    : undefined;

  async function persist(nextState: PredictionState) {
    setState(nextState);
    try {
      const saved = await savePrediction(nextState);
      setState(saved);
      setDataError("");
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : "Could not save prediction.",
      );
    }
  }

  function toggleSong(songId: string) {
    if (state.lockedAt) return;
    const nextSelected = selectedIds.has(songId)
      ? state.selectedSongIds.filter((id) => id !== songId)
      : state.selectedSongIds.length < PREDICTION_SIZE
        ? [...state.selectedSongIds, songId]
        : state.selectedSongIds;

    void persist({
      ...state,
      selectedSongIds: nextSelected,
      updatedAt: new Date().toISOString(),
    });
  }

  function lockPrediction() {
    if (state.selectedSongIds.length !== PREDICTION_SIZE) return;
    void persist({
      ...state,
      lockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function startReveal() {
    if (!hasOfficialResults) return;
    const nextRevealOrder =
      state.revealOrderIds ??
      orderedQualifiers(officialQualifiers).map((song) => song.id);

    void persist({
      ...state,
      revealStartedAt: state.revealStartedAt ?? new Date().toISOString(),
      revealOrderIds: nextRevealOrder,
      revealedSongIds: state.revealedSongIds ?? [],
      updatedAt: new Date().toISOString(),
    });
    setResultsWarningOpen(false);
  }

  function revealNextQualifier() {
    if (flyingSongId) return;
    if (revealComplete) {
      void persist({
        ...state,
        summaryViewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    const nextId = revealOrderIds.find((id) => !revealedIds.has(id));
    if (!nextId) return;
    const sourceNode = sourceRefs.current.get(nextId);
    const targetNode = nextLandingRef.current;
    const sourceRect = sourceNode?.getBoundingClientRect();
    const targetRect = targetNode?.getBoundingClientRect();

    if (sourceRect && targetRect) {
      setFlyingSongId(nextId);
      setFlyingStyle({
        fromX: sourceRect.left,
        fromY: sourceRect.top,
        toX: targetRect.left,
        toY: targetRect.top,
        width: sourceRect.width,
      });

      window.setTimeout(() => {
        void persist({
          ...state,
          revealedSongIds: [...state.revealedSongIds, nextId],
          updatedAt: new Date().toISOString(),
        });
        setFlyingSongId(null);
        setFlyingStyle(null);
        setJustLandedSongId(nextId);
        window.setTimeout(() => setJustLandedSongId(null), 900);
      }, FLYING_DURATION_MS);
      return;
    }

    void persist({
      ...state,
      revealedSongIds: [...state.revealedSongIds, nextId],
      updatedAt: new Date().toISOString(),
    });
  }

  async function resetPrediction() {
    const nextState = emptyPredictionState(predictionKey);
    setState(nextState);
    setFlyingSongId(null);
    setJustLandedSongId(null);
    setFlyingStyle(null);
    setResultsWarningOpen(false);
    setDataError("");

    try {
      await clearPrediction(predictionKey);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : "Could not reset prediction.",
      );
    }
  }

  if (!semiSongs.length) {
    return (
      <section className="predictionPanel">
        <div>
          <h2>{stage.label} Predictions</h2>
          <p>
            Add semi-final data in the year JSON to enable predictions here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="predictionPanel">
      <div className="predictionHeader">
        <div>
          <h2>{stage.label} Predictions</h2>
          <p>
            Pick exactly {PREDICTION_SIZE} qualifiers. Auto-qualified entries
            are excluded from predictions.
          </p>
        </div>
        {state.lockedAt ? (
          <button
            className="secondaryButton"
            type="button"
            onClick={resetPrediction}
          >
            <RotateCcw size={16} /> Reset
          </button>
        ) : null}
      </div>

      {dataError ? <div className="dataError">{dataError}</div> : null}

      {!state.lockedAt ? (
        <>
          <div className="predictionCounter">
            Selected: {state.selectedSongIds.length} / {PREDICTION_SIZE}
          </div>
          <div className="predictionGrid">
            {semiSongs.map((song) => (
              <button
                key={song.id}
                className={
                  selectedIds.has(song.id)
                    ? "predictionSong selected"
                    : "predictionSong"
                }
                type="button"
                onClick={() => toggleSong(song.id)}
              >
                <FlagEmoji
                  alt=""
                  code={song.countryCode}
                  src={song.flagEmoji}
                />
                <span>
                  <strong>{song.country}</strong>
                  <small>{song.artist}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="predictionFooter">
            <button
              className="primaryButton"
              type="button"
              disabled={state.selectedSongIds.length !== PREDICTION_SIZE}
              onClick={lockPrediction}
            >
              <LockKeyhole size={16} /> Lock Prediction
            </button>
          </div>
        </>
      ) : !state.revealStartedAt ? (
        <div className="predictionLocked">
          <h3>Prediction locked</h3>
          <p>
            Your picks are saved. Results stay hidden until you choose to reveal
            them.
          </p>
          {hasOfficialResults ? (
            <button
              className="primaryButton"
              type="button"
              onClick={() => setResultsWarningOpen(true)}
            >
              View Qualification Results
            </button>
          ) : (
            <span className="predictionNote">
              Official results are not available for this semi-final yet.
            </span>
          )}
        </div>
      ) : summaryVisible ? (
        <div className="predictionSummary">
          <h3>Prediction Accuracy</h3>
          <strong>
            {predictedAndQualified.length} / {PREDICTION_SIZE} Correct
          </strong>
          <span>
            {Math.round((predictedAndQualified.length / PREDICTION_SIZE) * 100)}
            % Accuracy
          </span>
          <div className="predictionSummaryGrid">
            <PredictionResultList
              title="Predicted and Qualified"
              songs={semiSongs.filter(
                (song) => selectedIds.has(song.id) && isOfficialQualifier(song),
              )}
            />
            <PredictionResultList
              title="Predicted but Eliminated"
              songs={semiSongs.filter(
                (song) =>
                  selectedIds.has(song.id) && song.qualifiedForFinal === false,
              )}
            />
            <PredictionResultList
              title="Not Predicted but Qualified"
              songs={semiSongs.filter(
                (song) =>
                  !selectedIds.has(song.id) && isOfficialQualifier(song),
              )}
            />
            <PredictionResultList
              title="Not Qualified"
              songs={semiSongs.filter(
                (song) => song.qualifiedForFinal === false,
              )}
            />
          </div>
        </div>
      ) : (
        <div className="predictionReveal">
          <div className="predictionScore">
            Correct Predictions: {revealedCorrect.length} / {PREDICTION_SIZE}
          </div>
          {randomRevealOrder ? (
            <p className="predictionNote">Qualifiers shown in random order.</p>
          ) : null}
          <div className="revealCountryCard">
            {semiSongs.map((song) => {
              const revealed = revealedIds.has(song.id);
              if (revealed) return null;
              return (
                <span
                  key={song.id}
                  ref={(node) => {
                    if (node) sourceRefs.current.set(song.id, node);
                    else sourceRefs.current.delete(song.id);
                  }}
                  className={[
                    "revealPill",
                    flyingSongId === song.id ? "flyingSource" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <FlagEmoji
                    alt=""
                    code={song.countryCode}
                    src={song.flagEmoji}
                  />
                  {song.country}
                </span>
              );
            })}
          </div>
          <button
            className="primaryButton"
            type="button"
            disabled={Boolean(flyingSongId)}
            onClick={revealNextQualifier}
          >
            {revealComplete ? "See Final Statistics" : "Reveal Next Qualifier"}
          </button>
          <div className="revealedQualifiers">
            <h3>Already Revealed Qualifiers</h3>
            <div>
              {state.revealedSongIds.length
                ? state.revealedSongIds.map((songId) => {
                    const song = semiSongs.find((item) => item.id === songId);
                    if (!song) return null;
                    const correct = selectedIds.has(song.id);
                    const missed = !selectedIds.has(song.id);
                    return (
                      <span
                        className={[
                          "revealedQualifier",
                          justLandedSongId === song.id ? "landed" : "",
                          correct ? "correct" : "",
                          missed ? "missed" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={song.id}
                      >
                        {correct ? <Check size={16} /> : null}
                        {missed ? <X size={16} /> : null}
                        <FlagEmoji
                          alt=""
                          code={song.countryCode}
                          src={song.flagEmoji}
                        />
                        {song.country}
                      </span>
                    );
                  })
                : null}
              {!state.revealedSongIds.length && !nextRevealSong ? (
                <p>No qualifiers revealed yet.</p>
              ) : null}
              {nextRevealSong ? (
                <span
                  className="revealedQualifier landingPlaceholder"
                  ref={nextLandingRef}
                >
                  <FlagEmoji
                    alt=""
                    code={nextRevealSong.countryCode}
                    src={nextRevealSong.flagEmoji}
                  />
                  {nextRevealSong.country}
                </span>
              ) : null}
            </div>
          </div>
          {flyingSong && flyingStyle
            ? createPortal(
                <span
                  className="flyingQualifier"
                  style={
                    {
                      "--from-x": `${flyingStyle.fromX}px`,
                      "--from-y": `${flyingStyle.fromY}px`,
                      "--to-x": `${flyingStyle.toX}px`,
                      "--to-y": `${flyingStyle.toY}px`,
                      "--fly-width": `${flyingStyle.width}px`,
                    } as CSSProperties
                  }
                >
                  <FlagEmoji
                    alt=""
                    code={flyingSong.countryCode}
                    src={flyingSong.flagEmoji}
                  />
                  {flyingSong.country}
                </span>,
                document.body,
              )
            : null}
        </div>
      )}

      {resultsWarningOpen ? (
        <div
          className="spoilerModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qualification-results-title"
        >
          <div className="spoilerBackdrop" />
          <section className="spoilerDialog">
            <h2 id="qualification-results-title">Qualification Results</h2>
            <p>This will reveal the official qualifiers for this semi-final.</p>
            <div className="spoilerActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => setResultsWarningOpen(false)}
              >
                Cancel
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={startReveal}
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function PredictionResultList({
  title,
  songs,
}: {
  title: string;
  songs: Song[];
}) {
  return (
    <section className="predictionResultList">
      <h4>{title}</h4>
      {songs.length ? (
        <ul>
          {songs.map((song) => (
            <li key={song.id}>
              <FlagEmoji alt="" code={song.countryCode} src={song.flagEmoji} />
              {song.country}
            </li>
          ))}
        </ul>
      ) : (
        <p>None</p>
      )}
    </section>
  );
}

function PlacementPredictionRow({
  song,
  placement,
  locked,
}: {
  song: Song;
  placement: number;
  locked: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: song.id,
    disabled: locked,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      className={[
        "placementPredictionRow",
        isDragging ? "dragging" : "",
        locked ? "locked" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      <button
        className="placementDragHandle"
        type="button"
        disabled={locked}
        {...attributes}
        {...listeners}
        aria-label={`Move ${song.country}`}
      >
        <span aria-hidden="true">::</span>
      </button>
      <span className="placementRank">{ordinal(placement)}</span>
      <FlagEmoji alt="" code={song.countryCode} src={song.flagEmoji} />
      <span className="placementSongMeta">
        <strong>{song.country}</strong>
        <small>
          {song.artist} / {song.title}
        </small>
      </span>
    </article>
  );
}

function PlacementPredictionList({
  songs,
  locked,
  onReorder,
}: {
  songs: Song[];
  locked: boolean;
  onReorder: (songs: Song[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = songs.findIndex((song) => song.id === active.id);
    const newIndex = songs.findIndex((song) => song.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(songs, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={songs.map((song) => song.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="placementPredictionList">
          {songs.map((song, index) => (
            <PlacementPredictionRow
              key={song.id}
              song={song}
              placement={index + 1}
              locked={locked}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function PlacementSongChip({ song }: { song: Song }) {
  return (
    <span className="placementSongChip">
      <FlagEmoji alt="" code={song.countryCode} src={song.flagEmoji} />
      {song.country}
    </span>
  );
}

function PlacementRevealCard({
  song,
  predictedPlace,
  revealIndex,
}: {
  song: FinalistResult;
  predictedPlace: number;
  revealIndex: number;
}) {
  const difference = predictedPlace - song.actualPlacement;
  const absoluteDifference = Math.abs(difference);
  const differenceClass =
    difference === 0
      ? "exact"
      : difference > 0
        ? "underestimated"
        : "overestimated";

  return (
    <section
      className={[
        "placementRevealCard",
        `place-${song.actualPlacement}`,
        differenceClass,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--reveal-index": revealIndex } as CSSProperties}
    >
      <span className="placementRevealPlace">
        {ordinal(song.actualPlacement)} Place
      </span>
      <div className="placementRevealIdentity">
        <FlagEmoji alt="" code={song.countryCode} src={song.flagEmoji} />
        <div>
          <h3>{song.country}</h3>
          <p>
            {song.artist} / {song.title}
          </p>
        </div>
      </div>
      <div className="placementComparison">
        <strong>Predicted: {ordinal(predictedPlace)}</strong>
        <strong>Actual: {ordinal(song.actualPlacement)}</strong>
        <strong>
          Difference:{" "}
          {difference === 0
            ? "Exact"
            : `${difference > 0 ? "-" : "+"}${absoluteDifference}`}
        </strong>
      </div>
    </section>
  );
}

function splitScoreboard(songs: FinalistResult[]) {
  const splitIndex = Math.ceil(songs.length / 2);
  return [songs.slice(0, splitIndex), songs.slice(splitIndex)];
}

function PlacementScoreboard({
  songs,
  revealedIds,
  predictedPlaceById,
  revealOrderIds,
}: {
  songs: FinalistResult[];
  revealedIds: Set<string>;
  predictedPlaceById: Map<string, number>;
  revealOrderIds: string[];
}) {
  const [leftColumn, rightColumn] = splitScoreboard(songs);
  const revealIndexById = new Map(
    revealOrderIds.map((songId, index) => [songId, index]),
  );

  function renderCard(song: FinalistResult) {
    const revealed = revealedIds.has(song.id);
    return revealed ? (
      <PlacementRevealCard
        key={song.id}
        song={song}
        predictedPlace={predictedPlaceById.get(song.id) ?? songs.length}
        revealIndex={revealIndexById.get(song.id) ?? 0}
      />
    ) : (
      <section
        key={song.id}
        className={[
          "placementRevealCard",
          "unrevealed",
          `place-${song.actualPlacement}`,
        ].join(" ")}
      >
        <span className="placementRevealPlace">
          {ordinal(song.actualPlacement)} Place
        </span>
        <strong>Awaiting reveal</strong>
      </section>
    );
  }

  return (
    <div className="placementScoreboard">
      <div>{leftColumn.map(renderCard)}</div>
      <div>{rightColumn.map(renderCard)}</div>
    </div>
  );
}

function RevealModeModal({
  onCancel,
  onSelect,
  initialMode = "instant",
  initialUseResultsVideo = true,
  initialJuryVideoSegment = "twelve-point",
  initialAutoAdvanceJury = false,
}: {
  onCancel: () => void;
  onSelect: (options: {
    mode: NonNullable<PredictionState["revealMode"]>;
    useResultsVideo: boolean;
    juryVideoSegment: NonNullable<PredictionState["juryVideoSegment"]>;
    autoAdvanceJury: boolean;
  }) => void;
  initialMode?: NonNullable<PredictionState["revealMode"]>;
  initialUseResultsVideo?: boolean;
  initialJuryVideoSegment?: NonNullable<PredictionState["juryVideoSegment"]>;
  initialAutoAdvanceJury?: boolean;
}) {
  const [selectedMode, setSelectedMode] =
    useState<NonNullable<PredictionState["revealMode"]>>(initialMode);
  const [useResultsVideo, setUseResultsVideo] = useState(
    initialUseResultsVideo,
  );
  const [juryVideoSegment, setJuryVideoSegment] =
    useState<NonNullable<PredictionState["juryVideoSegment"]>>(
      initialJuryVideoSegment,
    );
  const [autoAdvanceJury, setAutoAdvanceJury] = useState(
    initialAutoAdvanceJury,
  );
  const showVideoOptions = selectedMode === "eurovision-night";

  return (
    <div
      className="spoilerModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reveal-mode-title"
    >
      <div className="spoilerBackdrop" />
      <section className="spoilerDialog revealModeDialog">
        <h2 id="reveal-mode-title">Choose Reveal Experience</h2>
        <label className="revealModeOption">
          <input
            type="radio"
            name="reveal-mode"
            checked={selectedMode === "instant"}
            onChange={() => setSelectedMode("instant")}
          />
          <span>
            <strong>Instant Results</strong>
            <small>Immediately reveal all placements and statistics.</small>
          </span>
        </label>
        <label className="revealModeOption">
          <input
            type="radio"
            name="reveal-mode"
            checked={selectedMode === "step"}
            onChange={() => setSelectedMode("step")}
          />
          <span>
            <strong>Step-by-Step Reveal</strong>
            <small>Reveal placements individually with suspense.</small>
          </span>
        </label>
        <label className="revealModeOption">
          <input
            type="radio"
            name="reveal-mode"
            checked={selectedMode === "eurovision-night"}
            onChange={() => setSelectedMode("eurovision-night")}
          />
          <span>
            <strong>Eurovision Results Night</strong>
            <small>Recreate the jury and televote scoreboard sequence.</small>
          </span>
        </label>
        {showVideoOptions ? (
          <div className="revealVideoOptions">
            <label className="revealModeOption compact">
              <input
                type="checkbox"
                checked={useResultsVideo}
                onChange={(event) => setUseResultsVideo(event.target.checked)}
              />
              <span>
                <strong>Use Livestream Video</strong>
                <small>Sync available jury and televote timestamps.</small>
              </span>
            </label>
            {useResultsVideo ? (
              <fieldset className="revealSegmentOptions">
                <legend>Jury video length</legend>
                <label>
                  <input
                    type="radio"
                    name="jury-video-segment"
                    checked={juryVideoSegment === "twelve-point"}
                    onChange={() => setJuryVideoSegment("twelve-point")}
                  />
                  <span>12-point moment only</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="jury-video-segment"
                    checked={juryVideoSegment === "full-call"}
                    onChange={() => setJuryVideoSegment("full-call")}
                  />
                  <span>Whole delegation call</span>
                </label>
              </fieldset>
            ) : null}
            <label className="revealModeOption compact">
              <input
                type="checkbox"
                checked={autoAdvanceJury}
                onChange={(event) => setAutoAdvanceJury(event.target.checked)}
              />
              <span>
                <strong>Auto-Advance Jury</strong>
                <small>Automatically continue to the next delegation.</small>
              </span>
            </label>
          </div>
        ) : null}
        <div className="spoilerActions">
          <button className="secondaryButton" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primaryButton"
            type="button"
            onClick={() =>
              onSelect({
                mode: selectedMode,
                useResultsVideo:
                  selectedMode === "eurovision-night" && useResultsVideo,
                juryVideoSegment,
                autoAdvanceJury:
                  selectedMode === "eurovision-night" && autoAdvanceJury,
              })
            }
          >
            Reveal Results
          </button>
        </div>
      </section>
    </div>
  );
}

function AnimatedScore({
  value,
  active,
  songId,
  rollDuration = 400,
}: {
  value: number;
  active?: boolean;
  songId: string;
  rollDuration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  const [rolling, setRolling] = useState(false);
  const displayValueRef = useRef(value);

  useEffect(() => {
    const start = displayValueRef.current;
    const end = value;
    if (start === end) return;

    setPreviousValue(start);
    setRolling(true);
    const duration = rollDuration;
    const startedAt = performance.now();
    let frame = 0;
    let rollTimer = window.setTimeout(() => setRolling(false), duration + 40);

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(start + (end - start) * eased);
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(rollTimer);
    };
  }, [rollDuration, value]);

  return (
    <strong
      className={[
        "nightScore",
        active ? "impact" : "",
        rolling ? "rolling" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-score-target={songId}
      style={{ "--score-roll-duration": `${rollDuration}ms` } as CSSProperties}
    >
      <span className="scoreRoller" aria-hidden="true">
        <span>{previousValue}</span>
        <span>{displayValue}</span>
      </span>
      <span className="srOnly">{displayValue}</span>
    </strong>
  );
}

function ResultNightScoreboard({
  songs,
  scores,
  awards,
  activeSongId,
  highlightedSongIds,
  settledHighlightSongIds,
  resettingSongIds,
  slowRollingSongId,
  completedSongIds,
  winnerSongId,
  registerCard,
}: {
  songs: FinalistResult[];
  scores: ScoreboardSnapshot;
  awards: AwardAnimation[];
  activeSongId?: string;
  highlightedSongIds: Set<string>;
  settledHighlightSongIds: Set<string>;
  resettingSongIds: Set<string>;
  slowRollingSongId?: string;
  completedSongIds: Set<string>;
  winnerSongId?: string;
  registerCard: (songId: string, node: HTMLElement | null) => void;
}) {
  const [leftColumn, rightColumn] = splitScoreboard(songs);
  const awardBySongId = new Map(awards.map((award) => [award.songId, award]));

  function renderCard(song: FinalistResult, index: number) {
    const award = awardBySongId.get(song.id);
    return (
      <article
        key={song.id}
        ref={(node) => registerCard(song.id, node)}
        className={[
          "nightScoreboardCard",
          activeSongId === song.id ? "active" : "",
          highlightedSongIds.has(song.id) ? "awarded" : "",
          settledHighlightSongIds.has(song.id) ? "settled" : "",
          resettingSongIds.has(song.id) ? "resetting" : "",
          index === 0 ? "podiumFirst" : "",
          index === 1 ? "podiumSecond" : "",
          index === 2 ? "podiumThird" : "",
          completedSongIds.has(song.id) ? "completed" : "",
          winnerSongId === song.id ? "winner" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="nightRank">{index + 1}</span>
        <FlagEmoji alt="" code={song.countryCode} src={song.flagEmoji} />
        <span className="nightCountry">
          <strong>{song.country}</strong>
          <small>{song.title}</small>
        </span>
        <span className="nightScoreWrap">
          <AnimatedScore
            value={scores[song.id] ?? 0}
            active={Boolean(award)}
            songId={song.id}
            rollDuration={slowRollingSongId === song.id ? 1000 : 400}
          />
          {award ? (
            <em
              className="nightAward"
              style={{ "--award-delay": `${award.delay}ms` } as CSSProperties}
            >
              +{award.points}
            </em>
          ) : null}
        </span>
      </article>
    );
  }

  return (
    <div className="nightScoreboard">
      <div>{leftColumn.map((song, index) => renderCard(song, index))}</div>
      <div>
        {rightColumn.map((song, index) =>
          renderCard(song, leftColumn.length + index),
        )}
      </div>
    </div>
  );
}

function JuryAwardPanel({
  delegation,
  hideTwelve,
  visibleVotes,
  exiting = false,
}: {
  delegation?: ResultDelegation;
  hideTwelve?: boolean;
  visibleVotes?: JuryVote[];
  exiting?: boolean;
}) {
  const votes = [...(visibleVotes ?? juryVotesForDisplay(delegation, hideTwelve))]
    .sort((a, b) => b.points - a.points);
  const left = votes.slice(0, Math.ceil(votes.length / 2));
  const right = votes.slice(Math.ceil(votes.length / 2));

  if (!delegation) return null;

  return (
    <section className={exiting ? "juryAwardPanel exiting" : "juryAwardPanel"}>
      <h3>{delegation.country} has awarded:</h3>
      <div>
        <div>
          {left.map((vote, index) => (
            <span
              key={`${vote.country}-${vote.points}`}
              style={
                {
                  "--vote-delay": `${index * JURY_AWARD_STAGGER_MS}ms`,
                  "--vote-exit-delay": `${index * 35}ms`,
                } as CSSProperties
              }
            >
              <strong>{vote.points}</strong> points to {vote.country}
            </span>
          ))}
        </div>
        <div>
          {right.map((vote, index) => (
            <span
              key={`${vote.country}-${vote.points}`}
              style={
                {
                  "--vote-delay": `${(left.length + index) * JURY_AWARD_STAGGER_MS}ms`,
                  "--vote-exit-delay": `${(left.length + index) * 35}ms`,
                } as CSSProperties
              }
            >
              <strong>{vote.points}</strong> points to {vote.country}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function CenterTelevoteScore({
  points,
  flying,
  target,
}: {
  points?: number;
  flying: boolean;
  target?: { x: number; y: number };
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof points !== "number") {
      setDisplayValue(0);
      return;
    }

    const targetPoints = points;
    const duration = TELEVOTE_REVEAL_GROW_MS;
    const startedAt = performance.now();
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / duration, 1);
      setDisplayValue(Math.round(targetPoints * progress));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [points]);

  if (typeof points !== "number") return null;

  return createPortal(
    <div
      className={flying ? "centerTelevoteScore flying" : "centerTelevoteScore"}
      style={
        {
          "--target-x": target ? `${target.x}px` : "50vw",
          "--target-y": target ? `${target.y}px` : "50vh",
        } as CSSProperties
      }
    >
      +{displayValue}
    </div>,
    document.body,
  );
}

function CenterStaticAward({
  visible,
  points,
  flying,
  target,
}: {
  visible: boolean;
  points: number;
  flying: boolean;
  target?: { x: number; y: number };
}) {
  if (!visible) return null;

  return createPortal(
    <div
      className={flying ? "centerStaticAward flying" : "centerStaticAward"}
      style={
        {
          "--target-x": target
            ? `${target.x - window.innerWidth / 2}px`
            : "0px",
          "--target-y": target
            ? `${target.y - window.innerHeight / 2}px`
            : "0px",
        } as CSSProperties
      }
    >
      +{points}
    </div>,
    document.body,
  );
}

const YouTubeResultNightVideo = memo(function YouTubeResultNightVideo({
  title,
  url,
  start,
  end: _end,
  playbackKey,
  onTimeUpdateRef,
}: {
  title: string;
  url?: string;
  start?: number;
  end?: number;
  playbackKey: string;
  onTimeUpdateRef: { current: (currentTime: number) => void };
}) {
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const pollIntervalRef = useRef<number | undefined>(undefined);
  const pollingStartedRef = useRef(false);

  useEffect(() => {
    if (!url || !playerHostRef.current) return;
    const videoId = youtubeVideoId(url);
    if (!videoId) return;

    let cancelled = false;
    let player: YouTubePlayer | undefined;
    let playTimer = 0;
    pollingStartedRef.current = false;

    function stopPolling() {
      if (typeof pollIntervalRef.current === "number") {
        window.clearInterval(pollIntervalRef.current);
      }
      pollIntervalRef.current = undefined;
      pollingStartedRef.current = false;
    }

    function poll() {
      if (!player || cancelled) return;
      onTimeUpdateRef.current(player.getCurrentTime());
    }

    function startPolling() {
      if (pollingStartedRef.current) return;
      pollingStartedRef.current = true;
      poll();
      pollIntervalRef.current = window.setInterval(poll, 200);
    }

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !playerHostRef.current) return;
      player = new YT.Player(playerHostRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          ...(typeof start === "number"
            ? {
                start: Math.max(0, Math.floor(start)),
                t: `${Math.max(0, Math.floor(start))}s`,
              }
            : {}),
        },
        events: {
          onReady: (event) => {
            player = event.target;
            if (typeof start === "number") {
              player.seekTo(Math.max(0, start), true);
            }
            playTimer = window.setTimeout(() => {
              if (!cancelled) player?.playVideo();
            }, RESULTS_VIDEO_PREROLL_MS);
          },
          onStateChange: (event) => {
            player = event.target;
            if (event.data === YOUTUBE_PLAYER_PLAYING) {
              startPolling();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(playTimer);
      stopPolling();
      player?.destroy();
    };
  }, [onTimeUpdateRef, playbackKey, start, url]);

  if (!url) return null;

  return (
    <section className="resultsNightVideo" aria-label={title}>
      <div key={playbackKey} ref={playerHostRef} />
    </section>
  );
});

const LocalResultNightVideo = memo(function LocalResultNightVideo({
  title,
  url,
  start,
  playbackKey,
  onTimeUpdateRef,
  onEndedRef,
  onErrorRef,
}: {
  title: string;
  url?: string;
  start?: number;
  playbackKey: string;
  onTimeUpdateRef: { current: (currentTime: number) => void };
  onEndedRef: { current: () => void };
  onErrorRef: { current: () => void };
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pollIntervalRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    const media = video;
    let playTimer = 0;

    function stopPolling() {
      if (typeof pollIntervalRef.current === "number") {
        window.clearInterval(pollIntervalRef.current);
      }
      pollIntervalRef.current = undefined;
    }

    function poll() {
      onTimeUpdateRef.current(media.currentTime);
    }

    function startPolling() {
      if (typeof pollIntervalRef.current === "number") return;
      poll();
      pollIntervalRef.current = window.setInterval(poll, 100);
    }

    function handleLoadedMetadata() {
      if (typeof start === "number") {
        media.currentTime = Math.max(0, start);
      }
    }

    function handleEnded() {
      stopPolling();
      onEndedRef.current();
    }

    function handleError() {
      stopPolling();
      onErrorRef.current();
    }

    media.addEventListener("loadedmetadata", handleLoadedMetadata);
    media.addEventListener("playing", startPolling);
    media.addEventListener("pause", stopPolling);
    media.addEventListener("waiting", stopPolling);
    media.addEventListener("ended", handleEnded);
    media.addEventListener("error", handleError);

    if (media.readyState >= 1) handleLoadedMetadata();
    playTimer = window.setTimeout(() => {
      void media.play().catch(() => undefined);
    }, RESULTS_VIDEO_PREROLL_MS);

    return () => {
      window.clearTimeout(playTimer);
      stopPolling();
      media.removeEventListener("loadedmetadata", handleLoadedMetadata);
      media.removeEventListener("playing", startPolling);
      media.removeEventListener("pause", stopPolling);
      media.removeEventListener("waiting", stopPolling);
      media.removeEventListener("ended", handleEnded);
      media.removeEventListener("error", handleError);
    };
  }, [onEndedRef, onErrorRef, onTimeUpdateRef, playbackKey, start, url]);

  if (!url) return null;

  return (
    <section className="resultsNightVideo" aria-label={title}>
      <video
        key={playbackKey}
        ref={videoRef}
        src={url}
        controls
        autoPlay
        playsInline
        preload="auto"
      />
    </section>
  );
});

function ResultNightVideo({
  video,
  onTimeUpdateRef,
  onEndedRef,
  onErrorRef,
}: {
  video?: ActiveResultVideo;
  onTimeUpdateRef: { current: (currentTime: number) => void };
  onEndedRef: { current: () => void };
  onErrorRef: { current: () => void };
}) {
  if (!video) return null;
  if (video.source === "asset") {
    return (
      <LocalResultNightVideo
        title={video.title}
        url={video.url}
        start={video.start}
        playbackKey={video.key}
        onTimeUpdateRef={onTimeUpdateRef}
        onEndedRef={onEndedRef}
        onErrorRef={onErrorRef}
      />
    );
  }

  return (
    <YouTubeResultNightVideo
      title={video.title}
      url={video.url}
      start={video.start}
      end={video.end}
      playbackKey={video.key}
      onTimeUpdateRef={onTimeUpdateRef}
    />
  );
}

function EurovisionResultsNight({
  songs,
  delegations,
  resultData,
  useResultsVideo,
  juryVideoSegment,
  autoAdvanceJury,
  initialProgress,
  onProgressChange,
  onShowSummary,
}: {
  songs: FinalistResult[];
  delegations: ResultDelegation[];
  resultData?: YearResultData;
  useResultsVideo: boolean;
  juryVideoSegment: NonNullable<PredictionState["juryVideoSegment"]>;
  autoAdvanceJury: boolean;
  initialProgress?: FinalsRevealProgress;
  onProgressChange: (progress: FinalsRevealProgress) => void;
  onShowSummary: () => void;
}) {
  const juryDelegations = useMemo(
    () => votingDelegations(delegations, resultData?.juryAnnouncementOrder),
    [delegations, resultData?.juryAnnouncementOrder],
  );
  const televoteSongs = useMemo(() => televoteOrder(songs), [songs]);
  const initialProgressRef = useRef(initialProgress);
  const hasJury = juryDelegations.length > 0;
  const hasTelevote = hasTelevoting(songs);
  const hasAssetTelevoteTimestamps = televoteSongs.some(
    (song) =>
      typeof timestampSeconds(song.result.assetsPointsAnnouncedAt) === "number",
  );
  const televoteVideoEnabled =
    useResultsVideo && (hasAssetTelevoteTimestamps || hasTelevoteVideo(resultData));
  const winner = songs.find((song) => song.actualPlacement === 1);
  const [phase, setPhase] = useState<EurovisionNightPhase>(
    initialProgressRef.current?.phase ?? "ready",
  );
  const [scores, setScores] = useState<ScoreboardSnapshot>(() =>
    initialProgressRef.current?.scores ?? initialScores(songs),
  );
  const [juryIndex, setJuryIndex] = useState(
    initialProgressRef.current?.juryIndex ?? 0,
  );
  const [televoteIndex, setTelevoteIndex] = useState(
    initialProgressRef.current?.televoteIndex ?? 0,
  );
  const [currentDelegation, setCurrentDelegation] = useState<
    ResultDelegation | undefined
  >();
  const [awards, setAwards] = useState<AwardAnimation[]>([]);
  const [visibleJuryVotes, setVisibleJuryVotes] = useState<JuryVote[]>([]);
  const [juryPanelExiting, setJuryPanelExiting] = useState(false);
  const [highlightedSongIds, setHighlightedSongIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [settledHighlightSongIds, setSettledHighlightSongIds] = useState<
    Set<string>
  >(() => new Set());
  const [resettingSongIds, setResettingSongIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [animating, setAnimating] = useState(false);
  const [activeTelevoteSongId, setActiveTelevoteSongId] = useState<
    string | undefined
  >();
  const [slowRollingSongId, setSlowRollingSongId] = useState<string | undefined>();
  const [completedTelevoteIds, setCompletedTelevoteIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [centerTelevote, setCenterTelevote] = useState<
    | {
        points: number;
        flying: boolean;
        target?: { x: number; y: number };
      }
    | undefined
  >();
  const [centerTwelve, setCenterTwelve] = useState<
    | {
        visible: boolean;
        flying: boolean;
        target?: { x: number; y: number };
      }
    | undefined
  >();
  const [activeVideo, setActiveVideo] = useState<ActiveResultVideo | undefined>();
  const [frozenOrderIds, setFrozenOrderIds] = useState<string[] | undefined>();
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const timers = useRef<number[]>([]);
  const videoSyncRef = useRef<VideoSyncState | undefined>(undefined);
  const activeJuryIndexRef = useRef(initialProgressRef.current?.juryIndex ?? 0);
  const scoresRef = useRef(scores);
  const videoTimeHandlerRef = useRef<(currentTime: number) => void>(() => {});
  const videoEndedHandlerRef = useRef<() => void>(() => {});
  const videoErrorHandlerRef = useRef<() => void>(() => {});

  const scoreboardSongs = useMemo(() => {
    if (frozenOrderIds) {
      const byId = new Map(songs.map((song) => [song.id, song]));
      return frozenOrderIds
        .map((songId) => byId.get(songId))
        .filter((song): song is FinalistResult => Boolean(song));
    }
    if (phase === "ready") return songs;
    return [...songs].sort((a, b) => scoreSort(a, b, scores));
  }, [frozenOrderIds, phase, scores, songs]);

  const currentTelevoteSong = televoteSongs[televoteIndex];

  useEffect(() => {
    if (phase === "ready") {
      setActiveTelevoteSongId(undefined);
      return;
    }

    if (phase === "televote" && currentTelevoteSong && !animating) {
      setActiveTelevoteSongId(currentTelevoteSong.id);
    }
  }, [animating, currentTelevoteSong, phase]);

  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

  useEffect(() => {
    activeJuryIndexRef.current = juryIndex;
  }, [juryIndex]);

  useEffect(() => {
    if (initialProgressRef.current?.phase === "televote") {
      setCompletedTelevoteIds(
        new Set(
          televoteSongs
            .slice(0, initialProgressRef.current.televoteIndex)
            .map((song) => song.id),
        ),
      );
      setActiveTelevoteSongId(
        televoteSongs[initialProgressRef.current.televoteIndex]?.id,
      );
    }
  }, [televoteSongs]);

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function saveProgress(
    nextPhase: EurovisionNightPhase,
    nextJuryIndex = juryIndex,
    nextTelevoteIndex = televoteIndex,
    nextScores = scoresRef.current,
  ) {
    onProgressChange({
      phase: nextPhase,
      juryIndex: nextJuryIndex,
      televoteIndex: nextTelevoteIndex,
      scores: nextScores,
    });
  }

  function schedule(callback: () => void, delay: number) {
    const timer = window.setTimeout(callback, Math.max(0, delay));
    timers.current.push(timer);
    return timer;
  }

  function clearScheduled() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }

  function scheduleLowerAwards(
    awardsToSchedule: AwardAnimation[],
    votesToShow: JuryVote[],
    startDelay: number,
  ) {
    const lowerAwardsMergeStartDelay =
      awardsToSchedule.length > 0
        ? startDelay +
          Math.max(0, awardsToSchedule.length - 1) * JURY_AWARD_STAGGER_MS +
          JURY_AWARD_MERGE_PAUSE_MS
        : startDelay;

    schedule(() => {
      setVisibleJuryVotes((current) => [...current, ...votesToShow]);
      setAwards((current) => [
        ...current,
        ...awardsToSchedule.map((award, index) => ({
          ...award,
          delay: index * JURY_AWARD_STAGGER_MS,
        })),
      ]);
    }, startDelay);

    awardsToSchedule.forEach((award, index) => {
      const awardStartDelay = startDelay + index * JURY_AWARD_STAGGER_MS;
      const awardMergeDelay =
        lowerAwardsMergeStartDelay + index * JURY_AWARD_MERGE_STAGGER_MS;
      schedule(() => {
        setHighlightedSongIds((current) => new Set(current).add(award.songId));
      }, awardStartDelay);
      schedule(() => {
        setSettledHighlightSongIds((current) =>
          new Set(current).add(award.songId),
        );
      }, awardStartDelay + 980);
      schedule(() => {
        setScores((current) => ({
          ...current,
          [award.songId]: (current[award.songId] ?? 0) + award.points,
        }));
      }, awardMergeDelay);
      schedule(() => {
        setAwards((current) =>
          current.filter(
            (currentAward) =>
              currentAward.songId !== award.songId ||
              currentAward.points !== award.points,
          ),
        );
      }, awardMergeDelay + JURY_AWARD_REMOVE_AFTER_MERGE_MS);
    });

    return lowerAwardsMergeStartDelay;
  }

  function registerCard(songId: string, node: HTMLElement | null) {
    if (node) cardRefs.current.set(songId, node);
    else cardRefs.current.delete(songId);
  }

  function capturePositions() {
    return new Map(
      [...cardRefs.current.entries()].map(([songId, node]) => [
        songId,
        node.getBoundingClientRect(),
      ]),
    );
  }

  function animatePositionChanges(
    previousRects: Map<string, DOMRect>,
    duration = SCORE_RESHUFFLE_MS,
  ) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        cardRefs.current.forEach((node, songId) => {
          const previous = previousRects.get(songId);
          if (!previous) return;
          const next = node.getBoundingClientRect();
          const deltaX = previous.left - next.left;
          const deltaY = previous.top - next.top;
          if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
          node.getAnimations().forEach((animation) => animation.cancel());
          node.animate(
            [
              { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
              { transform: "translate3d(0, 0, 0)" },
            ],
            {
              duration,
              easing: "cubic-bezier(0.16, 0.84, 0.26, 1)",
              fill: "both",
            },
          );
        });
      });
    });
  }

  function applyScores(
    updater: (current: ScoreboardSnapshot) => ScoreboardSnapshot,
  ) {
    const previousRects = capturePositions();
    setScores((current) => updater(current));
    animatePositionChanges(previousRects);
  }

  function releaseFrozenScoreboard() {
    const previousRects = capturePositions();
    setFrozenOrderIds(undefined);
    animatePositionChanges(previousRects);
  }

  function pointsRecipient(voteCountry: string) {
    return songs.find(
      (song) => countryKey(song.country) === countryKey(voteCountry),
    );
  }

  function scoreTargetForSong(songId: string) {
    const scoreNode = cardRefs.current
      .get(songId)
      ?.querySelector(".nightScore")
      ?.getBoundingClientRect();
    return scoreNode
      ? {
          x: scoreNode.left + scoreNode.width / 2,
          y: scoreNode.top + scoreNode.height / 2,
        }
      : undefined;
  }

  function startVoting() {
    if (hasJury) {
      setPhase("jury");
      saveProgress("jury", 0, 0, initialScores(songs));
      schedule(() => processNextJuryDelegation(), 0);
      return;
    }

    if (hasTelevote) {
      const juryScores = juryScoreSnapshot(songs);
      scoresRef.current = juryScores;
      setScores(juryScores);
      setPhase("televote-intro");
      saveProgress("televote-intro", 0, 0, juryScores);
      return;
    }

    const finalScores = totalScoreSnapshot(songs);
    scoresRef.current = finalScores;
    setScores(finalScores);
    setPhase("winner");
    saveProgress("winner", 0, 0, finalScores);
  }

  function finishJuryDelegation() {
    const completedIndex = activeJuryIndexRef.current;
    const nextIndex = completedIndex + 1;
    setAwards([]);
    setJuryPanelExiting(true);
    setResettingSongIds(new Set(highlightedSongIds));
    setCenterTwelve(undefined);
    setSlowRollingSongId(undefined);
    setFrozenOrderIds(undefined);
    setActiveVideo(undefined);
    schedule(() => {
      setVisibleJuryVotes([]);
      setJuryPanelExiting(false);
      setHighlightedSongIds(new Set());
      setSettledHighlightSongIds(new Set());
      setResettingSongIds(new Set());
      setCurrentDelegation(undefined);
      setAnimating(false);
      videoSyncRef.current = undefined;
      setJuryIndex(nextIndex);
      if (nextIndex >= juryDelegations.length) {
        const nextPhase = hasTelevote ? "jury-complete" : "winner";
        setPhase(nextPhase);
        saveProgress(nextPhase, nextIndex, televoteIndex);
      } else if (autoAdvanceJury) {
        saveProgress("jury", nextIndex, televoteIndex);
        processNextJuryDelegation(nextIndex, true);
      } else {
        saveProgress("jury", nextIndex, televoteIndex);
      }
    }, 1000);
  }

  function triggerJuryTwelveAward(sync: Extract<VideoSyncState, { kind: "jury" }>) {
    if (!sync.twelvePointVote || !sync.twelveRecipientId) return;
    const twelveRecipientId = sync.twelveRecipientId;
    const twelvePointVote = sync.twelvePointVote;

    setCenterTwelve({
      visible: true,
      flying: false,
    });

    schedule(() => {
      const target = scoreTargetForSong(twelveRecipientId);
      setCenterTwelve({ visible: true, flying: true, target });
    }, TWELVE_POINT_HOLD_MS);

    schedule(() => {
      setCenterTwelve(undefined);
      setHighlightedSongIds((current) => new Set(current).add(twelveRecipientId));
      schedule(() => {
        setSettledHighlightSongIds((current) =>
          new Set(current).add(twelveRecipientId),
        );
      }, 980);
      setSlowRollingSongId(twelveRecipientId);
      setScores((current) => ({
        ...current,
        [twelveRecipientId]:
          (current[twelveRecipientId] ?? 0) + twelvePointVote.points,
      }));
      schedule(() => setSlowRollingSongId(undefined), 900);
    }, TWELVE_POINT_HOLD_MS + TWELVE_POINT_FLIGHT_MS - 650);

    schedule(() => {
      releaseFrozenScoreboard();
    }, TWELVE_POINT_HOLD_MS + TWELVE_POINT_FLIGHT_MS + 400);
  }

  function handleVideoTime(currentTime: number) {
    const sync = videoSyncRef.current;
    if (!sync) return;

    if (sync.kind === "jury") {
      if (!sync.firedLowerAwards) {
        sync.firedLowerAwards = true;
        scheduleLowerAwards(sync.lowerAwards, sync.lowerVotes, 0);
      }

      if (
        !sync.firedTwelve &&
        typeof sync.twelvePointTimestamp === "number" &&
        currentTime >= sync.twelvePointTimestamp
      ) {
        sync.firedTwelve = true;
        triggerJuryTwelveAward(sync);
      }

      if (
        !sync.firedEnd &&
        typeof sync.delegationEndTime === "number" &&
        currentTime >= sync.delegationEndTime
      ) {
        sync.firedEnd = true;
        setActiveVideo(undefined);
        schedule(() => finishJuryDelegation(), 500);
      }
      return;
    }

    const dueTelevoteSongs = televoteSongs
      .map((song, index) => ({
        song,
        index,
        announcedAt: timestampSeconds(
          sync.useAssetTimestamps
            ? song.result.assetsPointsAnnouncedAt
            : song.result.pointsAnnouncedAt,
        ),
      }))
      .filter(
        (entry) =>
          typeof entry.announcedAt === "number" &&
          currentTime >= Math.max(0, entry.announcedAt - 0.1) &&
          !sync.firedSongIds.has(entry.song.id),
      )
      .sort((a, b) => (a.announcedAt ?? 0) - (b.announcedAt ?? 0));

    dueTelevoteSongs.forEach(({ song, index }) => {
      sync.firedSongIds.add(song.id);
      runTelevoteAnimation(song, index);
    });

    if (
      !sync.firedEnd &&
      typeof sync.endTimestamp === "number" &&
      currentTime >= sync.endTimestamp
    ) {
      sync.firedEnd = true;
      setActiveTelevoteSongId(undefined);
      setActiveVideo(undefined);
      videoSyncRef.current = undefined;
      setPhase("winner");
      saveProgress("winner", juryIndex, televoteSongs.length);
    }
  }

  videoTimeHandlerRef.current = handleVideoTime;

  function handleVideoEnded() {
    const sync = videoSyncRef.current;
    if (!sync || sync.firedEnd) {
      return;
    }
    if (sync.kind === "jury" && sync.finishOnVideoEnd) {
      sync.firedEnd = true;
      schedule(() => finishJuryDelegation(), 500);
      return;
    }
    if (sync.kind === "televote" && sync.useAssetTimestamps) {
      sync.firedEnd = true;
      setActiveTelevoteSongId(undefined);
      setActiveVideo(undefined);
      videoSyncRef.current = undefined;
      setPhase("winner");
      saveProgress("winner", juryIndex, televoteSongs.length);
    }
  }

  videoEndedHandlerRef.current = handleVideoEnded;

  function handleVideoError() {
    setActiveVideo((current) => {
      if (!current || current.source !== "asset" || !current.fallback) {
        return current;
      }
      const sync = videoSyncRef.current;
      if (sync?.kind === "jury") {
        sync.finishOnVideoEnd = false;
        sync.twelvePointTimestamp = current.fallback.syncTwelvePointTimestamp;
        sync.delegationEndTime = current.fallback.syncDelegationEndTime;
      } else if (sync?.kind === "televote") {
        sync.useAssetTimestamps = false;
        sync.endTimestamp = current.fallback.syncTelevoteEndTimestamp;
      }
      return current.fallback;
    });
  }

  videoErrorHandlerRef.current = handleVideoError;

  function processNextJuryDelegation(targetJuryIndex = juryIndex, force = false) {
    const delegation = juryDelegations[targetJuryIndex];
    if (!delegation || (!force && animating)) return;
    clearScheduled();
    activeJuryIndexRef.current = targetJuryIndex;
    setJuryIndex(targetJuryIndex);
    saveProgress("jury", targetJuryIndex, televoteIndex);

    const juryOrderCountry =
      resultData?.juryAnnouncementOrder?.[targetJuryIndex] ?? delegation.country;
    const hasAssetVideo = hasJuryAssetVideo(
      resultData?.year,
      juryOrderCountry,
      delegation,
    );
    const hasAnyVideo =
      useResultsVideo &&
      (hasAssetVideo || hasJuryVideo(delegation, resultData, juryVideoSegment));
    const livestreamDelegationStart = timestampSeconds(
      delegation.result.jury?.delegationStartTime,
    );
    const livestreamTwelveAnnouncementStart = timestampSeconds(
      delegation.result.jury?.twelvePointAnnouncementStartTime,
    );
    const livestreamTwelveAt = timestampSeconds(
      delegation.result.jury?.twelvePointTimestamp,
    );
    const livestreamEnd = timestampSeconds(
      delegation.result.jury?.delegationEndTime,
    );
    const assetTwelveAnnouncementStart = timestampSeconds(
      delegation.result.jury?.assetsTwelvePointAnnouncementStartTime,
    );
    const assetTwelveAt = timestampSeconds(
      delegation.result.jury?.assetsTwelvePointTimestamp,
    );
    const useAssetVideo = useResultsVideo && hasAssetVideo;
    const videoSource: ActiveResultVideo["source"] = useAssetVideo
      ? "asset"
      : "youtube";
    const start = useAssetVideo
      ? juryVideoSegment === "twelve-point" &&
        typeof assetTwelveAnnouncementStart === "number"
        ? assetTwelveAnnouncementStart
        : 0
      : juryVideoSegment === "twelve-point" &&
          typeof livestreamTwelveAnnouncementStart === "number"
        ? livestreamTwelveAnnouncementStart
        : livestreamDelegationStart;
    const twelveAt = useAssetVideo ? assetTwelveAt : livestreamTwelveAt;
    const syncTwelveRevealAt =
      typeof twelveAt === "number" ? Math.max(0, twelveAt - 0.1) : undefined;
    const end = useAssetVideo ? undefined : livestreamEnd;
    const videoMode = hasAnyVideo && typeof start === "number";
    const votesForCascade = juryVotesForCascade(delegation);
    const twelvePointVote = votesForCascade.find((vote) => vote.points === 12);
    const lowerVotes = videoMode
      ? votesForCascade.filter((vote) => vote.points !== 12)
      : votesForCascade;
    const nextAwards = lowerVotes
      .map((vote) => {
        const recipient = pointsRecipient(vote.country);
        return recipient
          ? {
              songId: recipient.id,
              points: vote.points,
              delay: 0,
            }
          : null;
      })
      .filter((award): award is AwardAnimation => Boolean(award));

    setAnimating(true);
    setCurrentDelegation(delegation);
    setAwards([]);
    setVisibleJuryVotes([]);
    setHighlightedSongIds(new Set());
    setSettledHighlightSongIds(new Set());
    setResettingSongIds(new Set());
    setFrozenOrderIds(scoreboardSongs.map((song) => song.id));
    const lowerAwardsStartDelay = videoMode ? 0 : RESULTS_VIDEO_LEAD_IN_MS;
    let lowerAwardsMergeStartDelay = lowerAwardsStartDelay;

    if (videoMode) {
      const videoUrl = useAssetVideo
        ? juryAssetVideoUrl(resultData?.year ?? 0, juryOrderCountry)
        : resultData?.livestreamUrl;
      const fallbackVideo =
        useAssetVideo &&
        resultData?.livestreamUrl &&
        typeof livestreamDelegationStart === "number"
          ? {
              title: `${delegation.country} jury votes`,
              url: resultData.livestreamUrl,
              source: "youtube" as const,
              start:
                juryVideoSegment === "twelve-point" &&
                typeof livestreamTwelveAnnouncementStart === "number"
                  ? livestreamTwelveAnnouncementStart
                  : livestreamDelegationStart,
              end: livestreamEnd,
              key: `${delegation.id}-youtube-fallback-${targetJuryIndex}-${Date.now()}`,
              syncTwelvePointTimestamp:
                typeof livestreamTwelveAt === "number"
                  ? Math.max(0, livestreamTwelveAt - 0.1)
                  : undefined,
              syncDelegationEndTime: livestreamEnd,
            }
          : undefined;
      const twelveRecipient = twelvePointVote
        ? pointsRecipient(twelvePointVote.country)
        : undefined;
      videoSyncRef.current = {
        kind: "jury",
        twelvePointVote,
        twelveRecipientId: twelveRecipient?.id,
        twelvePointTimestamp:
          typeof syncTwelveRevealAt === "number" && syncTwelveRevealAt > 0
            ? syncTwelveRevealAt
            : undefined,
        delegationEndTime: end,
        lowerAwards: nextAwards,
        lowerVotes,
        firedLowerAwards: false,
        firedTwelve: false,
        firedEnd: false,
        finishOnVideoEnd: useAssetVideo,
      };
      if (videoUrl) {
        setActiveVideo({
          title: `${delegation.country} jury votes`,
          url: videoUrl,
          source: videoSource,
          start,
          end,
          key: `${delegation.id}-${videoSource}-${targetJuryIndex}-${Date.now()}`,
          fallback: fallbackVideo,
        });
      } else {
        videoSyncRef.current = undefined;
        setActiveVideo(undefined);
      }
    } else {
      videoSyncRef.current = undefined;
      setActiveVideo(undefined);
    }

    if (!videoMode) {
      lowerAwardsMergeStartDelay = scheduleLowerAwards(
        nextAwards,
        lowerVotes,
        lowerAwardsStartDelay,
      );
    }

    const hasTwelveAwardTimestamp =
      typeof twelveAt === "number" && twelveAt > 0;
    let twelveScoreApplyDelay: number | undefined;
    if (
      !videoMode &&
      twelvePointVote &&
      typeof start === "number" &&
      hasTwelveAwardTimestamp
    ) {
      const twelveRecipient = pointsRecipient(twelvePointVote.country);
      const twelveRevealDelay =
        RESULTS_VIDEO_LEAD_IN_MS + Math.max(0, (twelveAt - start) * 1000);
      const twelveFlyDelay = twelveRevealDelay + TWELVE_POINT_HOLD_MS;

      schedule(() => {
        setCenterTwelve({
          visible: true,
          flying: false,
        });
      }, twelveRevealDelay);

      schedule(() => {
        if (!twelveRecipient) return;
        const target = scoreTargetForSong(twelveRecipient.id);
        setCenterTwelve({ visible: true, flying: true, target });
      }, twelveFlyDelay);

      twelveScoreApplyDelay = Math.max(
        twelveFlyDelay + TWELVE_POINT_FLIGHT_MS,
        twelveRevealDelay + TWELVE_POINT_HOLD_MS + TWELVE_POINT_FLIGHT_MS,
      );

      schedule(() => {
        if (!twelveRecipient) return;
        setCenterTwelve(undefined);
        setHighlightedSongIds((current) =>
          new Set(current).add(twelveRecipient.id),
        );
        schedule(() => {
          setSettledHighlightSongIds((current) =>
            new Set(current).add(twelveRecipient.id),
          );
        }, 980);
        setSlowRollingSongId(twelveRecipient.id);
        setScores((current) => {
          const next = { ...current };
          next[twelveRecipient.id] =
            (next[twelveRecipient.id] ?? 0) + twelvePointVote.points;
          return next;
        });
        schedule(() => setSlowRollingSongId(undefined), 900);
      }, twelveScoreApplyDelay);

      schedule(() => {
        releaseFrozenScoreboard();
      }, twelveScoreApplyDelay + 250);
    } else if (!videoMode && twelvePointVote) {
      const twelveRecipient = pointsRecipient(twelvePointVote.country);
      const fallbackTwelveApplyDelay =
        lowerAwardsMergeStartDelay +
        Math.max(0, nextAwards.length - 1) * JURY_AWARD_MERGE_STAGGER_MS +
        JURY_AWARD_REMOVE_AFTER_MERGE_MS;
      schedule(() => {
        if (!twelveRecipient) return;
        setHighlightedSongIds((current) =>
          new Set(current).add(twelveRecipient.id),
        );
        schedule(() => {
          setSettledHighlightSongIds((current) =>
            new Set(current).add(twelveRecipient.id),
          );
        }, 980);
        setSlowRollingSongId(twelveRecipient.id);
        setScores((current) => ({
          ...current,
          [twelveRecipient.id]:
            (current[twelveRecipient.id] ?? 0) + twelvePointVote.points,
        }));
        schedule(() => setSlowRollingSongId(undefined), 900);
        releaseFrozenScoreboard();
      }, fallbackTwelveApplyDelay);
    }

    if (!videoMode) {
      const batchApplyDelay =
        lowerAwardsMergeStartDelay +
        Math.max(0, nextAwards.length - 1) * JURY_AWARD_MERGE_STAGGER_MS +
        JURY_AWARD_REMOVE_AFTER_MERGE_MS;
      schedule(() => {
        releaseFrozenScoreboard();
      }, batchApplyDelay);
    } else if (!videoMode && !twelvePointVote) {
      const batchApplyDelay =
        lowerAwardsMergeStartDelay +
        Math.max(0, nextAwards.length - 1) * JURY_AWARD_MERGE_STAGGER_MS +
        JURY_AWARD_REMOVE_AFTER_MERGE_MS;
      schedule(() => {
        releaseFrozenScoreboard();
      }, batchApplyDelay);
    }

    const videoCompletionDelay = videoMode
      ? 0
      : JURY_SCORE_APPLY_MS + SCORE_RESHUFFLE_MS + 180;
    const twelveCompletionDelay =
      typeof twelveScoreApplyDelay === "number"
        ? twelveScoreApplyDelay + SCORE_RESHUFFLE_MS + 750
        : 0;
    const lowerPointCompletionDelay =
      nextAwards.length > 0
        ? lowerAwardsMergeStartDelay +
          (nextAwards.length - 1) * JURY_AWARD_MERGE_STAGGER_MS +
          JURY_AWARD_REMOVE_AFTER_MERGE_MS +
          SCORE_RESHUFFLE_MS +
          500
        : 0;
    const completionDelay = Math.max(
      videoCompletionDelay,
      twelveCompletionDelay,
      lowerPointCompletionDelay,
    );

    if (!videoMode) {
      schedule(() => {
        finishJuryDelegation();
      }, completionDelay);
    }
  }

  function continueAfterJury() {
    if (hasTelevote) {
      setPhase("televote-intro");
      saveProgress("televote-intro", juryIndex, televoteIndex);
      return;
    }
    setPhase("winner");
    saveProgress("winner", juryIndex, televoteIndex);
  }

  function beginTelevote() {
    const startingSong = televoteSongs[televoteIndex];
    setPhase("televote");
    setActiveTelevoteSongId(startingSong?.id);
    saveProgress("televote", juryIndex, televoteIndex);
    if (!useResultsVideo || !resultData) return;

    const begin = timestampSeconds(resultData.televote?.beginTimestamp);
    const end = timestampSeconds(resultData.televote?.endTimestamp);
    const assetVideoUrl = televoteAssetVideoUrl(resultData.year);
    const assetStart = Math.max(
      0,
      (timestampSeconds(startingSong?.result.assetsPointsAnnouncedAt) ?? 0) - 4,
    );
    const youtubeStart =
      typeof begin === "number"
        ? Math.max(
            begin,
            (timestampSeconds(startingSong?.result.pointsAnnouncedAt) ?? begin) - 4,
          )
        : undefined;
    const firedSongIds = new Set(
      televoteSongs.slice(0, televoteIndex).map((song) => song.id),
    );
    const youtubeFallback =
      resultData.livestreamUrl && typeof begin === "number"
        ? {
            title: "Televote Results",
            url: resultData.livestreamUrl,
            source: "youtube" as const,
            start: youtubeStart ?? begin,
            end,
            key: `televote-youtube-fallback-${Date.now()}`,
            syncTelevoteEndTimestamp: end,
          }
        : undefined;

    if (hasAssetTelevoteTimestamps) {
      setActiveVideo({
        title: "Televote Results",
        url: assetVideoUrl,
        source: "asset",
        start: assetStart,
        key: `televote-asset-${Date.now()}`,
        fallback: youtubeFallback,
      });
      videoSyncRef.current = {
        kind: "televote",
        firedSongIds,
        firedEnd: false,
        useAssetTimestamps: true,
      };
      return;
    }

    if (!televoteVideoEnabled || !resultData.livestreamUrl) return;

    setActiveVideo({
      title: "Televote Results",
      url: resultData.livestreamUrl,
      source: "youtube",
      start: youtubeStart ?? begin,
      end,
      key: `televote-${Date.now()}`,
    });
    videoSyncRef.current = {
      kind: "televote",
      firedSongIds,
      firedEnd: false,
      endTimestamp: end,
      useAssetTimestamps: false,
    };
  }

  function runTelevoteAnimation(song: FinalistResult, index: number) {
    const points = song.result.televotePoints ?? 0;
    const target = scoreTargetForSong(song.id);
    const flyDelay = TELEVOTE_REVEAL_GROW_MS + TELEVOTE_REVEAL_HOLD_MS;
    const scoreApplyDelay = flyDelay + TELEVOTE_REVEAL_FLIGHT_MS - 120;

    setAnimating(true);
    setActiveTelevoteSongId(song.id);
    setCenterTelevote({ points, flying: false, target });

    window.setTimeout(() => {
      setCenterTelevote({ points, flying: true, target });
    }, flyDelay);

    window.setTimeout(() => {
      setCenterTelevote(undefined);
      setAwards([{ songId: song.id, points, delay: 0 }]);
      setHighlightedSongIds(new Set([song.id]));
      schedule(() => {
        setSettledHighlightSongIds((current) => new Set(current).add(song.id));
      }, 980);
      applyScores((current) => ({
        ...current,
        [song.id]: (current[song.id] ?? 0) + points,
      }));
    }, scoreApplyDelay);

    window.setTimeout(() => {
      setAwards([]);
      setHighlightedSongIds(new Set());
      setCompletedTelevoteIds((current) => new Set(current).add(song.id));
      setAnimating(false);
      const nextTelevoteIndex = Math.max(televoteIndex, index + 1);
      setTelevoteIndex((current) => Math.max(current, index + 1));
      const nextSong = televoteSongs[index + 1];
      saveProgress(
        nextSong ? "televote" : "winner",
        juryIndex,
        nextTelevoteIndex,
      );
      if (nextSong) {
        setActiveTelevoteSongId(nextSong.id);
      } else {
        setActiveTelevoteSongId(undefined);
        if (!televoteVideoEnabled) setPhase("winner");
      }
    }, scoreApplyDelay + SCORE_RESHUFFLE_MS);
  }

  function processNextTelevote() {
    const song = televoteSongs[televoteIndex];
    if (!song || animating) return;
    runTelevoteAnimation(song, televoteIndex);
  }

  const progressText =
    phase === "jury"
      ? `Jury delegation ${Math.min(juryIndex + 1, juryDelegations.length)} / ${juryDelegations.length}`
      : phase === "televote"
        ? `Televote ${Math.min(televoteIndex + 1, televoteSongs.length)} / ${televoteSongs.length}`
        : "Scoreboard ready";
  const hideJuryTwelveInPanel =
    phase === "jury" &&
    useResultsVideo &&
    juryVideoSegment === "twelve-point";

  return (
    <div className="resultsNight">
      <div className="resultsNightHeader">
        <div>
          <h3>Eurovision Results Night</h3>
          <p>{progressText}</p>
        </div>
        <div className="resultsNightActions">
          {phase === "ready" ? (
            <button
              className="primaryButton"
              type="button"
              onClick={startVoting}
            >
              Begin Voting
            </button>
          ) : null}
          {phase === "jury" ? (
            <button
              className="primaryButton"
              type="button"
              disabled={animating}
              onClick={() => processNextJuryDelegation()}
            >
              {animating ? "Counting Points" : "Next Delegation"}
            </button>
          ) : null}
          {phase === "jury-complete" ? (
            <button
              className="primaryButton"
              type="button"
              onClick={continueAfterJury}
            >
              Continue
            </button>
          ) : null}
          {phase === "televote-intro" ? (
            <button
              className="primaryButton"
              type="button"
              onClick={beginTelevote}
            >
              Begin Televote Results
            </button>
          ) : null}
          {phase === "televote" && !televoteVideoEnabled ? (
            <button
              className="primaryButton"
              type="button"
              disabled={animating}
              onClick={processNextTelevote}
            >
              {animating ? "Updating Score" : "Next Televote"}
            </button>
          ) : null}
          {phase === "televote" &&
          televoteVideoEnabled &&
          !activeVideo &&
          currentTelevoteSong ? (
            <button
              className="primaryButton"
              type="button"
              disabled={animating}
              onClick={beginTelevote}
            >
              Continue Televote Results
            </button>
          ) : null}
          {phase === "winner" ? (
            <button
              className="primaryButton"
              type="button"
              onClick={onShowSummary}
            >
              Show Statistics
            </button>
          ) : null}
        </div>
      </div>

      <div className="resultsNightStage">
        <div className="resultsNightMediaColumn">
          <ResultNightVideo
            video={activeVideo}
            onTimeUpdateRef={videoTimeHandlerRef}
            onEndedRef={videoEndedHandlerRef}
            onErrorRef={videoErrorHandlerRef}
          />

          {phase === "jury" || currentDelegation ? (
            <JuryAwardPanel
              delegation={currentDelegation}
              hideTwelve={hideJuryTwelveInPanel}
              visibleVotes={visibleJuryVotes}
              exiting={juryPanelExiting}
            />
          ) : null}
          {phase === "jury-complete" ? (
            <section className="resultsNightNotice">
              <h3>Jury Voting Complete</h3>
              <p>Current Jury Standings</p>
            </section>
          ) : null}
          {phase === "televote-intro" ? (
            <section className="resultsNightNotice">
              <h3>Televote Results</h3>
              <p>Countries will receive televote points in jury-score order.</p>
            </section>
          ) : null}
          {phase === "winner" && winner ? (
            <section className="winnerReveal">
              <span>Winner</span>
              <strong>
                <FlagEmoji
                  alt=""
                  code={winner.countryCode}
                  src={winner.flagEmoji}
                />
                {winner.country}
              </strong>
            </section>
          ) : null}
        </div>

        <ResultNightScoreboard
          songs={scoreboardSongs}
          scores={scores}
          awards={awards}
          activeSongId={activeTelevoteSongId}
          highlightedSongIds={highlightedSongIds}
          settledHighlightSongIds={settledHighlightSongIds}
          resettingSongIds={resettingSongIds}
          slowRollingSongId={slowRollingSongId}
          completedSongIds={completedTelevoteIds}
          winnerSongId={phase === "winner" ? winner?.id : undefined}
          registerCard={registerCard}
        />
      </div>

      <CenterTelevoteScore
        points={centerTelevote?.points}
        flying={Boolean(centerTelevote?.flying)}
        target={centerTelevote?.target}
      />
      <CenterStaticAward
        visible={Boolean(centerTwelve?.visible)}
        points={12}
        flying={Boolean(centerTwelve?.flying)}
        target={centerTwelve?.target}
      />
    </div>
  );
}

function PlacementPredictionPanel({
  year,
  stage,
  songs,
}: {
  year: string;
  stage: ContestStage;
  songs: Song[];
}) {
  const predictionKey = predictionKeyForStage(year, stage.key);
  const finalists = useMemo(
    () =>
      Number(year) <= 2003 ? songs : songsForContestStage(songs, "grand-final"),
    [songs, year],
  );
  const resultData = resultsByYear.get(year);
  const officialResults = useMemo(() => {
    if (!resultData) return [];
    const resultsByCountry = new Map(
      resultData.countries
        .filter((country) => country.placement > 0)
        .map((country) => [countryKey(country.country), country]),
    );

    return finalists
      .map((song) => {
        const result = resultsByCountry.get(countryKey(song.country));
        return result
          ? { ...song, actualPlacement: result.placement, result }
          : null;
      })
      .filter((song): song is FinalistResult => Boolean(song))
      .sort((a, b) => a.actualPlacement - b.actualPlacement);
  }, [finalists, resultData]);
  const votingResultDelegations = useMemo(
    () => {
      const songsByCountry = new Map(
        songs.map((song) => [countryKey(song.country), song]),
      );

      return (resultData?.countries ?? [])
        .map((result) => {
          const song = songsByCountry.get(countryKey(result.country));
          return {
            id: song?.id ?? `jury-${assetSlug(result.country)}`,
            country: result.country,
            countryCode: song?.countryCode,
            flagEmoji: song?.flagEmoji,
            flagImageUrl: song?.flagImageUrl,
            result,
          } satisfies ResultDelegation;
        })
        .filter((song) =>
          song.result.jury?.votesAwarded?.some((vote) => vote.points > 0),
        );
    },
    [resultData?.countries, songs],
  );
  const revealOrderIds = useMemo(
    () =>
      [...officialResults]
        .sort((a, b) => b.actualPlacement - a.actualPlacement)
        .map((song) => song.id),
    [officialResults],
  );
  const hasOfficialResults =
    finalists.length > 0 && officialResults.length === finalists.length;
  const [state, setState] = useState<PredictionState>(() =>
    emptyPredictionState(predictionKey),
  );
  const [dataError, setDataError] = useState("");
  const [revealModeOpen, setRevealModeOpen] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [instantAnimationComplete, setInstantAnimationComplete] =
    useState(false);

  useEffect(() => {
    let active = true;
    setState(emptyPredictionState(predictionKey));
    setRevealModeOpen(false);
    setResumePromptOpen(false);
    setInstantAnimationComplete(false);

    async function loadSaved() {
      try {
        const saved = await loadPrediction(predictionKey);
        if (!active) return;
        const nextState = saved ?? emptyPredictionState(predictionKey);
        setState(nextState);
        setResumePromptOpen(
          Boolean(
            nextState.revealMode === "eurovision-night" &&
              nextState.revealStartedAt &&
              nextState.finalsRevealProgress &&
              !nextState.summaryViewedAt,
          ),
        );
        setDataError("");
      } catch (error) {
        if (!active) return;
        setDataError(
          error instanceof Error ? error.message : "Could not load prediction.",
        );
      }
    }

    void loadSaved();
    return () => {
      active = false;
    };
  }, [predictionKey]);

  const finalistById = new Map(finalists.map((song) => [song.id, song]));
  const predictedSongs = [
    ...state.selectedSongIds
      .map((songId) => finalistById.get(songId))
      .filter((song): song is Song => Boolean(song)),
    ...finalists.filter((song) => !state.selectedSongIds.includes(song.id)),
  ];
  const predictedIds = predictedSongs.map((song) => song.id);
  const predictedTop5 = predictedSongs.slice(0, 5);
  const predictedBottom5 = predictedSongs.slice(-5);
  const predictedWinner = predictedSongs[0];
  const revealedIds = state.revealedSongIds ?? [];
  const revealedSet = new Set(revealedIds);
  const nextRevealId = (state.revealOrderIds ?? revealOrderIds).find(
    (songId) => !revealedSet.has(songId),
  );
  const revealComplete =
    Boolean(state.revealStartedAt) && revealedIds.length >= finalists.length;
  const showStatisticsButton =
    revealComplete &&
    !state.summaryViewedAt &&
    (state.revealMode !== "instant" || instantAnimationComplete);
  const summaryVisible = revealComplete && Boolean(state.summaryViewedAt);
  const predictedPlaceById = new Map(
    predictedIds.map((songId, index) => [songId, index + 1]),
  );
  const liveMetrics = placementMetrics(
    predictedIds,
    officialResults,
    revealedIds,
  );
  const summary = finalPlacementSummary(predictedIds, officialResults);

  useEffect(() => {
    if (
      state.revealMode !== "instant" ||
      !state.revealStartedAt ||
      !revealComplete
    ) {
      setInstantAnimationComplete(false);
      return;
    }

    const timeout = window.setTimeout(
      () => setInstantAnimationComplete(true),
      Math.max(0, officialResults.length - 1) * INSTANT_REVEAL_STEP_MS +
        INSTANT_REVEAL_SETTLE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [
    officialResults.length,
    revealComplete,
    state.revealMode,
    state.revealStartedAt,
  ]);

  async function persist(nextState: PredictionState) {
    setState(nextState);
    try {
      const saved = await savePrediction(nextState);
      setState(saved);
      setDataError("");
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : "Could not save prediction.",
      );
    }
  }

  function reorderPrediction(nextSongs: Song[]) {
    if (state.lockedAt) return;
    void persist({
      ...state,
      selectedSongIds: nextSongs.map((song) => song.id),
      updatedAt: new Date().toISOString(),
    });
  }

  function lockPrediction() {
    if (!predictedIds.length) return;
    void persist({
      ...state,
      selectedSongIds: predictedIds,
      lockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function unlockPrediction() {
    if (
      !window.confirm(
        "Unlock this prediction? This will hide any revealed official results and allow edits.",
      )
    ) {
      return;
    }

    void persist({
      ...state,
      lockedAt: undefined,
      revealMode: undefined,
      revealStartedAt: undefined,
      revealOrderIds: undefined,
      revealedSongIds: [],
      summaryViewedAt: undefined,
      finalsRevealProgress: undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  function viewOfficialResults() {
    if (!hasOfficialResults) return;
    setRevealModeOpen(true);
  }

  function startReveal({
    mode,
    useResultsVideo,
    juryVideoSegment,
    autoAdvanceJury,
  }: {
    mode: NonNullable<PredictionState["revealMode"]>;
    useResultsVideo: boolean;
    juryVideoSegment: NonNullable<PredictionState["juryVideoSegment"]>;
    autoAdvanceJury: boolean;
  }) {
    const nextRevealOrder = state.revealOrderIds ?? revealOrderIds;
    void persist({
      ...state,
      selectedSongIds: predictedIds,
      revealMode: mode,
      useResultsVideo,
      juryVideoSegment,
      autoAdvanceJury,
      revealStartedAt: new Date().toISOString(),
      revealOrderIds: nextRevealOrder,
      revealedSongIds:
        mode === "instant" || mode === "eurovision-night"
          ? nextRevealOrder
          : [],
      summaryViewedAt: undefined,
      finalsRevealProgress: undefined,
      updatedAt: new Date().toISOString(),
    });
    setRevealModeOpen(false);
    setResumePromptOpen(false);
  }

  function resetRevealState() {
    void persist({
      ...state,
      revealMode: undefined,
      revealStartedAt: undefined,
      revealOrderIds: undefined,
      revealedSongIds: [],
      summaryViewedAt: undefined,
      finalsRevealProgress: undefined,
      updatedAt: new Date().toISOString(),
    });
    setRevealModeOpen(false);
    setResumePromptOpen(false);
    setInstantAnimationComplete(false);
  }

  function changeRevealSettings() {
    setRevealModeOpen(true);
  }

  function revealNextPlacement() {
    if (showStatisticsButton) {
      void persist({
        ...state,
        summaryViewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (!nextRevealId) return;
    void persist({
      ...state,
      revealedSongIds: [...revealedIds, nextRevealId],
      updatedAt: new Date().toISOString(),
    });
  }

  async function resetPrediction() {
    const nextState = emptyPredictionState(predictionKey);
    setState(nextState);
    setRevealModeOpen(false);
    setResumePromptOpen(false);
    setInstantAnimationComplete(false);
    setDataError("");

    try {
      await clearPrediction(predictionKey);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : "Could not reset prediction.",
      );
    }
  }

  if (!finalists.length) {
    return (
      <section className="predictionPanel">
        <div>
          <h2>Predict the Official Final Results</h2>
          <p>Add finalist data in the year JSON to enable final predictions.</p>
        </div>
      </section>
    );
  }

  const resultsNightActive =
    state.revealStartedAt && state.revealMode === "eurovision-night";
  const resumeProgress = state.finalsRevealProgress;
  const revealModeLabel =
    state.revealMode === "eurovision-night"
      ? "Eurovision Results Night"
      : state.revealMode === "step"
        ? "Step-by-Step Reveal"
        : state.revealMode === "instant"
          ? "Instant Results"
          : "Not selected";

  return (
    <section
      className={[
        "predictionPanel",
        "placementPredictionPanel",
        resultsNightActive ? "resultsNightActive" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="predictionHeader">
        <div>
          <h2>Predict the Official Final Results</h2>
          <p>
            Arrange the finalists in the order you believe Eurovision will
            finish.
          </p>
        </div>
        {state.lockedAt ? (
          <div className="placementHeaderActions">
            <button
              className="secondaryButton"
              type="button"
              onClick={unlockPrediction}
            >
              Unlock Prediction
            </button>
            <button
              className="secondaryButton"
              type="button"
              onClick={resetPrediction}
            >
              <RotateCcw size={16} /> Reset
            </button>
          </div>
        ) : null}
      </div>

      {dataError ? <div className="dataError">{dataError}</div> : null}

      {state.lockedAt && hasOfficialResults ? (
        <div className="revealControlStrip">
          <div>
            <span>Reveal Mode</span>
            <strong>{revealModeLabel}</strong>
          </div>
          <div>
            <button
              className="secondaryButton"
              type="button"
              onClick={changeRevealSettings}
            >
              {state.revealStartedAt ? "Change Reveal" : "Choose Reveal"}
            </button>
            {state.revealStartedAt ? (
              <button
                className="secondaryButton"
                type="button"
                onClick={resetRevealState}
              >
                Restart Reveal
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!state.revealStartedAt ? (
        <>
          <div className="placementLiveSummary">
            <section>
              <span>Predicted Winner</span>
              {predictedWinner ? (
                <PlacementSongChip song={predictedWinner} />
              ) : (
                <strong>None</strong>
              )}
            </section>
            <section>
              <span>Predicted Top 5</span>
              <div>
                {predictedTop5.map((song) => (
                  <PlacementSongChip key={song.id} song={song} />
                ))}
              </div>
            </section>
            <section>
              <span>Predicted Bottom 5</span>
              <div>
                {predictedBottom5.map((song) => (
                  <PlacementSongChip key={song.id} song={song} />
                ))}
              </div>
            </section>
          </div>

          <PlacementPredictionList
            songs={predictedSongs}
            locked={Boolean(state.lockedAt)}
            onReorder={reorderPrediction}
          />

          <div className="predictionFooter">
            {state.lockedAt ? (
              hasOfficialResults ? (
                <button
                  className="primaryButton"
                  type="button"
                  onClick={viewOfficialResults}
                >
                  Choose Reveal
                </button>
              ) : (
                <span className="predictionNote">
                  Official final placements are not available for this contest
                  yet.
                </span>
              )
            ) : (
              <button
                className="primaryButton"
                type="button"
                disabled={!predictedIds.length}
                onClick={lockPrediction}
              >
                <LockKeyhole size={16} /> Lock Prediction
              </button>
            )}
          </div>
        </>
      ) : summaryVisible ? (
        <div className="predictionSummary placementSummary">
          <h3>Prediction Summary</h3>
          <div className="placementStatsGrid">
            <section>
              <span>Winner Prediction Correct</span>
              <strong>{summary.winnerCorrect ? "Yes" : "No"}</strong>
            </section>
            <section>
              <span>Exact Placements Correct</span>
              <strong>{summary.metrics.exact}</strong>
            </section>
            <section>
              <span>Average Placement Error</span>
              <strong>{summary.metrics.averageError.toFixed(1)}</strong>
            </section>
            <section>
              <span>Current Accuracy</span>
              <strong>{summary.metrics.currentAccuracy}%</strong>
            </section>
          </div>
          <div className="placementSummaryGrid">
            <PlacementDeltaCard
              title="Largest Overestimate"
              delta={summary.mostOverrated}
            />
            <PlacementDeltaCard
              title="Largest Underestimate"
              delta={summary.mostUnderrated}
            />
          </div>
        </div>
      ) : state.revealMode === "eurovision-night" ? (
        resumePromptOpen && resumeProgress ? (
          <section className="resumeRevealPrompt">
            <h3>Resume Final Reveal?</h3>
            <p>
              You have a saved Eurovision Results Night in progress. Pick up
              where you left off, or restart the reveal from the beginning.
            </p>
            <div>
              <button
                className="primaryButton"
                type="button"
                onClick={() => setResumePromptOpen(false)}
              >
                Resume
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  void persist({
                    ...state,
                    finalsRevealProgress: undefined,
                    updatedAt: new Date().toISOString(),
                  });
                  setResumePromptOpen(false);
                }}
              >
                Start Over
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  setResumePromptOpen(false);
                  setRevealModeOpen(true);
                }}
              >
                Change Reveal
              </button>
            </div>
          </section>
        ) : (
          <EurovisionResultsNight
            key="results-night"
            songs={officialResults}
            delegations={votingResultDelegations}
            resultData={resultData}
            useResultsVideo={state.useResultsVideo ?? true}
            juryVideoSegment={state.juryVideoSegment ?? "twelve-point"}
            autoAdvanceJury={state.autoAdvanceJury ?? false}
            initialProgress={resumeProgress}
            onProgressChange={(progress) =>
              void persist({
                ...state,
                finalsRevealProgress: progress,
                updatedAt: new Date().toISOString(),
              })
            }
            onShowSummary={() =>
              void persist({
                ...state,
                finalsRevealProgress: undefined,
                summaryViewedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
            }
          />
        )
      ) : (
        <div className="placementReveal">
          <div className="placementRevealHeader">
            <div>
              <h3>Official Results</h3>
              <p>
                Placements Revealed: {revealedIds.length} / {finalists.length}
              </p>
            </div>
            <div>
              <span>Average Prediction Error</span>
              <strong>
                {revealedIds.length
                  ? liveMetrics.averageError.toFixed(1)
                  : "Hidden"}
              </strong>
            </div>
          </div>

          <div className="placementStatsGrid">
            <section>
              <span>Exact Placements Predicted</span>
              <strong>{liveMetrics.exact}</strong>
            </section>
            <section>
              <span>Average Error</span>
              <strong>
                {revealedIds.length
                  ? liveMetrics.averageError.toFixed(1)
                  : "Hidden"}
              </strong>
            </section>
            <section>
              <span>Current Accuracy</span>
              <strong>
                {revealedIds.length
                  ? `${liveMetrics.currentAccuracy}%`
                  : "Hidden"}
              </strong>
            </section>
          </div>

          <PlacementScoreboard
            songs={officialResults}
            revealedIds={revealedSet}
            predictedPlaceById={predictedPlaceById}
            revealOrderIds={state.revealOrderIds ?? revealOrderIds}
          />

          <div className="predictionFooter">
            {showStatisticsButton || state.revealMode === "step" ? (
              <button
                className="primaryButton"
                type="button"
                disabled={
                  state.revealMode === "instant" && !showStatisticsButton
                }
                onClick={revealNextPlacement}
              >
                {showStatisticsButton
                  ? "Show Statistics"
                  : "Reveal Next Placement"}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {revealModeOpen ? (
        <RevealModeModal
          onCancel={() => setRevealModeOpen(false)}
          onSelect={startReveal}
          initialMode={state.revealMode ?? "instant"}
          initialUseResultsVideo={state.useResultsVideo ?? true}
          initialJuryVideoSegment={state.juryVideoSegment ?? "twelve-point"}
          initialAutoAdvanceJury={state.autoAdvanceJury ?? false}
        />
      ) : null}
    </section>
  );
}

function PlacementDeltaCard({
  title,
  delta,
}: {
  title: string;
  delta?: {
    song: Song;
    predictedPlace: number;
    actualPlace: number;
  };
}) {
  return (
    <section className="placementDeltaCard">
      <h4>{title}</h4>
      {delta ? (
        <>
          <strong>
            <FlagEmoji
              alt=""
              code={delta.song.countryCode}
              src={delta.song.flagEmoji}
            />
            {delta.song.country}
          </strong>
          <span>
            Predicted {ordinal(delta.predictedPlace)} / Actual{" "}
            {ordinal(delta.actualPlace)}
          </span>
        </>
      ) : (
        <p>None</p>
      )}
    </section>
  );
}

export default function PredictionPanel({ year, songs }: PredictionPanelProps) {
  const stages = useMemo(() => predictionStagesForYear(Number(year)), [year]);
  const [activeStageKey, setActiveStageKey] = useState<ContestStageKey>(
    stages[0]?.key ?? "semi-final-1",
  );
  const activeStage =
    stages.find((stage) => stage.key === activeStageKey) ?? stages[0];

  useEffect(() => {
    setActiveStageKey(stages[0]?.key ?? "semi-final-1");
  }, [year, stages[0]?.key]);

  if (!stages.length || !activeStage) {
    return (
      <section className="predictionPanel">
        <h2>Predictions</h2>
        <p>Predictions are available for contests with semi-finals.</p>
      </section>
    );
  }

  return (
    <div className="predictionsShell">
      <nav className="stageTabs" aria-label={`${year} prediction stages`}>
        {stages.map((stage) => (
          <button
            key={stage.key}
            className={stage.key === activeStage.key ? "selected" : ""}
            type="button"
            onClick={() => setActiveStageKey(stage.key)}
          >
            {stage.label} Predictions
          </button>
        ))}
      </nav>
      {activeStage.key === "grand-final" ? (
        <PlacementPredictionPanel
          key={activeStage.key}
          year={year}
          stage={activeStage}
          songs={songs}
        />
      ) : (
        <PredictionStagePanel
          key={activeStage.key}
          year={year}
          stage={activeStage}
          songs={songs}
        />
      )}
    </div>
  );
}
