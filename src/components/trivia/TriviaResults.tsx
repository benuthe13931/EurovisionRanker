import type { MissedQuestion } from "../../utils/trivia";

type TriviaResultsProps = {
  missedQuestions: MissedQuestion[];
  score: number;
  total: number;
  onRetry: () => void;
  onSetup: () => void;
};

export default function TriviaResults({
  missedQuestions,
  score,
  total,
  onRetry,
  onSetup,
}: TriviaResultsProps) {
  const percentage = total ? Math.round((score / total) * 100) : 0;

  return (
    <section className="triviaResultsPanel">
      <div className="resultsHero">
        <p className="eyebrow">Quiz complete</p>
        <h2>{score} / {total}</h2>
        <span>{percentage}% correct</span>
      </div>

      <div className="resultsActions">
        <button className="primaryButton" type="button" onClick={onRetry}>Retry same quiz</button>
        <button className="secondaryButton" type="button" onClick={onSetup}>Back to Trivia Setup</button>
      </div>

      <div className="missedQuestions">
        <h3>Missed questions</h3>
        {missedQuestions.length ? (
          <ul>
            {missedQuestions.map(({ question, graded }) => (
              <li key={question.id}>
                <strong>{question.answerLabel}</strong>
                <span>Your answer: {graded.userAnswerLabel}</span>
                <em>
                  {question.song.year} / {question.song.country} / {question.song.artist} / {question.song.title}
                </em>
              </li>
            ))}
          </ul>
        ) : (
          <p>No misses. Clean sweep.</p>
        )}
      </div>
    </section>
  );
}
