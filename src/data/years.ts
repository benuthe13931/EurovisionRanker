import type { Song, YearData } from "../types";

const modules = import.meta.glob("./years/*.json", {
  eager: true,
  import: "default",
});

export const years: YearData[] = Object.values(modules)
  .map((yearData) => yearData as YearData)
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

export function countrySlug(country: string) {
  return country
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
