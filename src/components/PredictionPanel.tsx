import { Check, LockKeyhole, RotateCcw, X } from "lucide-react";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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
import type { PredictionState, Song } from "../types";
import FlagEmoji from "./FlagEmoji";

type PredictionPanelProps = {
  year: string;
  songs: Song[];
};

const PREDICTION_SIZE = 10;
const FLYING_DURATION_MS = 1650;

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
      <PredictionStagePanel
        key={activeStage.key}
        year={year}
        stage={activeStage}
        songs={songs}
      />
    </div>
  );
}
