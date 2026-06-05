import { useEffect, useMemo, useRef, useState } from "react";
import QuizMediaPlayer from "../QuizMediaPlayer";
import {
  gradeChoice,
  gradeTypedAnswer,
  isTypingFormat,
  specialCharactersForQuestion,
  type AnswerPartKey,
  type GradedAnswer,
  type TriviaChoice,
  type TriviaQuestion,
} from "../../utils/trivia";
import AnswerFeedback from "./AnswerFeedback";
import SpecialCharacterHelper from "./SpecialCharacterHelper";
import StyledDropdown from "./StyledDropdown";

type QuizQuestionCardProps = {
  question: TriviaQuestion;
  onAnswered: (graded: GradedAnswer) => void;
  onNext: () => void;
};

type ChoiceButtonProps = {
  choice: TriviaChoice;
  correct: boolean | null;
  disabled: boolean;
  primary: string;
  secondary?: string;
  onPick: (choice: TriviaChoice) => void;
};

function ChoiceButton({ choice, correct, disabled, primary, secondary, onPick }: ChoiceButtonProps) {
  const [flagFailed, setFlagFailed] = useState(false);

  return (
    <button
      className={correct ? "correct" : ""}
      type="button"
      key={`${choice.id}:${choice.label}`}
      disabled={disabled}
      onClick={() => onPick(choice)}
    >
      <span className="choiceFlag" aria-label={`${choice.country} flag`}>
        {!flagFailed && choice.flagImageUrl ? (
          <img src={choice.flagImageUrl} alt="" onError={() => setFlagFailed(true)} />
        ) : (
          <span>{choice.flagEmoji || choice.countryCode}</span>
        )}
      </span>
      <span className="choiceText">
        <strong>{primary}</strong>
        {secondary ? <span>{secondary}</span> : null}
      </span>
    </button>
  );
}

export default function QuizQuestionCard({ question, onAnswered, onNext }: QuizQuestionCardProps) {
  const [typedValues, setTypedValues] = useState<Record<string, string>>({});
  const [graded, setGraded] = useState<GradedAnswer | null>(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const focusedPart = useRef<AnswerPartKey | null>(question.answerParts[0]?.key ?? null);
  const typing = isTypingFormat(question.answerFormat);
  const largeChoiceSet = !typing && question.choices.length > 40;
  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(question.choices.map((choice) => choice.year).filter(Boolean))).sort(
      (a, b) => Number(b) - Number(a),
    );
    return [
      { label: "All years", value: "all", meta: `${question.choices.length} choices` },
      ...years.map((year) => {
        const count = question.choices.filter((choice) => choice.year === year).length;
        return { label: String(year), value: String(year), meta: `${count} choices` };
      }),
    ];
  }, [question.choices]);
  const countryOptions = useMemo(() => {
    const countries = Array.from(
      new Map(question.choices.map((choice) => [choice.country, choice])).values(),
    ).sort((a, b) => a.country.localeCompare(b.country));
    return [
      { label: "All countries", value: "all", meta: `${question.choices.length} choices` },
      ...countries.map((choice) => {
        const count = question.choices.filter((item) => item.country === choice.country).length;
        return { label: choice.country, value: choice.country, meta: `${choice.flagEmoji} ${count} choices` };
      }),
    ];
  }, [question.choices]);
  const filteredChoices = useMemo(
    () =>
      question.choices.filter(
        (choice) =>
          (yearFilter === "all" || String(choice.year) === yearFilter) &&
          (countryFilter === "all" || choice.country === countryFilter),
      ),
    [countryFilter, question.choices, yearFilter],
  );
  const characters = specialCharactersForQuestion(question);

  useEffect(() => {
    setTypedValues({});
    setGraded(null);
    setYearFilter("all");
    setCountryFilter("all");
    focusedPart.current = question.answerParts[0]?.key ?? null;
  }, [question.id, question.answerParts]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" && graded) onNext();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [graded, onNext]);

  function submitChoice(choice: TriviaChoice) {
    if (graded) return;
    const next = gradeChoice(question, choice);
    setGraded(next);
    onAnswered(next);
  }

  function submitTypedAnswer() {
    if (graded) return;
    const next = gradeTypedAnswer(question, typedValues as Record<AnswerPartKey, string>);
    setGraded(next);
    onAnswered(next);
  }

  function insertCharacter(character: string) {
    const key = focusedPart.current ?? question.answerParts[0]?.key;
    if (!key) return;
    setTypedValues((current) => ({ ...current, [key]: `${current[key] ?? ""}${character}` }));
  }

  return (
    <section className="quizQuestionCard">
      <div className="questionIntro">
        <p className="eyebrow">{question.prompt}</p>
        <h2>Name that song</h2>
      </div>

      <QuizMediaPlayer song={question.song} answered={Boolean(graded)} />

      {typing ? (
        <form
          className="typedAnswerForm"
          onSubmit={(event) => {
            event.preventDefault();
            submitTypedAnswer();
          }}
        >
          <div className="typedInstructions">
            <p>Accents and punctuation are optional. For example, "Cest la vie" will match "C'est la vie."</p>
            <p>Spelling still matters, but capitalization does not.</p>
          </div>
          <div className="typedFieldGrid">
            {question.answerParts.map((part) => (
              <label key={part.key}>
                {part.label}
                <input
                  value={typedValues[part.key] ?? ""}
                  onFocus={() => {
                    focusedPart.current = part.key;
                  }}
                  onChange={(event) =>
                    setTypedValues((current) => ({ ...current, [part.key]: event.target.value }))
                  }
                  inputMode={part.key === "year" ? "numeric" : "text"}
                  autoComplete="off"
                  disabled={Boolean(graded)}
                />
              </label>
            ))}
          </div>
          <SpecialCharacterHelper characters={characters} onPick={insertCharacter} />
          <button className="primaryButton" type="submit" disabled={Boolean(graded)}>
            Submit answer
          </button>
        </form>
      ) : (
        <>
          {largeChoiceSet ? (
            <div className="choiceFilters">
              <StyledDropdown label="Year" options={yearOptions} value={yearFilter} onChange={setYearFilter} />
              <StyledDropdown
                label="Country"
                options={countryOptions}
                value={countryFilter}
                onChange={setCountryFilter}
              />
              <span>{filteredChoices.length} choices</span>
            </div>
          ) : null}
          <div className={`multipleChoiceGrid ${largeChoiceSet ? "database" : ""}`}>
            {filteredChoices.map((choice) => {
              const correct = graded && choice.id === question.song.id;
              const primary = choice.title;
              const secondary = `${choice.artist} / ${choice.flagEmoji} ${choice.country}${
                choice.year ? ` / ${choice.year}` : ""
              }`;
              return (
                <ChoiceButton
                  choice={choice}
                  correct={correct}
                  disabled={Boolean(graded)}
                  key={`${choice.id}:${choice.label}`}
                  onPick={submitChoice}
                  primary={primary}
                  secondary={secondary}
                />
              );
            })}
          </div>
        </>
      )}

      {graded ? <AnswerFeedback graded={graded} question={question} onNext={onNext} /> : null}
    </section>
  );
}
