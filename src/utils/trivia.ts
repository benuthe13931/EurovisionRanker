import { allSongs, countries, years } from "../data/years";
import type { Song } from "../types";
import { resolvePreviewMedia } from "./mediaPreview";

export type QuizScope = "year" | "country" | "expert";

export type AnswerFormat =
  | "mc-country"
  | "mc-year"
  | "mc-song-artist"
  | "mc-country-song-artist"
  | "mc-year-song-artist"
  | "mc-mixed"
  | "type-country"
  | "type-year"
  | "type-title"
  | "type-title-artist"
  | "type-year-country"
  | "type-country-title"
  | "type-year-title"
  | "type-country-title-artist";

export type QuizLength = 10 | 20 | "all";

export type QuizSettings = {
  scope: QuizScope;
  answerFormat: AnswerFormat;
  year: string;
  countrySlug: string;
  length: QuizLength;
};

export type AnswerPartKey = "artist" | "country" | "title" | "year";

export type AnswerPart = {
  key: AnswerPartKey;
  label: string;
  expected: string;
  accepted: string[];
};

export type TriviaChoice = {
  id: string;
  artist: string;
  country: string;
  countryCode: string;
  flagEmoji: string;
  flagImageUrl?: string;
  label: string;
  secondary?: string;
  title: string;
  year?: number;
};

export type TriviaQuestion = {
  id: string;
  answerFormat: AnswerFormat;
  song: Song;
  prompt: string;
  answerLabel: string;
  answerParts: AnswerPart[];
  choices: TriviaChoice[];
};

export type GradedPart = AnswerPart & {
  userAnswer: string;
  correct: boolean;
};

export type GradedAnswer = {
  correct: boolean;
  userAnswerLabel: string;
  parts: GradedPart[];
};

export type MissedQuestion = {
  question: TriviaQuestion;
  graded: GradedAnswer;
};

export const defaultQuizSettings: QuizSettings = {
  scope: "year",
  answerFormat: "mc-mixed",
  year: String(years[0]?.year ?? ""),
  countrySlug: countries[0]?.slug ?? "",
  length: "all",
};

export const answerFormatsByScope: Record<QuizScope, { value: AnswerFormat; label: string; description: string }[]> = {
  year: [
    { value: "mc-mixed", label: "Multiple Choice", description: "Choose the full matching entry." },
    { value: "type-country", label: "Typing: Country", description: "Type the country name." },
    { value: "type-title", label: "Typing: Song Title", description: "Type the song title." },
  ],
  country: [
    { value: "mc-mixed", label: "Multiple Choice", description: "Choose the full matching entry." },
    { value: "type-country", label: "Typing: Country", description: "Type the country name." },
    { value: "type-title", label: "Typing: Song Title", description: "Type the song title." },
  ],
  expert: [
    { value: "mc-mixed", label: "Multiple Choice", description: "Choose the full matching entry." },
    { value: "type-year-country", label: "Typing: Year + Country", description: "Type the contest year and country." },
    { value: "type-title", label: "Typing: Song Title", description: "Type the song title." },
  ],
};

export function isTypingFormat(format: AnswerFormat) {
  return format.startsWith("type-");
}

export function isFormatValidForScope(scope: QuizScope, format: AnswerFormat) {
  return answerFormatsByScope[scope].some((item) => item.value === format);
}

export function defaultFormatForScope(scope: QuizScope) {
  return answerFormatsByScope[scope][0].value;
}

export function quizScopeLabel(settings: QuizSettings) {
  if (settings.scope === "year") return "By Year";
  if (settings.scope === "country") return "By Country";
  return "Expert";
}

export function answerFormatLabel(format: AnswerFormat) {
  return Object.values(answerFormatsByScope).flat().find((item) => item.value === format)?.label ?? format;
}

