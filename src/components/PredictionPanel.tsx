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
import { Check, LockKeyhole, LockKeyholeOpen, RotateCcw, X } from "lucide-react";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { resultsByYear } from "../data/results";
import { JuryAwardPanel } from "../features/grandFinalResultsNight/components/JuryAwardPanel";
//import { ResultNightScoreboard } from "../features/grandFinalResultsNight/components/ResultNightScoreboard";
import { ResultsNightHeader } from "../features/grandFinalResultsNight/components/ResultsNightHeader";
import "../features/grandFinalResultsNight/styles/GrandFinalResultsNight.css";
import "../features/grandFinalResultsNight/styles/JuryAwardPanel.css";
import "../features/grandFinalResultsNight/styles/ScoreboardCards.css";
import { ActiveResultVideo, AwardAnimation, EurovisionNightPhase, FinalistResult, ScoreboardSnapshot } from "../features/grandFinalResultsNight/types/PredictionsResultsNightProps";
import { useResponsive } from "../hooks/useDisplayType";
import type {
  JuryVote,
  PredictionState,
  ResultDelegation,
  Song,
  YearResultData
} from "../types";
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
import FlagEmoji from "./FlagEmoji";

type PredictionPanelProps = {
  year: string;
  songs: Song[];
  mode?: "predictions" | "results";
  initialStageKey?: ContestStageKey;
  onOpenResults?: (stageKey: ContestStageKey) => void;
  onOpenPredictions?: (stageKey: ContestStageKey) => void;
};

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
const JURY_AWARD_STAGGER_MS = 600;
const JURY_AWARD_ANIMATION_MS = 2600;
const JURY_AWARD_SCORE_IMPACT_MS = 2080;
const JURY_AWARD_MERGE_STAGGER_MS = JURY_AWARD_STAGGER_MS;
const JURY_AWARD_REMOVE_AFTER_MERGE_MS = 320;
const JURY_SCORE_APPLY_MS = 9000;
const TWELVE_POINT_HOLD_MS = 1000;
const TWELVE_POINT_FLIGHT_MS = 2400;
const TELEVOTE_REVEAL_GROW_MS = 2600;
const TELEVOTE_REVEAL_HOLD_MS = 1000;
const TELEVOTE_REVEAL_FLIGHT_MS = 900;
const SCORE_RESHUFFLE_MS = 4200;
const DEFAULT_SLOW_SCORE_ROLL_MS = 1500;
const TELEVOTE_SCORE_ROLL_MIN_MS = 1900;
const TELEVOTE_SCORE_ROLL_MAX_MS = 5400;
const TELEVOTE_SCORE_ROLL_REFERENCE_POINTS = 360;

function smoothScoreProgress(progress: number) {
  return 1 - Math.pow(1 - progress, 5);
}

function televoteScoreRollDuration(points: number) {
  const clampedPoints = Math.min(
    Math.max(points, 0),
    TELEVOTE_SCORE_ROLL_REFERENCE_POINTS,
  );
  const progress = clampedPoints / TELEVOTE_SCORE_ROLL_REFERENCE_POINTS;
  return Math.round(
    TELEVOTE_SCORE_ROLL_MIN_MS +
    (TELEVOTE_SCORE_ROLL_MAX_MS - TELEVOTE_SCORE_ROLL_MIN_MS) * progress,
  );
}

