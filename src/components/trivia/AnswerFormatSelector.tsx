import { answerFormatsByScope, type AnswerFormat, type QuizScope } from "../../utils/trivia";

type AnswerFormatSelectorProps = {
  format: AnswerFormat;
  scope: QuizScope;
  onChange: (format: AnswerFormat) => void;
};

export default function AnswerFormatSelector({ format, scope, onChange }: AnswerFormatSelectorProps) {
  return (
    <section className="setupSection">
      <div className="setupSectionHeader">
        <span>2</span>
        <h2>Choose answer format</h2>
      </div>
      <div className="answerFormatGrid">
        {answerFormatsByScope[scope].map((item) => (
          <button
            className={format === item.value ? "selected" : ""}
            type="button"
            key={item.value}
            onClick={() => onChange(item.value)}
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