export function scopeDetail(settings: QuizSettings) {
  if (settings.scope === "year") {
    const year = years.find((item) => String(item.year) === settings.year);
    return year ? `${year.year} / ${year.hostCity}` : "Choose a year";
  }

  if (settings.scope === "country") {
    const country = countries.find((item) => item.slug === settings.countrySlug);
    return country ? country.country : "Choose a country";
  }

  return "All eligible songs";
}

export function normalizeAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ");
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function sourceSongsForSettings(settings: QuizSettings) {
  if (settings.scope === "year") {
    return years.find((year) => String(year.year) === settings.year)?.songs.map((song) => ({
      ...song,
      year: Number(settings.year),
    })) ?? [];
  }

  if (settings.scope === "country") {
    return countries.find((country) => country.slug === settings.countrySlug)?.songs ?? [];
  }

  return allSongs;
}

export function isSongEligibleForTrivia(song: Song) {
  const media = resolvePreviewMedia(song);
  return media.kind !== "none";
}

export function eligibleSongsForSettings(settings: QuizSettings) {
  return sourceSongsForSettings(settings).filter(isSongEligibleForTrivia);
}

export function unavailablePreviewCount(settings: QuizSettings) {
  return sourceSongsForSettings(settings).filter((song) => {
    const media = resolvePreviewMedia(song);
    return media.kind === "none";
  }).length;
}

function aliasesForPart(song: Song, key: AnswerPartKey) {
  if (key === "title") return song.acceptedTitleAnswers ?? [];
  if (key === "artist") return song.acceptedArtistAnswers ?? [];
  if (key === "country") return song.acceptedCountryAnswers ?? [];
  return [];
}

function partForSong(song: Song, key: AnswerPartKey): AnswerPart {
  const expected = key === "year" ? String(song.year ?? "") : song[key];
  const label = key === "year" ? "Year" : key === "title" ? "Song title" : key[0].toUpperCase() + key.slice(1);

  return {
    key,
    label,
    expected,
    accepted: [expected, ...aliasesForPart(song, key)],
  };
}

function partKeysForFormat(format: AnswerFormat): AnswerPartKey[] {
  if (format === "mc-mixed") return ["year", "country", "title", "artist"];
  if (format === "mc-country" || format === "type-country") return ["country"];
  if (format === "mc-year" || format === "type-year") return ["year"];
  if (format === "type-title") return ["title"];
  if (format === "mc-song-artist" || format === "type-title-artist") return ["title", "artist"];
  if (format === "mc-country-song-artist") return ["country", "title", "artist"];
  if (format === "mc-year-song-artist") return ["year", "title", "artist"];
  if (format === "type-year-country") return ["year", "country"];
  if (format === "type-country-title") return ["country", "title"];
  if (format === "type-year-title") return ["year", "title"];
  return ["country", "title", "artist"];
}

export function answerPartsForSong(song: Song, format: AnswerFormat) {
  return partKeysForFormat(format).map((key) => partForSong(song, key));
}

export function answerLabelForParts(parts: AnswerPart[]) {
  return parts.map((part) => part.expected).join(" / ");
}

function choiceForSong(song: Song, format: AnswerFormat, answered = false): TriviaChoice {
  const baseChoice = {
    id: song.id,
    artist: song.artist,
    country: song.country,
    countryCode: song.countryCode,
    flagEmoji: song.flagEmoji,
    flagImageUrl: song.flagImageUrl,
    title: song.title,
    year: song.year,
  };

  if (format === "mc-country") {
    return { ...baseChoice, label: song.country };
  }

  if (format === "mc-year") {
    return { ...baseChoice, label: String(song.year ?? "") };
  }

  if (format === "mc-mixed") {
    return {
      ...baseChoice,
      label: `${song.year} / ${song.country} / ${song.title}`,
      secondary: song.artist,
    };
  }

  if (format === "mc-country-song-artist") {
    return {
      ...baseChoice,
      label: `${song.country} / ${song.title}`,
      secondary: song.artist,
    };
  }

  if (format === "mc-year-song-artist") {
    return {
      ...baseChoice,
      label: `${song.year} / ${song.title}`,
      secondary: song.artist,
    };
  }

  return {
    ...baseChoice,
    label: song.title,
    secondary: answered ? `${song.artist} / ${song.country} / ${song.year ?? ""}` : song.artist,
  };
}

