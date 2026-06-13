import type { Song, YearData, YearDataInput, YearSongInput } from "../types";
import {
  countryDisplayNameForYear,
  countryEmojiUrlForYear,
  countryFlagImageUrlForYear,
  countrySlug,
  getCountryConfig,
} from "./countries";

const modules = import.meta.glob("./years/*.json", {
  eager: true,
  import: "default",
});

const imageExtensionByYear = new Map<number, string>([
  [1956, "jpg"],
  [1957, "jpg"],
  [1958, "jpg"],
]);

function defaultImageUrl(year: number, songId: string) {
  const extension = imageExtensionByYear.get(year) ?? "jpg.webp";
  return `/assets/images/${year}/${songId}.${extension}`;
}

function normalizeSemiFinal(
  semiFinal: YearSongInput["semiFinal"],
): Song["semiFinal"] {
  return semiFinal === 1 || semiFinal === 2 || semiFinal === "single"
    ? semiFinal
    : undefined;
}

function normalizeSong(
  song: YearSongInput,
  year: number,
  seenIds: Set<string>,
): Song {
  const country = getCountryConfig(song.country, song.countryCode);
  const slug = country?.slug ?? countrySlug(song.country);
  let id = song.id ?? `${year}-${slug}`;

  if (seenIds.has(id)) {
    let suffix = 2;
    while (seenIds.has(`${id}-${suffix}`)) suffix += 1;
    id = `${id}-${suffix}`;
  }
  seenIds.add(id);

  return {
    ...song,
    id,
    country: country ? countryDisplayNameForYear(country, year) : song.country,
    countryCode: country?.countryCode ?? song.countryCode ?? "",
    flagEmoji: song.flagEmoji?.startsWith("/assets/emojis/")
      ? song.flagEmoji
      : country
        ? countryEmojiUrlForYear(country, year)
        : (song.flagEmoji ?? ""),
    flagImageUrl:
      song.flagImageUrl ??
      (country ? countryFlagImageUrlForYear(country, year) : undefined),
    imageUrl: song.imageUrl ?? defaultImageUrl(year, id),
    year,
    semiFinal: normalizeSemiFinal(song.semiFinal),
    qualifiedForFinal: song.qualifiedForFinal,
    qualifiedAnnouncedPosition: song.qualifiedAnnouncedPosition,
    finalPlacement: song.finalPlacement,
  };
}

function normalizeYearData(yearData: YearDataInput): YearData {
  const seenIds = new Set<string>();
  return {
    ...yearData,
    songs: yearData.songs.map((song) =>
      normalizeSong(song, yearData.year, seenIds),
    ),
  };
}

// Template JSON files live beside real years for copy/paste convenience.
// Keep their blank previewVideoUrl and compareStartSeconds placeholders intact.
export const years: YearData[] = Object.entries(modules)
  .filter(([path]) => !path.toLowerCase().includes("template"))
  .map(([, yearData]) => normalizeYearData(yearData as YearDataInput))
  .filter((yearData) => yearData.year > 0)
  .sort((a, b) => b.year - a.year);

export const songsByYear = new Map(
  years.map((year) => [String(year.year), year]),
);

export const allSongs: Song[] = years.flatMap((year) =>
  year.songs.map((song) => ({ ...song, year: year.year })),
);

export type CountryData = {
  slug: string;
  country: string;
  countryCode: string;
  flagEmoji: string;
  flagImageUrl?: string;
  backgroundImage: string;
  songs: Song[];
};

const countriesByCode = new Map<string, CountryData>();

allSongs.forEach((song) => {
  const existing = countriesByCode.get(song.countryCode);

  if (existing) {
    existing.songs.push(song);
    return;
  }

  countriesByCode.set(song.countryCode, {
    slug: countrySlug(song.country),
    country: song.country,
    countryCode: song.countryCode,
    flagEmoji: song.flagEmoji,
    flagImageUrl: song.flagImageUrl,
    backgroundImage: song.imageUrl,
    songs: [song],
  });
});

export const countries: CountryData[] = Array.from(
  countriesByCode.values(),
).sort((a, b) => a.country.localeCompare(b.country));

export const countriesBySlug = new Map(
  countries.map((country) => [country.slug, country]),
);

export const allSongsBackground =
  years[0]?.backgroundImage ?? "https://esc-ratings.eu/assets/hero-bg.webp";

// Add new contests by dropping more JSON files into src/data/years using the
// same shape as 2024.json. Place matching assets under public/assets.
