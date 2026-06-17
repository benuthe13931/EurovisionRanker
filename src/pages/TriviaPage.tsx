import { type CSSProperties, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import ActiveQuizHeader from "../components/trivia/ActiveQuizHeader";
import QuizQuestionCard from "../components/trivia/QuizQuestionCard";
import TriviaResults from "../components/trivia/TriviaResults";
import TriviaSetupPanel from "../components/trivia/TriviaSetupPanel";
import { allSongsBackground } from "../data/years";
import {
  clearTriviaSession,
  getTriviaSessionMetadata,
  loadActiveProfile,
  loadLocalTriviaSession,
  loadRemoteTriviaSession,
  saveLocalTriviaSession,
  saveRemoteTriviaSession,
} from "../utils/storage";
import {
  buildQuizDeck,
  buildQuestion,
  defaultQuizSettings,
  sourceSongsForSettings,
  type GradedAnswer,
  type MissedQuestion,
  type QuizSettings,
  type TriviaQuestion,
} from "../utils/trivia";

type TriviaMode = "setup" | "active" | "complete";
type SavedTriviaAnswer = {
  songId: string;
  correct: boolean;
  gradedAnswer: GradedAnswer;
};
type SavedTriviaSession = {
  settings: QuizSettings;
  currentSongId: string | null;
  remainingSongIds: string[];
  completedAnswers: SavedTriviaAnswer[];
  score: number;
  savedAt: string;
  totalCount?: number;
  deckSongIds?: string[];
  currentIndex?: number;
  missedQuestions?: {
    questionId: string;
    graded: GradedAnswer;
  }[];
  currentGraded?: GradedAnswer | null;
};

function hydrateSavedSession(session: SavedTriviaSession | null) {
  if (!session) return null;
  const sourceSongs = sourceSongsForSettings(session.settings);
  const songById = new Map(sourceSongs.map((song) => [song.id, song]));
  const completedSongIds = new Set(
    session.completedAnswers?.map((answer) => answer.songId) ?? [],
  );
  const legacyDeckSongIds =
    session.deckSongIds?.slice(session.currentIndex ?? 0) ?? [];
  const currentSongId =
    session.currentSongId ?? legacyDeckSongIds[0] ?? null;
  const remainingSongIds =
    session.remainingSongIds?.length
      ? session.remainingSongIds
      : legacyDeckSongIds.slice(currentSongId ? 1 : 0);
  const orderedSongIds = [
    ...(currentSongId ? [currentSongId] : []),
    ...remainingSongIds,
  ].filter((songId, index, songIds) => {
    if (index > 0 && completedSongIds.has(songId)) return false;
    return songIds.indexOf(songId) === index;
  });

  const sourceDeck = orderedSongIds.flatMap((id) => {
    const song = songById.get(id);
    return song ? [buildQuestion(song, session.settings, sourceSongs)] : [];
  });

  const questionById = new Map(
    sourceDeck.map((question) => [question.id, question]),
  );
  const missedQuestions = (session.missedQuestions ?? []).flatMap((missed) => {
    const question = questionById.get(missed.questionId);
    return question ? [{ question, graded: missed.graded }] : [];
  });
  const completedMisses = (session.completedAnswers ?? []).flatMap((answer) => {
    if (answer.correct) return [];
    const song = songById.get(answer.songId);
    if (!song) return [];
    return [
      {
        question: buildQuestion(song, session.settings, sourceSongs),
        graded: answer.gradedAnswer,
      },
    ];
  });
  const currentAnswer = (session.completedAnswers ?? []).find(
    (answer) => answer.songId === currentSongId,
  );

  return {
    ...session,
    deck: sourceDeck,
    missedQuestions: completedMisses.length ? completedMisses : missedQuestions,
    currentGraded: currentAnswer?.gradedAnswer ?? session.currentGraded ?? null,
  };
}

function compactTriviaSession({
  settings,
  deck,
  currentIndex,
  score,
  currentGraded,
  completedAnswers,
  totalCount,
  savedAt,
}: {
  settings: QuizSettings;
  deck: TriviaQuestion[];
  currentIndex: number;
  score: number;
  currentGraded: GradedAnswer | null;
  completedAnswers: SavedTriviaAnswer[];
  totalCount: number;
  savedAt: string;
}): SavedTriviaSession {
  const currentQuestion = deck[currentIndex];
  const savedAnswers = currentGraded && currentQuestion
    ? upsertCompletedAnswer(completedAnswers, currentQuestion, currentGraded)
    : completedAnswers;

  return {
    settings,
    currentSongId: currentQuestion?.song.id ?? null,
    remainingSongIds: deck
      .slice(currentIndex + 1)
      .map((question) => question.song.id),
    completedAnswers: savedAnswers,
    score,
    totalCount,
    savedAt,
  };
}

function upsertCompletedAnswer(
  answers: SavedTriviaAnswer[],
  question: TriviaQuestion,
  graded: GradedAnswer,
) {
  const nextAnswer = {
    songId: question.song.id,
    correct: graded.correct,
    gradedAnswer: graded,
  };
  const existingIndex = answers.findIndex(
    (answer) => answer.songId === question.song.id,
  );
  if (existingIndex === -1) return [...answers, nextAnswer];

  return answers.map((answer, index) =>
    index === existingIndex ? nextAnswer : answer,
  );
}

function compareSavedAt(localSavedAt?: string | null, cloudSavedAt?: string | null) {
  const localTime = localSavedAt ? Date.parse(localSavedAt) : Number.NaN;
  const cloudTime = cloudSavedAt ? Date.parse(cloudSavedAt) : Number.NaN;
  return {
    localValid: Number.isFinite(localTime),
    cloudValid: Number.isFinite(cloudTime),
    localTime,
    cloudTime,
  };
}

export default function TriviaPage() {
  const [settings, setSettings] = useState<QuizSettings>(defaultQuizSettings);
  const [mode, setMode] = useState<TriviaMode>("setup");
  const [deck, setDeck] = useState<TriviaQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalQuestionCount, setTotalQuestionCount] = useState(0);
  const [score, setScore] = useState(0);
  const [missedQuestions, setMissedQuestions] = useState<MissedQuestion[]>([]);
  const [completedAnswers, setCompletedAnswers] = useState<SavedTriviaAnswer[]>([]);
  const [currentGraded, setCurrentGraded] = useState<GradedAnswer | null>(null);
  const [savedSession, setSavedSession] = useState<SavedTriviaSession | null>(null);
  const [cloudStatus, setCloudStatus] = useState("");
  const currentQuestion = deck[currentIndex];

  useEffect(() => {
    function handleTriviaSetupRequest() {
      setMode("setup");
    }

    window.addEventListener("trivia:setup", handleTriviaSetupRequest);
    return () => window.removeEventListener("trivia:setup", handleTriviaSetupRequest);
  }, []);

  useEffect(() => {
    let active = true;

    async function syncTriviaSession() {
      const localSession = loadLocalTriviaSession<SavedTriviaSession>();
      if (active) {
        setSavedSession(localSession);
        setCloudStatus(loadActiveProfile() ? "Checking cloud save..." : "");
      }

      if (!loadActiveProfile()) {
        if (active) setCloudStatus("");
        return;
      }

      try {
        const metadata = await getTriviaSessionMetadata();
        if (!active) return;

        if (!metadata.hasSession) {
          setCloudStatus("");
          return;
        }

        const comparison = compareSavedAt(localSession?.savedAt, metadata.savedAt);
        const shouldLoadCloud =
          !localSession ||
          !comparison.localValid ||
          !comparison.cloudValid ||
          comparison.cloudTime > comparison.localTime;

        if (!shouldLoadCloud) {
          setCloudStatus("");
          return;
        }

        try {
          const cloudSession = await loadRemoteTriviaSession<SavedTriviaSession>();
          if (!active) return;

          if (cloudSession) {
            saveLocalTriviaSession(cloudSession);
            setSavedSession(cloudSession);
            setCloudStatus("Cloud save synced.");
            return;
          }

          setCloudStatus("");
        } catch {
          if (!active) return;
          setCloudStatus(
            localSession
              ? "Cloud save appears newer, but could not be loaded. Retry cloud sync before resuming to avoid losing progress."
              : "Could not load cloud save. Try again.",
          );
        }
      } catch {
        if (!active) return;
        setCloudStatus(
          localSession
            ? "Could not check cloud save. Local saved quiz is available, but it may be out of date."
            : "Could not check cloud save. Try again.",
        );
      }
    }

    void syncTriviaSession();
    window.addEventListener("profile:changed", syncTriviaSession);
    return () => {
      active = false;
      window.removeEventListener("profile:changed", syncTriviaSession);
    };
  }, []);

  useEffect(() => {
    if (mode !== "active" || !deck.length) return;

    const session = compactTriviaSession({
      settings,
      deck,
      currentIndex,
      score,
      currentGraded,
      completedAnswers,
      totalCount: totalQuestionCount || deck.length,
      savedAt: new Date().toISOString(),
    });
    setSavedSession(saveLocalTriviaSession(session));
  }, [completedAnswers, currentGraded, currentIndex, deck, mode, score, settings]);

  function startQuiz() {
    const nextDeck = buildQuizDeck(settings);
    setDeck(nextDeck);
    setCurrentIndex(0);
    setTotalQuestionCount(nextDeck.length);
    setScore(0);
    setMissedQuestions([]);
    setCompletedAnswers([]);
    setCurrentGraded(null);
    void clearTriviaSession();
    setSavedSession(null);
    setCloudStatus("");
    setMode(nextDeck.length ? "active" : "setup");
  }

  function retryQuiz() {
    const nextDeck = buildQuizDeck(settings);
    setDeck(nextDeck);
    setCurrentIndex(0);
    setTotalQuestionCount(nextDeck.length);
    setScore(0);
    setMissedQuestions([]);
    setCompletedAnswers([]);
    setCurrentGraded(null);
    void clearTriviaSession();
    setSavedSession(null);
    setCloudStatus("");
    setMode("active");
  }

  function backToSetup() {
    setMode("setup");
    setDeck([]);
    setCurrentIndex(0);
    setTotalQuestionCount(0);
    setScore(0);
    setMissedQuestions([]);
    setCompletedAnswers([]);
    setCurrentGraded(null);
    void clearTriviaSession();
    setSavedSession(null);
    setCloudStatus("");
  }

  function saveAndExit() {
    if (mode === "active" && deck.length) {
      const session = compactTriviaSession({
        settings,
        deck,
        currentIndex,
        score,
        currentGraded,
        completedAnswers,
        totalCount: totalQuestionCount || deck.length,
        savedAt: new Date().toISOString(),
      });
      setSavedSession(session);
      saveLocalTriviaSession(session);
      setCloudStatus(loadActiveProfile() ? "Saving cloud copy..." : "");
      void saveRemoteTriviaSession(session)
        .then(() => setCloudStatus(""))
        .catch(() =>
          setCloudStatus(
            "Saved locally, but cloud save failed. Retry cloud sync before switching devices.",
          ),
        );
    }
    setMode("setup");
  }

  async function resumeQuiz() {
    const session =
      savedSession ?? loadLocalTriviaSession<SavedTriviaSession>();
    const hydratedSession = hydrateSavedSession(session);
    if (!hydratedSession?.deck.length) return;
    setSettings(hydratedSession.settings);
    setDeck(hydratedSession.deck);
    setCurrentIndex(0);
    setTotalQuestionCount(hydratedSession.totalCount ?? hydratedSession.deck.length);
    setScore(hydratedSession.score);
    setMissedQuestions(hydratedSession.missedQuestions);
    setCompletedAnswers(hydratedSession.completedAnswers ?? []);
    setCurrentGraded(hydratedSession.currentGraded);
    setMode("active");
  }

  function discardSavedQuiz() {
    void clearTriviaSession();
    setSavedSession(null);
    setCloudStatus("");
  }

  async function loadCloudSavedQuiz() {
    setCloudStatus("Checking cloud save...");
    try {
      const metadata = await getTriviaSessionMetadata();
      if (!metadata.hasSession) {
        setCloudStatus("No cloud save found.");
        return;
      }

      const session = await loadRemoteTriviaSession<SavedTriviaSession>();
      if (session?.currentSongId || session?.remainingSongIds?.length || session?.deckSongIds?.length) {
        saveLocalTriviaSession(session);
        setSavedSession(session);
        setCloudStatus("Cloud save found.");
        return;
      }
      setCloudStatus("No cloud save found.");
    } catch {
      setCloudStatus("Could not check cloud save. Local resume still works.");
    }
  }

  function handleAnswered(graded: GradedAnswer) {
    if (!currentQuestion || currentGraded) return;
    setCurrentGraded(graded);
    setCompletedAnswers((current) =>
      upsertCompletedAnswer(current, currentQuestion, graded),
    );
    if (graded.correct) {
      setScore((current) => current + 1);
      return;
    }

    setMissedQuestions((current) => [...current, { question: currentQuestion, graded }]);
  }

  function nextQuestion() {
    if (currentIndex >= deck.length - 1) {
      setMode("complete");
      void clearTriviaSession();
      setSavedSession(null);
      setCurrentGraded(null);
      setCompletedAnswers([]);
      return;
    }

    setCurrentGraded(null);
    setCurrentIndex((current) => current + 1);
  }

  return (
    <main
      className="pageShell"
      style={{ "--bg-image": `url(${allSongsBackground})` } as CSSProperties}
    >
      <section className="contentColumn triviaShell">
        <div className="pageHeader">
          <Link className="backButton" to="/">
            <ArrowLeft size={16} /> Back
          </Link>
          <h1>Eurovision Trivia</h1>
          <p>Build a quiz from any year, country, or the full Eurovision dataset.</p>
        </div>

        {mode === "setup" ? (
          <TriviaSetupPanel
            savedAt={savedSession?.savedAt}
            cloudStatus={cloudStatus}
            settings={settings}
            onChange={setSettings}
            onDiscardSaved={discardSavedQuiz}
            onLoadCloudSaved={loadCloudSavedQuiz}
            onResume={resumeQuiz}
            onStart={startQuiz}
          />
        ) : null}

        {mode === "active" && currentQuestion ? (
          <>
            <ActiveQuizHeader
              answeredCount={completedAnswers.length}
              currentIndex={(totalQuestionCount || deck.length) - deck.length + currentIndex}
              score={score}
              settings={settings}
              total={totalQuestionCount || deck.length}
              onRestart={retryQuiz}
              onSaveExit={saveAndExit}
              onSetup={backToSetup}
            />
            <QuizQuestionCard
              key={currentQuestion.id}
              savedGraded={currentGraded}
              question={currentQuestion}
              onAnswered={handleAnswered}
              onNext={nextQuestion}
            />
          </>
        ) : null}

        {mode === "complete" ? (
          <TriviaResults
            missedQuestions={missedQuestions}
            score={score}
            total={totalQuestionCount || deck.length}
            onRetry={retryQuiz}
            onSetup={backToSetup}
          />
        ) : null}
      </section>
    </main>
  );
}