function emptyPredictionState(key: string): PredictionState {
  return {
    key,
    selectedSongIds: [],
    revealedSongIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function stripRevealState(state: PredictionState): PredictionState {
  return {
    ...state,
    revealMode: undefined,
    useResultsVideo: undefined,
    juryVideoSegment: undefined,
    autoAdvanceJury: undefined,
    revealStartedAt: undefined,
    revealOrderIds: undefined,
    revealedSongIds: [],
    finalsRevealProgress: undefined,
    summaryViewedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
}

function savedRevealSessionKey(predictionKey: string) {
  return `eurovision-ranker:saved-reveal-session:${predictionKey}`;
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
  const countryDiff = b.country.localeCompare(a.country);
  if (countryDiff !== 0) return countryDiff;
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

function juryVotesForCascade(delegation?: ResultDelegation) {
  return [...(delegation?.result.jury?.votesAwarded ?? [])]
    .filter((vote) => vote.points > 0)
    .sort((a, b) => a.points - b.points);
}

function validTimestampSeconds(value?: number | null) {
  const timestamp = timestampSeconds(value);
  return typeof timestamp === "number" && timestamp >= 0 ? timestamp : undefined;
}

function televoteOrder(songs: FinalistResult[]) {
  return [...songs]
    .filter((song) => typeof song.result.televotePoints === "number")
    .sort((a, b) => {
      const aAnnouncedAt =
        validTimestampSeconds(a.result.assetsPointsAnnouncedAt) ??
        validTimestampSeconds(a.result.pointsAnnouncedAt);
      const bAnnouncedAt =
        validTimestampSeconds(b.result.assetsPointsAnnouncedAt) ??
        validTimestampSeconds(b.result.pointsAnnouncedAt);
      const aHasValidAnnouncement = typeof aAnnouncedAt === "number";
      const bHasValidAnnouncement = typeof bAnnouncedAt === "number";

      if (aHasValidAnnouncement && bHasValidAnnouncement) {
        return aAnnouncedAt - bAnnouncedAt;
      }
      if (aHasValidAnnouncement) return -1;
      if (bHasValidAnnouncement) return 1;

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

function semiFinalAssetVideoUrl(year: number, stageKey: ContestStageKey) {
  return `/assets/semifinals/${year}-${stageKey}.webm`;
}

function qualifierTimestampSeconds(song: Song) {
  const timedSong = song as Song & {
    assetsQualifiedAnnouncedAt?: number | null;
    qualifiedAnnouncedAt?: number | null;
  };

  return (
    timestampSeconds(timedSong.assetsQualifiedAnnouncedAt) ??
    timestampSeconds(timedSong.qualifiedAnnouncedAt)
  );
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
  mode = "predictions",
  onOpenResults,
  onOpenPredictions,
}: {
  year: string;
  stage: ContestStage;
  songs: Song[];
  mode?: "predictions" | "results";
  onOpenResults?: (stageKey: ContestStageKey) => void;
  onOpenPredictions?: (stageKey: ContestStageKey) => void;
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
  const [predictionPromptOpen, setPredictionPromptOpen] = useState(false);
  const [selectedRevealMode, setSelectedRevealMode] =
    useState<NonNullable<PredictionState["revealMode"]>>("step");
  const [selectedUseResultsVideo, setSelectedUseResultsVideo] = useState(false);
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
    setPredictionPromptOpen(false);

    async function loadSaved() {
      try {
        const saved = await loadPrediction(predictionKey);
        if (!active) return;
        const nextState = saved ?? emptyPredictionState(predictionKey);
        if (nextState.revealStartedAt) {
          const predictionOnlyState = stripRevealState(nextState);
          setState(predictionOnlyState);
          void savePrediction(predictionOnlyState).catch(() => undefined);
        } else {
          setState(nextState);
        }
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
  const hasLockedPrediction = Boolean(
    state.lockedAt && state.selectedSongIds.length > 0,
  );
  const revealedIds = new Set(state.revealedSongIds);
  const predictedAndQualified = officialQualifiers.filter((song) =>
    selectedIds.has(song.id),
  );
  const revealOrderIds = state.revealOrderIds ?? [];
  const revealComplete =
    Boolean(state.revealStartedAt) &&
    state.revealedSongIds.length >= PREDICTION_SIZE;
  const summaryVisible =
    revealComplete && (Boolean(state.summaryViewedAt) || !hasLockedPrediction);
  const nextRevealId = revealOrderIds.find((id) => !revealedIds.has(id));
  const nextRevealSong = nextRevealId
    ? semiSongs.find((song) => song.id === nextRevealId)
    : undefined;
  const flyingSong = flyingSongId
    ? semiSongs.find((song) => song.id === flyingSongId)
    : undefined;
  const hasSemiVideoTimestamps = officialQualifiers.some(
    (song) => typeof qualifierTimestampSeconds(song) === "number",
  );
  const useSemiVideoReveal =
    mode === "results" &&
    state.revealMode === "eurovision-night" &&
    Boolean(state.useResultsVideo);

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

  function unlockPrediction() {
    void persist({
      ...state,
      lockedAt: undefined,
      revealMode: undefined,
      revealStartedAt: undefined,
      revealOrderIds: undefined,
      revealedSongIds: [],
      summaryViewedAt: undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  function startReveal() {
    if (!hasOfficialResults) return;
    if (
      !state.lockedAt &&
      localStorage.getItem("eurovision-ranker:skip-prediction-first-prompt") !==
      "true"
    ) {
      setPredictionPromptOpen(true);
      setResultsWarningOpen(false);
      return;
    }

    commitReveal();
  }

  function commitReveal() {
    const nextRevealOrder =
      state.revealOrderIds ??
      orderedQualifiers(officialQualifiers).map((song) => song.id);

    void persist({
      ...state,
      revealMode: selectedRevealMode,
      useResultsVideo:
        selectedRevealMode === "eurovision-night" && selectedUseResultsVideo,
      revealStartedAt: state.revealStartedAt ?? new Date().toISOString(),
      revealOrderIds: nextRevealOrder,
      revealedSongIds:
        selectedRevealMode === "instant"
          ? nextRevealOrder
          : state.revealedSongIds ?? [],
      updatedAt: new Date().toISOString(),
    });
    setResultsWarningOpen(false);
    setPredictionPromptOpen(false);
  }

  function revealQualifier(nextId: string) {
    if (flyingSongId) return;
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
    revealQualifier(nextId);
  }

  function revealDueVideoQualifier(currentTime: number) {
    if (!useSemiVideoReveal || flyingSongId || revealComplete) return;
    const dueSong = revealOrderIds
      .map((id) => semiSongs.find((song) => song.id === id))
      .find((song) => {
        if (!song || revealedIds.has(song.id)) return false;
        const timestamp = qualifierTimestampSeconds(song);
        return typeof timestamp === "number" && currentTime >= timestamp;
      });

    if (dueSong) revealQualifier(dueSong.id);
  }

  function resetRevealState() {
    const nextState = stripRevealState(state);
    void persist(nextState);
    setFlyingSongId(null);
    setJustLandedSongId(null);
    setFlyingStyle(null);
    setResultsWarningOpen(false);
    setPredictionPromptOpen(false);
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
          <h2>
            {mode === "results"
              ? `${stage.label} Results`
              : `${stage.label} Predictions`}
          </h2>
          <p>
            {mode === "results"
              ? "Choose how to reveal the official qualifiers."
              : `Pick exactly ${PREDICTION_SIZE} qualifiers. Auto-qualified entries are excluded from predictions.`}
          </p>
        </div>
        {state.lockedAt && mode === "predictions" ? (
          <div className="placementHeaderActions">
            <button
              className="secondaryButton"
              type="button"
              onClick={unlockPrediction}
            >
              <LockKeyholeOpen size={16} /> Change Predictions
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

      {mode === "results" && !state.revealStartedAt ? (
        <div className="revealSetupPanel">
          {hasOfficialResults ? (
            <>
              <RevealModeFields
                selectedMode={selectedRevealMode}
                onSelectedModeChange={setSelectedRevealMode}
                useResultsVideo={selectedUseResultsVideo}
                onUseResultsVideoChange={setSelectedUseResultsVideo}
                juryVideoSegment="twelve-point"
                onJuryVideoSegmentChange={() => undefined}
                autoAdvanceJury={false}
                onAutoAdvanceJuryChange={() => undefined}
                showGrandFinalOptions={false}
              />
              <div className="predictionFooter">
                <button
                  className="primaryButton"
                  type="button"
                  onClick={() => setResultsWarningOpen(true)}
                >
                  View Results
                </button>
              </div>
            </>
          ) : (
            <span className="predictionNote">
              Official results are not available for this semi-final yet.
            </span>
          )}
        </div>
      ) : mode === "predictions" && !state.lockedAt ? (
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
      ) : mode === "predictions" ? (
        <div className="predictionLocked">
          <h3>Prediction locked</h3>
          <p>
            Your picks are saved. Open Results when you are ready to reveal the
            official qualifiers and see how you did.
          </p>
          <div className="predictionCounter">
            Selected: {state.selectedSongIds.length} / {PREDICTION_SIZE}
          </div>
          <div className="predictionGrid compactPredictionGrid">
            {semiSongs
              .filter((song) => selectedIds.has(song.id))
              .map((song) => (
                <span key={song.id} className="predictionSong selected">
                  <FlagEmoji
                    alt=""
                    code={song.countryCode}
                    src={song.flagEmoji}
                  />
                  <span>
                    <strong>{song.country}</strong>
                    <small>{song.artist}</small>
                  </span>
                </span>
              ))}
          </div>
          {hasOfficialResults ? (
            <button
              className="primaryButton"
              type="button"
              onClick={() => onOpenResults?.(stage.key)}
            >
              Go To {stage.label} Results
            </button>
          ) : (
            <span className="predictionNote">
              Official results are not available for this semi-final yet.
            </span>
          )}
        </div>
      ) : summaryVisible ? (
        <div className="predictionSummary">
          <div className="resultsDetailActions">
            <button
              className="secondaryButton"
              type="button"
              onClick={resetRevealState}
            >
              Back to Results Setup
            </button>
          </div>
          {hasLockedPrediction ? (
            <>
              <h3>Prediction Accuracy</h3>
              <strong>
                {predictedAndQualified.length} / {PREDICTION_SIZE} Correct
              </strong>
              <span>
                {Math.round(
                  (predictedAndQualified.length / PREDICTION_SIZE) * 100,
                )}
                % Accuracy
              </span>
              <div className="predictionSummaryGrid">
                <PredictionResultList
                  title="Predicted and Qualified"
                  songs={semiSongs.filter(
                    (song) =>
                      selectedIds.has(song.id) && isOfficialQualifier(song),
                  )}
                />
                <PredictionResultList
                  title="Predicted but Eliminated"
                  songs={semiSongs.filter(
                    (song) =>
                      selectedIds.has(song.id) &&
                      song.qualifiedForFinal === false,
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
            </>
          ) : (
            <>
              <h3>Qualification Results</h3>
              <div className="predictionSummaryGrid">
                <PredictionResultList
                  title="Qualified"
                  songs={semiSongs.filter(isOfficialQualifier)}
                />
                <PredictionResultList
                  title="Didn't Qualify"
                  songs={semiSongs.filter(
                    (song) => song.qualifiedForFinal === false,
                  )}
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="predictionReveal">
          <div className="resultsDetailActions">
            <button
              className="secondaryButton"
              type="button"
              onClick={resetRevealState}
            >
              Back to Results Setup
            </button>
          </div>
          {useSemiVideoReveal ? (
            <div className="semiResultsVideo">
              <video
                controls
                src={semiFinalAssetVideoUrl(Number(year), stage.key)}
                onTimeUpdate={(event) =>
                  revealDueVideoQualifier(event.currentTarget.currentTime)
                }
              />
              {!hasSemiVideoTimestamps ? (
                <p className="predictionNote">
                  No timestamp data is available yet, so use the reveal button
                  below.
                </p>
              ) : null}
            </div>
          ) : null}
          {randomRevealOrder ? (
            <p className="predictionNote">Qualifiers shown in random order.</p>
          ) : null}
          <div className="revealCountryCard">
            <h3>Remaining</h3>
            <div>
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
              }
              )}
            </div>
          </div>
          {(!useSemiVideoReveal || !hasSemiVideoTimestamps || revealComplete) &&
            (hasLockedPrediction || !revealComplete) ? (
            <button
              className="primaryButton"
              type="button"
              disabled={Boolean(flyingSongId)}
              onClick={revealNextQualifier}
            >
              {revealComplete
                ? "See Final Statistics"
                : "Reveal Next Qualifier"}
            </button>
          ) : null}
          <div className="revealedQualifiers">
            <h3>Qualified</h3>
            <div>
              {state.revealedSongIds.length
                ? state.revealedSongIds.map((songId) => {
                  const song = semiSongs.find((item) => item.id === songId);
                  if (!song) return null;
                  const correct =
                    hasLockedPrediction && selectedIds.has(song.id);
                  const missed =
                    hasLockedPrediction && !selectedIds.has(song.id);
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
      {predictionPromptOpen ? (
        <div
          className="spoilerModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="semi-prediction-first-title"
        >
          <div className="spoilerBackdrop" />
          <section className="spoilerDialog">
            <h2 id="semi-prediction-first-title">
              Want to Make Predictions First?
            </h2>
            <p>
              If you make predictions before viewing results, the app can show
              accuracy statistics after the reveal.
            </p>
            <label className="spoilerCheckbox">
              <input
                type="checkbox"
                onChange={(event) => {
                  if (event.target.checked) {
                    localStorage.setItem(
                      "eurovision-ranker:skip-prediction-first-prompt",
                      "true",
                    );
                  } else {
                    localStorage.removeItem(
                      "eurovision-ranker:skip-prediction-first-prompt",
                    );
                  }
                }}
              />
              Don't show this again
            </label>
            <div className="spoilerActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  setPredictionPromptOpen(false);
                  onOpenPredictions?.(stage.key);
                }}
              >
                Take Me To Predictions
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={commitReveal}
              >
                Continue To Results
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
  revealed,
}: {
  song: FinalistResult;
  predictedPlace?: number;
  revealIndex: number;
  revealed: boolean;
}) {
  const hasPredictionComparison = typeof predictedPlace === "number";
  const difference = hasPredictionComparison
    ? predictedPlace - song.actualPlacement
    : 0;
  const absoluteDifference = Math.abs(difference);
  const differenceClass =
    !hasPredictionComparison
      ? ""
      : difference === 0
        ? "exact"
        : difference > 0
          ? "underestimated"
          : "overestimated";

  return (
    <section
      className={[
        "placementRevealCard",
        `place-${song.actualPlacement}`,
        revealed ? "revealed" : "unrevealed",
        differenceClass,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--reveal-index": revealIndex } as CSSProperties}
    >
      <div className="placementRevealFace placementRevealFront">
        <span className="placementRevealPlace">
          {ordinal(song.actualPlacement)} Place
        </span>
        <strong>Awaiting reveal</strong>
      </div>
      <div className="placementRevealFace placementRevealBack">
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
        {hasPredictionComparison ? (
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
        ) : null}
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
  showPredictionComparison,
}: {
  songs: FinalistResult[];
  revealedIds: Set<string>;
  predictedPlaceById: Map<string, number>;
  revealOrderIds: string[];
  showPredictionComparison: boolean;
}) {
  const [leftColumn, rightColumn] = splitScoreboard(songs);
  const revealIndexById = new Map(
    revealOrderIds.map((songId, index) => [songId, index]),
  );

  function renderCard(song: FinalistResult) {
    const revealed = revealedIds.has(song.id);
    return (
      <PlacementRevealCard
        key={song.id}
        song={song}
        predictedPlace={
          showPredictionComparison ? predictedPlaceById.get(song.id) : undefined
        }
        revealIndex={revealIndexById.get(song.id) ?? 0}
        revealed={revealed}
      />
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
        <RevealModeFields
          selectedMode={selectedMode}
          onSelectedModeChange={setSelectedMode}
          useResultsVideo={useResultsVideo}
          onUseResultsVideoChange={setUseResultsVideo}
          juryVideoSegment={juryVideoSegment}
          onJuryVideoSegmentChange={setJuryVideoSegment}
          autoAdvanceJury={autoAdvanceJury}
          onAutoAdvanceJuryChange={setAutoAdvanceJury}
          showGrandFinalOptions
        />
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

function RevealModeFields({
  selectedMode,
  onSelectedModeChange,
  useResultsVideo,
  onUseResultsVideoChange,
  juryVideoSegment,
  onJuryVideoSegmentChange,
  autoAdvanceJury,
  onAutoAdvanceJuryChange,
  showGrandFinalOptions,
}: {
  selectedMode: NonNullable<PredictionState["revealMode"]>;
  onSelectedModeChange: (
    mode: NonNullable<PredictionState["revealMode"]>,
  ) => void;
  useResultsVideo: boolean;
  onUseResultsVideoChange: (useVideo: boolean) => void;
  juryVideoSegment: NonNullable<PredictionState["juryVideoSegment"]>;
  onJuryVideoSegmentChange: (
    segment: NonNullable<PredictionState["juryVideoSegment"]>,
  ) => void;
  autoAdvanceJury: boolean;
  onAutoAdvanceJuryChange: (autoAdvance: boolean) => void;
  showGrandFinalOptions: boolean;
}) {
  const showVideoOptions = selectedMode === "eurovision-night";
  const optionName = showGrandFinalOptions
    ? "grand-final-reveal-mode"
    : "semi-final-reveal-mode";

  return (
    <>
      <label className="revealModeOption">
        <input
          type="radio"
          name={optionName}
          checked={selectedMode === "instant"}
          onChange={() => onSelectedModeChange("instant")}
        />
        <span>
          <strong>Instant Results</strong>
          <small>Immediately reveal all placements and statistics.</small>
        </span>
      </label>
      <label className="revealModeOption">
        <input
          type="radio"
          name={optionName}
          checked={selectedMode === "step"}
          onChange={() => onSelectedModeChange("step")}
        />
        <span>
          <strong>Step-by-Step Reveal</strong>
          <small>Reveal placements individually with suspense.</small>
        </span>
      </label>
      <label className="revealModeOption">
        <input
          type="radio"
          name={optionName}
          checked={selectedMode === "eurovision-night"}
          onChange={() => onSelectedModeChange("eurovision-night")}
        />
        <span>
          <strong>Eurovision Results Night</strong>
          <small>
            {showGrandFinalOptions
              ? "Recreate the jury and televote scoreboard sequence."
              : "Reveal qualifiers with the results-night presentation."}
          </small>
        </span>
      </label>
      {showVideoOptions ? (
        <div className="revealVideoOptions">
          <label className="revealModeOption compact">
            <input
              type="checkbox"
              checked={useResultsVideo}
              onChange={(event) =>
                onUseResultsVideoChange(event.target.checked)
              }
            />
            <span>
              <strong>Use Live Stream Video</strong>
              <small>Sync available timestamps during the reveal.</small>
            </span>
          </label>
          {showGrandFinalOptions && useResultsVideo ? (
            <fieldset className="revealSegmentOptions">
              <legend>Jury video length</legend>
              <label>
                <input
                  type="radio"
                  name="jury-video-segment"
                  checked={juryVideoSegment === "twelve-point"}
                  onChange={() => onJuryVideoSegmentChange("twelve-point")}
                />
                <span>12 Point Moment Only</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="jury-video-segment"
                  checked={juryVideoSegment === "full-call"}
                  onChange={() => onJuryVideoSegmentChange("full-call")}
                />
                <span>Full Delegation Call</span>
              </label>
            </fieldset>
          ) : null}
          {showGrandFinalOptions ? (
            <label className="revealModeOption compact">
              <input
                type="checkbox"
                checked={autoAdvanceJury}
                onChange={(event) =>
                  onAutoAdvanceJuryChange(event.target.checked)
                }
              />
              <span>
                <strong>Auto Advance Jury</strong>
                <small>Automatically continue to the next delegation.</small>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function AnimatedScore({
  value,
  active,
  songId,
  rollDuration = 600,
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
      const eased = smoothScoreProgress(progress);
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
  slowRollingDurationMs = DEFAULT_SLOW_SCORE_ROLL_MS,
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
  slowRollingDurationMs?: number;
  completedSongIds: Set<string>;
  winnerSongId?: string;
  registerCard: (songId: string, node: HTMLElement | null) => void;
}) {
  const { isMobile } = useResponsive();

  const awardBySongId = new Map(awards.map((award) => [award.songId, award]));

  function scoreboardDesktop(songs: FinalistResult[]) {
    const splitIndex = Math.ceil(songs.length / 2);
    const [leftColumn, rightColumn] = [songs.slice(0, splitIndex), songs.slice(splitIndex)];
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

  function scoreboardMobile(songs: FinalistResult[]) {
    const splitIndex = Math.ceil(songs.length / 3);
    const [leftColumn, centerColumn, rightColumn] = [songs.slice(0, splitIndex), songs.slice(splitIndex, splitIndex * 2), songs.slice(splitIndex * 2)];
    return (
      <div className="nightScoreboard">
        <div>{leftColumn.map((song, index) => renderCard(song, index))}</div>
        <div>{centerColumn.map((song, index) => renderCard(song, leftColumn.length + index))}</div>
        <div>
          {rightColumn.map((song, index) =>
            renderCard(song, leftColumn.length + centerColumn.length + index),
          )}
        </div>
      </div>
    );
  }

  function renderCard(song: FinalistResult, index: number) {
    const award = awardBySongId.get(song.id);
    return (
      <article
        key={song.id}
        ref={(node) => registerCard(song.id, node)}
        className={[
          "nightScoreboardCard",
          activeSongId === song.id && !highlightedSongIds.has(song.id)
            ? "active"
            : "",
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
        <img alt="" src={song.flagImageUrl} />
        <span className="nightCountry">
          <strong>{song.country}</strong>
          <small>{song.title}</small>
        </span>
        <span className="nightScoreWrap">
          <AnimatedScore
            value={scores[song.id] ?? 0}
            active={Boolean(award)}
            songId={song.id}
            rollDuration={
              slowRollingSongId === song.id
                ? slowRollingDurationMs
                : award
                  ? DEFAULT_SLOW_SCORE_ROLL_MS
                  : 600
            }
          />
          {award ? (
            <em
              className="nightAward"
              style={
                {
                  "--award-delay": `${award.delay}ms`,
                  "--award-flight-duration": `${award.flightDuration ?? 2600}ms`,
                } as CSSProperties
              }
            >
              +{award.points}
            </em>
          ) : null}
          {completedSongIds.has(song.id) ? (
            <span className="nightLock" aria-hidden="true">
              <LockKeyholeOpen
                className="nightLockOpen"
                size={18}
                strokeWidth={2.2}
              />
              <LockKeyhole
                className="nightLockClosed"
                size={18}
                strokeWidth={2.2}
              />
              <span className="nightLockRays" />
            </span>
          ) : null}
        </span>
      </article>
    );
  }

  return (
    isMobile ? scoreboardMobile(songs) : scoreboardDesktop(songs)
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
      <span>+{displayValue}</span>
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
  onBackToSetup,
  onSaveExit,
  showStatisticsAction,
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
  onBackToSetup: () => void;
  onSaveExit: () => void;
  showStatisticsAction: boolean;
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
  const [slowRollingDurationMs, setSlowRollingDurationMs] = useState(
    DEFAULT_SLOW_SCORE_ROLL_MS,
  );
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
  const videoTimeHandlerRef = useRef<(currentTime: number) => void>(() => { });
  const videoEndedHandlerRef = useRef<() => void>(() => { });
  const videoErrorHandlerRef = useRef<() => void>(() => { });

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

  useEffect(() => {
    if (!initialProgressRef.current && phase === "ready") {
      startVoting();
    }
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

  function resetAwardedHighlightsAfterShuffle(songIds: Set<string>) {
    schedule(() => {
      setResettingSongIds(new Set(songIds));
      schedule(() => {
        setHighlightedSongIds((current) => {
          const next = new Set(current);
          songIds.forEach((songId) => next.delete(songId));
          return next;
        });
        setSettledHighlightSongIds((current) => {
          const next = new Set(current);
          songIds.forEach((songId) => next.delete(songId));
          return next;
        });
        setResettingSongIds((current) => {
          const next = new Set(current);
          songIds.forEach((songId) => next.delete(songId));
          return next;
        });
      }, 950);
    }, SCORE_RESHUFFLE_MS + 500);
  }

  function scheduleLowerAwards(
    awardsToSchedule: AwardAnimation[],
    votesToShow: JuryVote[],
    startDelay: number,
  ) {
    const lowerAwardsMergeStartDelay =
      awardsToSchedule.length > 0
        ? startDelay + JURY_AWARD_SCORE_IMPACT_MS
        : startDelay;

    schedule(() => {
      setVisibleJuryVotes((current) => [...current, ...votesToShow]);
      setAwards((current) => [
        ...current,
        ...awardsToSchedule.map((award, index) => ({
          ...award,
          delay: index * JURY_AWARD_STAGGER_MS,
          flightDuration: JURY_AWARD_ANIMATION_MS,
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

  function skipToTelevote() {
    clearScheduled();
    const juryScores = juryScoreSnapshot(songs);
    scoresRef.current = juryScores;
    videoSyncRef.current = undefined;
    setActiveVideo(undefined);
    setCurrentDelegation(undefined);
    setAwards([]);
    setVisibleJuryVotes([]);
    setJuryPanelExiting(false);
    setHighlightedSongIds(new Set());
    setSettledHighlightSongIds(new Set());
    setResettingSongIds(new Set());
    setCenterTwelve(undefined);
    setSlowRollingSongId(undefined);
    setSlowRollingDurationMs(DEFAULT_SLOW_SCORE_ROLL_MS);
    setFrozenOrderIds(undefined);
    setAnimating(false);
    setJuryIndex(juryDelegations.length);
    setScores(juryScores);
    setPhase("televote-intro");
    saveProgress("televote-intro", juryDelegations.length, televoteIndex, juryScores);
  }

  function finishJuryDelegation() {
    const completedIndex = activeJuryIndexRef.current;
    const nextIndex = completedIndex + 1;
    setAwards([]);
    setJuryPanelExiting(true);
    setResettingSongIds(new Set(highlightedSongIds));
    setCenterTwelve(undefined);
    setSlowRollingSongId(undefined);
    setSlowRollingDurationMs(DEFAULT_SLOW_SCORE_ROLL_MS);
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
      schedule(() => setSlowRollingSongId(undefined), 1600);
      schedule(() => setSlowRollingDurationMs(DEFAULT_SLOW_SCORE_ROLL_MS), 1600);
    }, TWELVE_POINT_HOLD_MS + TWELVE_POINT_FLIGHT_MS - 950);

    schedule(() => {
      releaseFrozenScoreboard();
      resetAwardedHighlightsAfterShuffle(
        new Set([
          ...sync.lowerAwards.map((award) => award.songId),
          twelveRecipientId,
        ]),
      );
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

    if (animating) return;

    const pendingTelevoteEntries = televoteSongs
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
          entry.announcedAt >= 0 &&
          !sync.firedSongIds.has(entry.song.id),
      )
      .sort((a, b) => (a.announcedAt ?? 0) - (b.announcedAt ?? 0));
    const dueTelevoteSongs = pendingTelevoteEntries.filter(
      (entry) => currentTime >= Math.max(0, (entry.announcedAt ?? 0) + 1.5),
    );

    dueTelevoteSongs.slice(0, 1).forEach(({ song, index }) => {
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
      ) - 300;

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
        schedule(() => setSlowRollingSongId(undefined), 1600);
        schedule(() => setSlowRollingDurationMs(DEFAULT_SLOW_SCORE_ROLL_MS), 1600);
      }, twelveScoreApplyDelay);

      schedule(() => {
        releaseFrozenScoreboard();
        if (twelveRecipient) {
          resetAwardedHighlightsAfterShuffle(new Set([twelveRecipient.id]));
        }
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
        schedule(() => setSlowRollingSongId(undefined), 1600);
        schedule(() => setSlowRollingDurationMs(DEFAULT_SLOW_SCORE_ROLL_MS), 1600);
        releaseFrozenScoreboard();
        resetAwardedHighlightsAfterShuffle(new Set([twelveRecipient.id]));
      }, fallbackTwelveApplyDelay);
    }

    if (!videoMode) {
      const batchApplyDelay =
        lowerAwardsMergeStartDelay +
        Math.max(0, nextAwards.length - 1) * JURY_AWARD_MERGE_STAGGER_MS +
        JURY_AWARD_REMOVE_AFTER_MERGE_MS;
      schedule(() => {
        releaseFrozenScoreboard();
        resetAwardedHighlightsAfterShuffle(
          new Set(nextAwards.map((award) => award.songId)),
        );
      }, batchApplyDelay);
    } else if (!videoMode && !twelvePointVote) {
      const batchApplyDelay =
        lowerAwardsMergeStartDelay +
        Math.max(0, nextAwards.length - 1) * JURY_AWARD_MERGE_STAGGER_MS +
        JURY_AWARD_REMOVE_AFTER_MERGE_MS;
      schedule(() => {
        releaseFrozenScoreboard();
        resetAwardedHighlightsAfterShuffle(
          new Set(nextAwards.map((award) => award.songId)),
        );
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

    schedule(() => {
      setCenterTelevote({
        points,
        flying: true,
        target: scoreTargetForSong(song.id),
      });
    }, flyDelay);

    schedule(() => {
      setCenterTelevote(undefined);
      const rollDuration = televoteScoreRollDuration(points);
      setSlowRollingDurationMs(rollDuration);
      setSlowRollingSongId(song.id);
      setHighlightedSongIds(new Set([song.id]));
      schedule(() => {
        setSettledHighlightSongIds((current) => new Set(current).add(song.id));
      }, 980);
      applyScores((current) => ({
        ...current,
        [song.id]: (current[song.id] ?? 0) + points,
      }));
      schedule(() => {
        setSlowRollingSongId(undefined);
        setSlowRollingDurationMs(DEFAULT_SLOW_SCORE_ROLL_MS);
      }, rollDuration + 120);
    }, scoreApplyDelay);

    schedule(() => {
      setResettingSongIds(new Set([song.id]));
    }, scoreApplyDelay + SCORE_RESHUFFLE_MS + 500);

    schedule(() => {
      setAwards([]);
      setHighlightedSongIds(new Set());
      setSettledHighlightSongIds(new Set());
      setResettingSongIds(new Set());
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
    }, scoreApplyDelay + SCORE_RESHUFFLE_MS + 1450);
  }

  function processNextTelevote() {
    const song = televoteSongs[televoteIndex];
    if (!song || animating) return;
    runTelevoteAnimation(song, televoteIndex);
  }

  const hideJuryTwelveInPanel =
    phase === "jury" &&
    useResultsVideo &&
    juryVideoSegment === "twelve-point";

  const handleSaveAndExit = () => {
    saveProgress(phase, juryIndex, televoteIndex);
    onSaveExit();
  };
  return (
    <div className="resultsNight">
      <ResultsNightHeader
        phase={phase}
        juryIndex={juryIndex}
        juryDelegations={juryDelegations}
        activeTelevoteSongId={activeTelevoteSongId}
        televoteSongs={televoteSongs}
        completedTelevoteIds={completedTelevoteIds}
        onBackToSetup={onBackToSetup}
        onSaveExit={handleSaveAndExit}
        hasTelevote={hasTelevote}
        skipToTelevote={skipToTelevote}
        animating={animating}
        processNextJuryDelegation={processNextJuryDelegation}
        autoAdvanceJury={autoAdvanceJury}
        continueAfterJury={continueAfterJury}
        beginTelevote={beginTelevote}
        televoteVideoEnabled={televoteVideoEnabled}
        processNextTelevote={processNextTelevote}
        activeVideo={activeVideo}
        currentTelevoteSong={currentTelevoteSong}
        showStatisticsAction={showStatisticsAction}
        onShowSummary={onShowSummary}
      />

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
          slowRollingDurationMs={slowRollingDurationMs}
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
  mode = "predictions",
  onOpenResults,
  onOpenPredictions,
}: {
  year: string;
  stage: ContestStage;
  songs: Song[];
  mode?: "predictions" | "results";
  onOpenResults?: (stageKey: ContestStageKey) => void;
  onOpenPredictions?: (stageKey: ContestStageKey) => void;
}) {
  const predictionKey = predictionKeyForStage(year, stage.key);
  const revealSessionKey = savedRevealSessionKey(predictionKey);
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
  const [predictionPromptOpen, setPredictionPromptOpen] = useState(false);
  const [pendingRevealOptions, setPendingRevealOptions] = useState<{
    mode: NonNullable<PredictionState["revealMode"]>;
    useResultsVideo: boolean;
    juryVideoSegment: NonNullable<PredictionState["juryVideoSegment"]>;
    autoAdvanceJury: boolean;
  } | null>(null);
  const [showFinalResultsWarning, setShowFinalResultsWarning] = useState(false);
  const [viewingFinalResults, setViewingFinalResults] = useState(false);
  const [selectedRevealMode, setSelectedRevealMode] =
    useState<NonNullable<PredictionState["revealMode"]>>("instant");
  const [selectedUseResultsVideo, setSelectedUseResultsVideo] = useState(true);
  const [selectedJuryVideoSegment, setSelectedJuryVideoSegment] =
    useState<NonNullable<PredictionState["juryVideoSegment"]>>("twelve-point");
  const [selectedAutoAdvanceJury, setSelectedAutoAdvanceJury] = useState(false);
  const [instantAnimationComplete, setInstantAnimationComplete] =
    useState(false);

  useEffect(() => {
    let active = true;
    setState(emptyPredictionState(predictionKey));
    setRevealModeOpen(false);
    setResumePromptOpen(false);
    setPredictionPromptOpen(false);
    setPendingRevealOptions(null);
    setShowFinalResultsWarning(false);
    setViewingFinalResults(false);
    setInstantAnimationComplete(false);

    async function loadSaved() {
      try {
        const saved = await loadPrediction(predictionKey);
        if (!active) return;
        const loadedState = saved ?? emptyPredictionState(predictionKey);
        const hasExplicitSavedSession =
          mode === "results" &&
          localStorage.getItem(revealSessionKey) === "true" &&
          loadedState.revealMode === "eurovision-night" &&
          Boolean(loadedState.revealStartedAt) &&
          Boolean(loadedState.finalsRevealProgress) &&
          !loadedState.summaryViewedAt;
        const nextState =
          loadedState.revealStartedAt && !hasExplicitSavedSession
            ? stripRevealState(loadedState)
            : loadedState;

        setState(nextState);
        setResumePromptOpen(hasExplicitSavedSession);
        if (loadedState !== nextState) {
          localStorage.removeItem(revealSessionKey);
          void savePrediction(nextState).catch(() => undefined);
        }
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
  }, [mode, predictionKey, revealSessionKey]);

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
  const hasLockedPrediction = Boolean(
    state.lockedAt && state.selectedSongIds.length > 0,
  );
  const metricsPredictedIds = hasLockedPrediction ? predictedIds : [];
  const revealedSet = new Set(revealedIds);
  const nextRevealId = (state.revealOrderIds ?? revealOrderIds).find(
    (songId) => !revealedSet.has(songId),
  );
  const revealComplete =
    Boolean(state.revealStartedAt) && revealedIds.length >= finalists.length;
  const showStatisticsButton =
    hasLockedPrediction &&
    revealComplete &&
    !state.summaryViewedAt &&
    (state.revealMode !== "instant" || instantAnimationComplete);
  const summaryVisible = revealComplete && Boolean(state.summaryViewedAt);
  const predictedPlaceById = new Map(
    metricsPredictedIds.map((songId, index) => [songId, index + 1]),
  );
  const liveMetrics = placementMetrics(
    metricsPredictedIds,
    officialResults,
    revealedIds,
  );
  const summary = finalPlacementSummary(metricsPredictedIds, officialResults);

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
    if (
      !state.lockedAt &&
      localStorage.getItem("eurovision-ranker:skip-prediction-first-prompt") !==
      "true"
    ) {
      setPendingRevealOptions({
        mode,
        useResultsVideo,
        juryVideoSegment,
        autoAdvanceJury,
      });
      setPredictionPromptOpen(true);
      return;
    }

    commitReveal({ mode, useResultsVideo, juryVideoSegment, autoAdvanceJury });
  }

  function commitReveal({
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
    localStorage.removeItem(revealSessionKey);
    const nextRevealOrder = state.revealOrderIds ?? revealOrderIds;
    void persist({
      ...state,
      selectedSongIds: state.lockedAt ? predictedIds : state.selectedSongIds,
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
    setPredictionPromptOpen(false);
    setPendingRevealOptions(null);
  }

  function resetRevealState() {
    localStorage.removeItem(revealSessionKey);
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
    setViewingFinalResults(false);
    setInstantAnimationComplete(false);
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
    localStorage.removeItem(revealSessionKey);
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
    state.revealStartedAt &&
    state.revealMode === "eurovision-night" &&
    !summaryVisible;
  const resumeProgress = state.finalsRevealProgress;
  const showingSavedResumePrompt = Boolean(resumePromptOpen && resumeProgress);
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
          <h2>
            {mode === "results"
              ? "Grand Final Results"
              : "Predict the Official Final Results"}
          </h2>
          <p>
            {mode === "results"
              ? "Choose how to reveal the official grand final standings."
              : "Arrange the finalists in the order you believe Eurovision will finish."}
          </p>
        </div>
        {state.lockedAt && mode === "predictions" ? (
          <div className="placementHeaderActions">
            <button
              className="secondaryButton"
              type="button"
              onClick={unlockPrediction}
            >
              <LockKeyholeOpen size={16} /> Change Predictions
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

      {mode === "results" &&
        hasOfficialResults &&
        (!state.revealStartedAt || showingSavedResumePrompt) ? (
        <div className="revealSetupPanel">
          <RevealModeFields
            selectedMode={selectedRevealMode}
            onSelectedModeChange={setSelectedRevealMode}
            useResultsVideo={selectedUseResultsVideo}
            onUseResultsVideoChange={setSelectedUseResultsVideo}
            juryVideoSegment={selectedJuryVideoSegment}
            onJuryVideoSegmentChange={setSelectedJuryVideoSegment}
            autoAdvanceJury={selectedAutoAdvanceJury}
            onAutoAdvanceJuryChange={setSelectedAutoAdvanceJury}
            showGrandFinalOptions
          />
          <div className="predictionFooter">
            <button
              className="primaryButton"
              type="button"
              onClick={() =>
                startReveal({
                  mode: selectedRevealMode,
                  useResultsVideo:
                    selectedRevealMode === "eurovision-night" &&
                    selectedUseResultsVideo,
                  juryVideoSegment: selectedJuryVideoSegment,
                  autoAdvanceJury:
                    selectedRevealMode === "eurovision-night" &&
                    selectedAutoAdvanceJury,
                })
              }
            >
              View Results
            </button>
          </div>
        </div>
      ) : null}

      {mode === "results" && viewingFinalResults ? (
        <div className="placementReveal">
          <div className="resultsDetailActions">
            <button
              className="secondaryButton"
              type="button"
              onClick={resetRevealState}
            >
              Back to Results Setup
            </button>
          </div>
          <div className="placementRevealHeader">
            <div>
              <h3>Official Results</h3>
              <p>All placements revealed.</p>
            </div>
          </div>
          {hasLockedPrediction ? (
            <div className="placementStatsGrid">
              <section>
                <span>Exact Placements Predicted</span>
                <strong>{summary.metrics.exact}</strong>
              </section>
              <section>
                <span>Average Error</span>
                <strong>{summary.metrics.averageError.toFixed(1)}</strong>
              </section>
              <section>
                <span>Current Accuracy</span>
                <strong>{summary.metrics.currentAccuracy}%</strong>
              </section>
            </div>
          ) : null}
          <PlacementScoreboard
            songs={officialResults}
            revealedIds={new Set(revealOrderIds)}
            predictedPlaceById={predictedPlaceById}
            revealOrderIds={revealOrderIds}
            showPredictionComparison={hasLockedPrediction}
          />
        </div>
      ) : mode === "predictions" ? (
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
                  onClick={() => onOpenResults?.(stage.key)}
                >
                  Go To Grand Final Results
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
      ) : showingSavedResumePrompt ? null : !state.revealStartedAt && mode === "results" ? null : summaryVisible ? (
        <div className="predictionSummary placementSummary">
          {hasLockedPrediction ? (
            <>
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
            </>
          ) : (
            <>
              <h3>Final Results</h3>
              <PlacementScoreboard
                songs={officialResults}
                revealedIds={new Set(revealOrderIds)}
                predictedPlaceById={predictedPlaceById}
                revealOrderIds={revealOrderIds}
                showPredictionComparison={false}
              />
            </>
          )}
        </div>
      ) : state.revealMode === "eurovision-night" ? (
        showingSavedResumePrompt ? null : (
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
            onBackToSetup={resetRevealState}
            onSaveExit={() => {
              localStorage.setItem(revealSessionKey, "true");
              setResumePromptOpen(true);
            }}
            showStatisticsAction={hasLockedPrediction}
            onShowSummary={() => {
              localStorage.removeItem(revealSessionKey);
              void persist({
                ...state,
                finalsRevealProgress: undefined,
                summaryViewedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }}
          />
        )
      ) : (
        <div className="placementReveal">
          <div className="resultsDetailActions">
            <button
              className="secondaryButton"
              type="button"
              onClick={resetRevealState}
            >
              Back to Results Setup
            </button>
          </div>
          <div className="placementRevealHeader">
            <div>
              <h3>Official Results</h3>
              <p>
                Placements Revealed: {revealedIds.length} / {finalists.length}
              </p>
            </div>
            {hasLockedPrediction ? (
              <div>
                <span>Average Prediction Error</span>
                <strong>
                  {revealedIds.length
                    ? liveMetrics.averageError.toFixed(1)
                    : "Hidden"}
                </strong>
              </div>
            ) : null}
          </div>

          <div className="placementStatsGrid">
            {hasLockedPrediction ? (
              <>
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
              </>
            ) : null}
          </div>

          <PlacementScoreboard
            songs={officialResults}
            revealedIds={revealedSet}
            predictedPlaceById={predictedPlaceById}
            revealOrderIds={state.revealOrderIds ?? revealOrderIds}
            showPredictionComparison={hasLockedPrediction}
          />

          <div className="predictionFooter">
            {showStatisticsButton ||
              (state.revealMode === "step" && !revealComplete) ? (
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
      {showingSavedResumePrompt ? (
        <div
          className="spoilerModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-final-reveal-title"
        >
          <div className="spoilerBackdrop" />
          <section className="spoilerDialog">
            <h2 id="resume-final-reveal-title">Resume Final Reveal?</h2>
            <p>You have a saved Eurovision Results Night in progress.</p>
            <div className="spoilerActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  resetRevealState();
                  setResumePromptOpen(false);
                }}
              >
                Start Over
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  resetRevealState();
                  setResumePromptOpen(false);
                }}
              >
                Change Reveal Settings
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => setResumePromptOpen(false)}
              >
                Resume
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {predictionPromptOpen ? (
        <div
          className="spoilerModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prediction-first-title"
        >
          <div className="spoilerBackdrop" />
          <section className="spoilerDialog">
            <h2 id="prediction-first-title">Want to Make Predictions First?</h2>
            <p>
              If you make predictions before viewing results, the app can show
              accuracy statistics after the reveal.
            </p>
            <label className="spoilerCheckbox">
              <input
                type="checkbox"
                onChange={(event) => {
                  if (event.target.checked) {
                    localStorage.setItem(
                      "eurovision-ranker:skip-prediction-first-prompt",
                      "true",
                    );
                  } else {
                    localStorage.removeItem(
                      "eurovision-ranker:skip-prediction-first-prompt",
                    );
                  }
                }}
              />
              Don't show this again
            </label>
            <div className="spoilerActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  setPredictionPromptOpen(false);
                  setPendingRevealOptions(null);
                  onOpenPredictions?.(stage.key);
                }}
              >
                Take Me To Predictions
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => {
                  if (pendingRevealOptions) {
                    commitReveal(pendingRevealOptions);
                    return;
                  }
                  setPredictionPromptOpen(false);
                  setViewingFinalResults(true);
                }}
              >
                Continue To Results
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {showFinalResultsWarning ? (
        <div
          className="spoilerModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="final-results-warning-title"
        >
          <div className="spoilerBackdrop" />
          <section className="spoilerDialog">
            <h2 id="final-results-warning-title">Reveal all results?</h2>
            <p>This will immediately reveal all results and placements.</p>
            <div className="spoilerActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => setShowFinalResultsWarning(false)}
              >
                Cancel
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => {
                  setShowFinalResultsWarning(false);
                  if (
                    !state.lockedAt &&
                    localStorage.getItem(
                      "eurovision-ranker:skip-prediction-first-prompt",
                    ) !== "true"
                  ) {
                    setPendingRevealOptions(null);
                    setPredictionPromptOpen(true);
                    return;
                  }
                  setViewingFinalResults(true);
                }}
              >
                Reveal Results
              </button>
            </div>
          </section>
        </div>
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

export default function PredictionPanel({
  year,
  songs,
  mode = "predictions",
  initialStageKey,
  onOpenResults,
  onOpenPredictions,
}: PredictionPanelProps) {
  const stages = useMemo(() => predictionStagesForYear(Number(year)), [year]);
  const resultsWarningKey = `eurovision-ranker:hide-results-warning:${year}`;
  const [activeStageKey, setActiveStageKey] = useState<ContestStageKey>(
    initialStageKey ?? stages[0]?.key ?? "semi-final-1",
  );
  const [resultsWarningOpen, setResultsWarningOpen] = useState(false);
  const [dontShowResultsWarning, setDontShowResultsWarning] = useState(false);
  const activeStage =
    stages.find((stage) => stage.key === activeStageKey) ?? stages[0];

  useEffect(() => {
    setActiveStageKey(initialStageKey ?? stages[0]?.key ?? "semi-final-1");
  }, [year, stages[0]?.key, initialStageKey]);

  useEffect(() => {
    if (
      mode === "results" &&
      localStorage.getItem(resultsWarningKey) !== "true"
    ) {
      setResultsWarningOpen(true);
    } else {
      setResultsWarningOpen(false);
    }
  }, [mode, resultsWarningKey]);

  function closeResultsWarning() {
    if (dontShowResultsWarning) {
      localStorage.setItem(resultsWarningKey, "true");
    }
    setResultsWarningOpen(false);
    setDontShowResultsWarning(false);
  }

  function stageTabLabel(stage: ContestStage) {
    if (mode === "results" && stage.key === "grand-final") {
      return "Grand Final Results";
    }
    return `${stage.label} ${mode === "results" ? "Results" : "Predictions"}`;
  }

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
      <div className={resultsWarningOpen ? "stageContent blurred" : ""}>
        <nav
          className="stageTabs"
          aria-label={`${year} ${mode === "results" ? "results" : "prediction"} stages`}
        >
          {stages.map((stage) => (
            <button
              key={stage.key}
              className={stage.key === activeStage.key ? "selected" : ""}
              type="button"
              onClick={() => setActiveStageKey(stage.key)}
            >
              {stageTabLabel(stage)}
            </button>
          ))}
        </nav>
        {activeStage.key === "grand-final" ? (
          <PlacementPredictionPanel
            key={activeStage.key}
            year={year}
            stage={activeStage}
            songs={songs}
            mode={mode}
            onOpenResults={onOpenResults}
            onOpenPredictions={onOpenPredictions}
          />
        ) : (
          <PredictionStagePanel
            key={activeStage.key}
            year={year}
            stage={activeStage}
            songs={songs}
            mode={mode}
            onOpenResults={onOpenResults}
            onOpenPredictions={onOpenPredictions}
          />
        )}
      </div>
      {resultsWarningOpen ? (
        <div
          className="spoilerModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-warning-title"
        >
          <div className="spoilerBackdrop" />
          <section className="spoilerDialog">
            <h2 id="results-warning-title">Results spoilers ahead</h2>
            <p>Viewing results may reveal qualifiers and placements.</p>
            <label className="spoilerCheckbox">
              <input
                type="checkbox"
                checked={dontShowResultsWarning}
                onChange={(event) =>
                  setDontShowResultsWarning(event.target.checked)
                }
              />
              Don't show this again
            </label>
            <div className="spoilerActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  setResultsWarningOpen(false);
                  setDontShowResultsWarning(false);
                  onOpenPredictions?.(activeStage.key);
                }}
              >
                Take Me Back
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={closeResultsWarning}
              >
                I Understand
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
