import type { QuizScope } from "../../utils/trivia";

type ScopeSelectorProps = {
  scope: QuizScope;
  onChange: (scope: QuizScope) => void;
};

const scopes: { value: QuizScope; label: string; description: string }[] = [
  {
    value: "year",
    label: "By Year",
    description: "Pick one contest year and identify entries from that final/year.",
  },
  {
    value: "country",
    label: "By Country",
    description: "Pick one country and identify entries across years.",
  },
  {
    value: "expert",
    label: "Expert",
    description: "Use the full dataset with multi-part answers.",
  },
];

export default function ScopeSelector({ scope, onChange }: ScopeSelectorProps) {
  return (
    <section className="setupSection">
      <div className="setupSectionHeader">
        <span>1</span>
        <h2>Choose quiz scope</h2>
      </div>
      <div className="scopeCards">
        {scopes.map((item) => (
          <button
            className={scope === item.value ? "selected" : ""}
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
