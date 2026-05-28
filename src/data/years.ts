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

export const allSongsBackground =
  years[0]?.backgroundImage ?? "https://esc-ratings.eu/assets/hero-bg.webp";

// Add new contests by dropping more JSON files into src/data/years using the
// same shape as 2024.json. Place matching assets under public/assets.
