import { ArrowLeft, RotateCcw } from "lucide-react";
import type { QuizSettings } from "../../utils/trivia";
import { answerFormatLabel, quizScopeLabel, scopeDetail } from "../../utils/trivia";

type ActiveQuizHeaderProps = {
  currentIndex: number;
  answeredCount: number;
  score: number;
  settings: QuizSettings;
  total: number;
  onRestart: () => void;
  onSetup: () => void;
};

export default function ActiveQuizHeader({
  currentIndex,
  answeredCount,
  score,
  settings,
  total,
  onRestart,
  onSetup,
}: ActiveQuizHeaderProps) {
  return (
    <header className="activeQuizHeader">
      <div>
        <p className="eyebrow">
          {quizScopeLabel(settings)} / {answerFormatLabel(settings.answerFormat)}
        </p>
        <h2>Question {Math.min(currentIndex + 1, total)} of {total}</h2>
        <span>{scopeDetail(settings)}</span>
      </div>
      <div className="activeQuizActions">
        {answeredCount > 0 ? <span className="scorePill">Score: {score} correct</span> : null}
        <button className="secondaryButton" type="button" onClick={onSetup}>
          <ArrowLeft size={16} /> Back to Trivia Setup
        </button>
        <button className="secondaryButton" type="button" onClick={onRestart}>
          <RotateCcw size={16} /> Restart Quiz
        </button>
      </div>
    </header>
  );
}
