import { Check, X } from "lucide-react";
import type { GradedAnswer, TriviaQuestion } from "../../utils/trivia";

type AnswerFeedbackProps = {
  graded: GradedAnswer;
  question: TriviaQuestion;
  onNext: () => void;
};

export default function AnswerFeedback({ graded, question, onNext }: AnswerFeedbackProps) {
  return (
    <div className={`answerFeedback ${graded.correct ? "correct" : "wrong"}`}>
      <span className="feedbackIcon">
        {graded.correct ? <Check size={22} /> : <X size={22} />}
      </span>
      <div>
        <strong>{graded.correct ? "Correct" : "Not quite"}</strong>
        <span>
          {question.song.year} / {question.song.country} / {question.song.artist} / {question.song.title}
        </span>
      </div>
      <button className="primaryButton" type="button" onClick={onNext}>
        Next question
      </button>
    </div>
  );
}
