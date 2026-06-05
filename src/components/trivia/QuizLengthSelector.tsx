import type { QuizLength } from "../../utils/trivia";

type QuizLengthSelectorProps = {
  eligibleCount: number;
  length: QuizLength;
  onChange: (length: QuizLength) => void;
};

export default function QuizLengthSelector({ eligibleCount, length, onChange }: QuizLengthSelectorProps) {
  const options: { value: QuizLength; label: string; disabled?: boolean }[] = [
    { value: 10, label: "Practice: 10 questions", disabled: eligibleCount < 10 },
    { value: 20, label: "Practice: 20 questions", disabled: eligibleCount < 20 },
    { value: "all", label: `All songs: ${eligibleCount} questions` },
  ];

  return (
    <section className="setupSection">
      <div className="setupSectionHeader">
        <span>4</span>
        <h2>Quiz length</h2>
      </div>
      <div className="quizLengthGrid">
        {options.map((option) => (
          <button
            className={length === option.value ? "selected" : ""}
            type="button"
            key={String(option.value)}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            <strong>{option.label}</strong>
            <span>{option.value === "all" ? "Default" : "Practice mode"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
