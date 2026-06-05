import { type CSSProperties, useEffect, useState } from "react";
import ActiveQuizHeader from "../components/trivia/ActiveQuizHeader";
import QuizQuestionCard from "../components/trivia/QuizQuestionCard";
import TriviaResults from "../components/trivia/TriviaResults";
import TriviaSetupPanel from "../components/trivia/TriviaSetupPanel";
import { allSongsBackground } from "../data/years";
import {
  buildQuizDeck,
  defaultQuizSettings,
  type GradedAnswer,
  type MissedQuestion,
  type QuizSettings,
  type TriviaQuestion,
} from "../utils/trivia";

type TriviaMode = "setup" | "active" | "complete";

export default function TriviaPage() {
  const [settings, setSettings] = useState<QuizSettings>(defaultQuizSettings);
  const [mode, setMode] = useState<TriviaMode>("setup");
  const [deck, setDeck] = useState<TriviaQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [missedQuestions, setMissedQuestions] = useState<MissedQuestion[]>([]);
  const currentQuestion = deck[currentIndex];

  useEffect(() => {
    function handleTriviaSetupRequest() {
      setMode("setup");
    }

    window.addEventListener("trivia:setup", handleTriviaSetupRequest);
    return () => window.removeEventListener("trivia:setup", handleTriviaSetupRequest);
  }, []);

  function startQuiz() {
    const nextDeck = buildQuizDeck(settings);
    setDeck(nextDeck);
    setCurrentIndex(0);
    setScore(0);
    setMissedQuestions([]);
    setMode(nextDeck.length ? "active" : "setup");
  }

  function retryQuiz() {
    setDeck(buildQuizDeck(settings));
    setCurrentIndex(0);
    setScore(0);
    setMissedQuestions([]);
    setMode("active");
  }

  function backToSetup() {
    setMode("setup");
    setDeck([]);
    setCurrentIndex(0);
    setScore(0);
    setMissedQuestions([]);
  }

  function handleAnswered(graded: GradedAnswer) {
    if (!currentQuestion) return;
    if (graded.correct) {
      setScore((current) => current + 1);
      return;
    }

    setMissedQuestions((current) => [...current, { question: currentQuestion, graded }]);
  }

  function nextQuestion() {
    if (currentIndex >= deck.length - 1) {
      setMode("complete");
      return;
    }

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
          <TriviaSetupPanel settings={settings} onChange={setSettings} onStart={startQuiz} />
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
              onSetup={backToSetup}
            />
            <QuizQuestionCard
              key={currentQuestion.id}
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
