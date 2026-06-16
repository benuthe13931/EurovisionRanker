import { Cloud, Gamepad2, Play, Search, Trash2 } from "lucide-react";
import { allSongs, countries, years } from "../../data/years";
import { useMemo, useState } from "react";
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
  cloudStatus?: string;
  savedAt?: string;
  settings: QuizSettings;
  onChange: (settings: QuizSettings) => void;
  onDiscardSaved: () => void;
  onLoadCloudSaved: () => void;
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

function searchableSongText(song: (typeof allSongs)[number]) {
  return [
    song.title,
    song.artist,
    song.country,
    song.year,
    ...(song.acceptedArtistAnswers ?? []),
    ...(song.acceptedCountryAnswers ?? []),
    ...(song.acceptedTitleAnswers ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function TriviaSetupPanel({
  cloudStatus,
  savedAt,
  settings,
  onChange,
  onDiscardSaved,
  onLoadCloudSaved,
  onResume,
  onStart,
}: TriviaSetupPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const eligibleCount = eligibleSongsForSettings(settings).length;
  const unavailableCount = unavailablePreviewCount(settings);
  const questionCount = settings.length === "all" ? eligibleCount : Math.min(settings.length, eligibleCount);
  const canStart = questionCount > 0;
  const searchResults = useMemo(() => {
    const tokens = searchQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (!tokens.length) return [];

    return allSongs
      .filter((song) => {
        const haystack = searchableSongText(song);
        return tokens.every((token) => haystack.includes(token));
      })
      .slice(0, 12);
  }, [searchQuery]);

  function settingsForScope(scope: QuizScope, nextSettings: Partial<QuizSettings> = {}) {
    const answerFormat = isFormatValidForScope(scope, settings.answerFormat)
      ? settings.answerFormat
      : defaultFormatForScope(scope);

    return {
      ...settings,
      ...nextSettings,
      scope,
      answerFormat,
      length: "all" as const,
    };
  }

  function updateScope(scope: QuizScope) {
    onChange(settingsForScope(scope));
  }

  function updateFormat(answerFormat: AnswerFormat) {
    onChange({ ...settings, answerFormat });
  }

  function updateLength(length: QuizLength) {
    onChange({ ...settings, length });
  }

  function applySongYear(song: (typeof allSongs)[number]) {
    onChange(settingsForScope("year", { year: String(song.year ?? "") }));
    setSearchQuery("");
  }

  function applySongCountry(song: (typeof allSongs)[number]) {
    const country = countries.find(
      (item) =>
        item.countryCode === song.countryCode ||
        item.country.toLowerCase() === song.country.toLowerCase(),
    );
    if (!country) return;
    onChange(settingsForScope("country", { countrySlug: country.slug }));
    setSearchQuery("");
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
            <button className="secondaryButton" type="button" onClick={onLoadCloudSaved}>
              <Cloud size={16} /> Retry Sync
            </button>
            <button className="secondaryButton" type="button" onClick={onDiscardSaved}>
              <Trash2 size={16} /> Discard
            </button>
            <button className="primaryButton" type="button" onClick={onResume}>
              <Play size={16} /> Resume
            </button>
          </div>
        </div>
      ) : (
        <div className="triviaResumeCard">
          <div>
            <strong>Resume from another device</strong>
            <span>Check your signed-in profile for a saved quiz.</span>
          </div>
          <div>
            <button className="secondaryButton" type="button" onClick={onLoadCloudSaved}>
              <Cloud size={16} /> Check Cloud Save
            </button>
          </div>
        </div>
      )}
      {cloudStatus ? <p className="triviaCloudStatus">{cloudStatus}</p> : null}

      <section className="setupSection triviaSearchSection">
        <div className="setupSectionHeader">
          <span>?</span>
          <h2>Find an entry</h2>
        </div>
        <label className="triviaSearchField">
          <Search size={17} />
          <span className="srOnly">Search songs, artists, countries, or years</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search songs, artists, countries, or years..."
            type="search"
          />
        </label>
        {searchQuery.trim() ? (
          <div className="triviaSearchResults">
            {searchResults.length ? (
              searchResults.map((song) => (
                <div className="triviaSearchResult" key={song.id}>
                  <button type="button" onClick={() => applySongYear(song)}>
                    <strong>{song.title}</strong>
                    <span>
                      {song.artist} / {song.country} / {song.year}
                    </span>
                  </button>
                  <button
                    className="triviaSearchScopeButton"
                    type="button"
                    onClick={() => applySongCountry(song)}
                  >
                    Country
                  </button>
                </div>
              ))
            ) : (
              <p>No matching entries found.</p>
            )}
          </div>
        ) : null}
      </section>

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
