import { type CSSProperties, useEffect, useState } from "react";
import ActiveQuizHeader from "../components/trivia/ActiveQuizHeader";
import QuizQuestionCard from "../components/trivia/QuizQuestionCard";
import TriviaResults from "../components/trivia/TriviaResults";
import TriviaSetupPanel from "../components/trivia/TriviaSetupPanel";
import { allSongsBackground } from "../data/years";
import {
  clearTriviaSession,
  loadTriviaSession,
  saveTriviaSession,
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
type SavedTriviaSession = {
  settings: QuizSettings;
  deckSongIds: string[];
  currentIndex: number;
  score: number;
  missedQuestions: {
    questionId: string;
    graded: GradedAnswer;
  }[];
  currentGraded: GradedAnswer | null;
  savedAt: string;
  deck?: TriviaQuestion[];
};

function hydrateSavedSession(session: SavedTriviaSession | null) {
  if (!session) return null;
  const sourceSongs = sourceSongsForSettings(session.settings);
  const songById = new Map(sourceSongs.map((song) => [song.id, song]));
  const sourceDeck =
    session.deckSongIds?.length
      ? session.deckSongIds.flatMap((id) => {
          const song = songById.get(id);
          return song
            ? [buildQuestion(song, session.settings, sourceSongs)]
            : [];
        })
      : session.deck ?? [];

  const questionById = new Map(
    sourceDeck.map((question) => [question.id, question]),
  );
  const missedQuestions = session.missedQuestions.flatMap((missed) => {
    const question = questionById.get(missed.questionId);
    return question ? [{ question, graded: missed.graded }] : [];
  });

  return {
    ...session,
    deck: sourceDeck,
    missedQuestions,
  };
}

function compactTriviaSession({
  settings,
  deck,
  currentIndex,
  score,
  missedQuestions,
  currentGraded,
}: {
  settings: QuizSettings;
  deck: TriviaQuestion[];
  currentIndex: number;
  score: number;
  missedQuestions: MissedQuestion[];
  currentGraded: GradedAnswer | null;
}): SavedTriviaSession {
  return {
    settings,
    deckSongIds: deck.map((question) => question.song.id),
    currentIndex,
    score,
    missedQuestions: missedQuestions.map((missed) => ({
      questionId: missed.question.id,
      graded: missed.graded,
    })),
    currentGraded,
    savedAt: new Date().toISOString(),
  };
}

export default function TriviaPage() {
  const [settings, setSettings] = useState<QuizSettings>(defaultQuizSettings);
  const [mode, setMode] = useState<TriviaMode>("setup");
  const [deck, setDeck] = useState<TriviaQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [missedQuestions, setMissedQuestions] = useState<MissedQuestion[]>([]);
  const [currentGraded, setCurrentGraded] = useState<GradedAnswer | null>(null);
  const [savedSession, setSavedSession] = useState<SavedTriviaSession | null>(null);
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

    async function loadSession() {
      try {
        const session = await loadTriviaSession<SavedTriviaSession>({
          remote: false,
        });
        if (active) setSavedSession(session);
      } catch {
        if (active) setSavedSession(null);
      }
    }

    void loadSession();
    window.addEventListener("profile:changed", loadSession);
    return () => {
      active = false;
      window.removeEventListener("profile:changed", loadSession);
    };
  }, []);

  useEffect(() => {
    if (mode !== "active" || !deck.length) return;

    const session = compactTriviaSession({
      settings,
      deck,
      currentIndex,
      score,
      missedQuestions,
      currentGraded,
    });
    void saveTriviaSession(session, { remote: false })
      .then((saved) => setSavedSession(saved))
      .catch(() => setSavedSession(session));
  }, [currentGraded, currentIndex, deck, missedQuestions, mode, score, settings]);

  function startQuiz() {
    const nextDeck = buildQuizDeck(settings);
    setDeck(nextDeck);
    setCurrentIndex(0);
    setScore(0);
    setMissedQuestions([]);
    setCurrentGraded(null);
    void clearTriviaSession();
    setSavedSession(null);
    setMode(nextDeck.length ? "active" : "setup");
  }

  function retryQuiz() {
    setDeck(buildQuizDeck(settings));
    setCurrentIndex(0);
    setScore(0);
    setMissedQuestions([]);
    setCurrentGraded(null);
    void clearTriviaSession();
    setSavedSession(null);
    setMode("active");
  }

  function backToSetup() {
    setMode("setup");
    setDeck([]);
    setCurrentIndex(0);
    setScore(0);
    setMissedQuestions([]);
    setCurrentGraded(null);
    void clearTriviaSession();
    setSavedSession(null);
  }

  function saveAndExit() {
    if (mode === "active" && deck.length) {
      const session = compactTriviaSession({
        settings,
        deck,
        currentIndex,
        score,
        missedQuestions,
        currentGraded,
      });
      setSavedSession(session);
      void saveTriviaSession(session).then((saved) => setSavedSession(saved));
    }
    setMode("setup");
  }

  async function resumeQuiz() {
    const session =
      savedSession ?? (await loadTriviaSession<SavedTriviaSession>());
    const hydratedSession = hydrateSavedSession(session);
    if (!hydratedSession?.deck.length) return;
    setSettings(hydratedSession.settings);
    setDeck(hydratedSession.deck);
    setCurrentIndex(hydratedSession.currentIndex);
    setScore(hydratedSession.score);
    setMissedQuestions(hydratedSession.missedQuestions);
    setCurrentGraded(hydratedSession.currentGraded);
    setMode("active");
  }

  function discardSavedQuiz() {
    void clearTriviaSession();
    setSavedSession(null);
  }

  async function loadCloudSavedQuiz() {
    const session = await loadTriviaSession<SavedTriviaSession>();
    setSavedSession(session);
  }

  function handleAnswered(graded: GradedAnswer) {
    if (!currentQuestion) return;
    setCurrentGraded(graded);
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
          <p className="eyebrow">Test your knowledge</p>
          <h1>Eurovision Trivia</h1>
          <p>Build a quiz from any year, country, or the full Eurovision dataset.</p>
        </div>

        {mode === "setup" ? (
          <TriviaSetupPanel
            savedAt={savedSession?.savedAt}
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
              answeredCount={score + missedQuestions.length}
              currentIndex={currentIndex}
              score={score}
              settings={settings}
              total={deck.length}
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
            total={deck.length}
            onRetry={retryQuiz}
            onSetup={backToSetup}
          />
        ) : null}
      </section>
    </main>
  );
}
