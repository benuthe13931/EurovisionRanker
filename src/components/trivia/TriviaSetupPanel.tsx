import { Gamepad2, Play, Trash2 } from "lucide-react";
import { countries, years } from "../../data/years";
import {
  defaultFormatForScope,
  eligibleSongsForSettings,
  isFormatValidForScope,
  scopeDetail,
  unavailablePreviewCount,
  type AnswerFormat,
  type QuizLength,
  type QuizScope,
  type QuizSettings,
} from "../../utils/trivia";
import AnswerFormatSelector from "./AnswerFormatSelector";
import QuizLengthSelector from "./QuizLengthSelector";
import ScopeSelector from "./ScopeSelector";
import StyledDropdown from "./StyledDropdown";

type TriviaSetupPanelProps = {
  savedAt?: string;
  settings: QuizSettings;
  onChange: (settings: QuizSettings) => void;
  onDiscardSaved: () => void;
  onResume: () => void;
  onStart: () => void;
};

function formatSavedAt(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function TriviaSetupPanel({
  savedAt,
  settings,
  onChange,
  onDiscardSaved,
  onResume,
  onStart,
}: TriviaSetupPanelProps) {
  const eligibleCount = eligibleSongsForSettings(settings).length;
  const unavailableCount = unavailablePreviewCount(settings);
  const questionCount = settings.length === "all" ? eligibleCount : Math.min(settings.length, eligibleCount);
  const canStart = questionCount > 0;

  function updateScope(scope: QuizScope) {
    const answerFormat = isFormatValidForScope(scope, settings.answerFormat)
      ? settings.answerFormat
      : defaultFormatForScope(scope);
    onChange({ ...settings, scope, answerFormat, length: "all" });
  }

  function updateFormat(answerFormat: AnswerFormat) {
    onChange({ ...settings, answerFormat });
  }

  function updateLength(length: QuizLength) {
    onChange({ ...settings, length });
  }

  return (
    <section className="triviaSetupPanel">
      {savedAt ? (
        <div className="triviaResumeCard">
          <div>
            <strong>Saved quiz in progress</strong>
            <span>Saved {formatSavedAt(savedAt)}</span>
          </div>
          <div>
            <button className="secondaryButton" type="button" onClick={onDiscardSaved}>
              <Trash2 size={16} /> Discard
            </button>
            <button className="primaryButton" type="button" onClick={onResume}>
              <Play size={16} /> Resume
            </button>
          </div>
        </div>
      ) : null}

      <ScopeSelector scope={settings.scope} onChange={updateScope} />
      <AnswerFormatSelector scope={settings.scope} format={settings.answerFormat} onChange={updateFormat} />

      <section className="setupSection">
        <div className="setupSectionHeader">
          <span>3</span>
          <h2>Choose dataset</h2>
        </div>
        {settings.scope === "year" ? (
          <StyledDropdown
            label="Year"
            value={settings.year}
            onChange={(year) => onChange({ ...settings, year })}
            options={years.map((year) => ({
              value: String(year.year),
              label: String(year.year),
              meta: `${year.hostCity}, ${year.country}`,
            }))}
          />
        ) : null}

        {settings.scope === "country" ? (
          <StyledDropdown
            label="Country"
            value={settings.countrySlug}
            onChange={(countrySlug) => onChange({ ...settings, countrySlug })}
            options={countries.map((country) => ({
              value: country.slug,
              label: country.country,
              meta: `${country.songs.length} songs`,
            }))}
          />
        ) : null}

        {settings.scope === "expert" ? (
          <div className="datasetSummary">
            <strong>All eligible songs</strong>
            <span>{eligibleCount} playable questions from the full dataset.</span>
          </div>
        ) : null}
        <p className="setupHint">
          {scopeDetail(settings)}
          {unavailableCount ? ` / ${unavailableCount} entries need audioPreviewUrl or local video before they can appear.` : ""}
        </p>
      </section>

      <QuizLengthSelector eligibleCount={eligibleCount} length={settings.length} onChange={updateLength} />

      <div className="triviaSetupFooter">
        <span>{canStart ? `${questionCount} questions` : "No playable preview media in this selection"}</span>
        <button className="primaryButton" type="button" disabled={!canStart} onClick={onStart}>
          <Gamepad2 size={17} /> Start Quiz
        </button>
      </div>
    </section>
  );
}