function allChoicesForQuestion(song: Song, settings: QuizSettings, sourceSongs: Song[]) {
  const choicesByAnswer = new Map<string, TriviaChoice>();

  sourceSongs.forEach((item) => {
    const choice = choiceForSong(item, settings.answerFormat);
    const key = `${choice.label} ${choice.secondary ?? ""}`.trim();
    const existing = choicesByAnswer.get(key);
    if (!existing || item.id === song.id) {
      choicesByAnswer.set(key, choice);
    }
  });

  return Array.from(choicesByAnswer.values()).sort((a, b) => {
    const yearSort = (b.year ?? 0) - (a.year ?? 0);
    if (yearSort) return yearSort;
    return a.label.localeCompare(b.label);
  });
}

function promptForFormat(format: AnswerFormat) {
  if (format === "mc-mixed") return "Name the entry";
  if (format === "mc-country" || format === "type-country") return "Name the country";
  if (format === "mc-year" || format === "type-year") return "Name the year";
  if (format === "type-title") return "Name the song title";
  if (format === "mc-song-artist" || format === "type-title-artist") return "Name the song title and artist";
  if (format === "mc-country-song-artist") return "Name the country, song title, and artist";
  if (format === "mc-year-song-artist") return "Name the year, song title, and artist";
  if (format === "type-year-country") return "Name the year and country";
  if (format === "type-country-title") return "Name the country and song title";
  if (format === "type-year-title") return "Name the year and song title";
  return "Name the country, song title, and artist";
}

export function buildQuestion(song: Song, settings: QuizSettings, sourceSongs: Song[]): TriviaQuestion {
  const answerParts = answerPartsForSong(song, settings.answerFormat);
  const choices = isTypingFormat(settings.answerFormat)
    ? []
    : allChoicesForQuestion(song, settings, sourceSongs);

  return {
    id: `${settings.answerFormat}:${song.id}`,
    answerFormat: settings.answerFormat,
    song,
    prompt: promptForFormat(settings.answerFormat),
    answerLabel: answerLabelForParts(answerParts),
    answerParts,
    choices,
  };
}

export function buildQuizDeck(settings: QuizSettings) {
  const sourceSongs = eligibleSongsForSettings(settings);
  const shuffled = shuffle(sourceSongs);
  const selected = settings.length === "all" ? shuffled : shuffled.slice(0, settings.length);
  return selected.map((song) => buildQuestion(song, settings, sourceSongs));
}

export function gradeTypedAnswer(question: TriviaQuestion, values: Record<AnswerPartKey, string>): GradedAnswer {
  const parts = question.answerParts.map((part) => {
    const userAnswer = values[part.key] ?? "";
    const normalizedUserAnswer = normalizeAnswer(userAnswer);
    const correct =
      part.key === "year"
        ? normalizedUserAnswer === normalizeAnswer(part.expected)
        : part.accepted.some((accepted) => normalizeAnswer(accepted) === normalizedUserAnswer);

    return { ...part, userAnswer, correct };
  });

  return {
    correct: parts.every((part) => part.correct),
    userAnswerLabel: parts.map((part) => part.userAnswer || "-").join(" / "),
    parts,
  };
}

export function gradeChoice(question: TriviaQuestion, choice: TriviaChoice): GradedAnswer {
  const correct = choice.id === question.song.id;
  return {
    correct,
    userAnswerLabel: choice.label,
    parts: question.answerParts.map((part) => ({
      ...part,
      userAnswer: correct ? part.expected : choice.label,
      correct,
    })),
  };
}

export function specialCharactersForQuestion(question: TriviaQuestion) {
  return Array.from(
    new Set(
      question.answerParts.flatMap((part) =>
        Array.from(part.expected).filter((char) => /[^\x00-\x7F]/.test(char)),
      ),
    ),
  );
}
