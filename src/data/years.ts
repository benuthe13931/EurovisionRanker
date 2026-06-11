import type { Song, YearData, YearDataInput, YearSongInput } from "../types";
import {
  countryEmojiUrl,
  countryFlagImageUrl,
  countrySlug,
  getCountryConfig,
} from "./countries";

const modules = import.meta.glob("./years/*.json", {
  eager: true,
  import: "default",
});

function defaultImageUrl(year: number, countrySlugValue: string) {
  return `/assets/images/${year}/${year}-${countrySlugValue}.jpg.webp`;
}

function normalizeSong(song: YearSongInput, year: number, seenIds: Set<string>): Song {
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
    country: country?.country ?? song.country,
    countryCode: country?.countryCode ?? song.countryCode ?? "",
    flagEmoji: song.flagEmoji?.startsWith("/assets/emojis/")
      ? song.flagEmoji
      : country
        ? countryEmojiUrl(country)
        : (song.flagEmoji ?? ""),
    flagImageUrl: song.flagImageUrl ?? (country ? countryFlagImageUrl(country) : undefined),
    imageUrl: song.imageUrl ?? defaultImageUrl(year, slug),
    year,
  };
}

function normalizeYearData(yearData: YearDataInput): YearData {
  const seenIds = new Set<string>();
  return {
    ...yearData,
    songs: yearData.songs.map((song) => normalizeSong(song, yearData.year, seenIds)),
  };
}

export const years: YearData[] = Object.values(modules)
  .map((yearData) => normalizeYearData(yearData as YearDataInput))
  .sort((a, b) => b.year - a.year);

export const songsByYear = new Map(years.map((year) => [String(year.year), year]));

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

export const countries: CountryData[] = Array.from(countriesByCode.values()).sort((a, b) =>
  a.country.localeCompare(b.country),
);

export const countriesBySlug = new Map(countries.map((country) => [country.slug, country]));

export const allSongsBackground =
  years[0]?.backgroundImage ?? "https://esc-ratings.eu/assets/hero-bg.webp";

// Add new contests by dropping more JSON files into src/data/years using the
// same shape as 2024.json. Place matching assets under public/assets.
