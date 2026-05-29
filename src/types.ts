export type Song = {
  id: string;
  country: string;
  countryCode: string;
  artist: string;
  title: string;
  // URL or ID for a preview video. YouTube links/IDs render as embeds; local MP4s still work.
  previewVideoUrl?: string;
  // Optional start time, in seconds, used only by comparison previews.
  compareStartSeconds?: number;
  flagEmoji: string;
  flagImageUrl?: string;
  imageUrl: string;
  year?: number;
};

export type YearData = {
  year: number;
  hostCity: string;
  country: string;
  backgroundImage: string;
  songs: Song[];
};

export type RankingState = {
  key: string;
  songIds: string[];
  updatedAt: string;
};

export type ComparisonMode = "smart" | "full";

export type ComparisonState = {
  key: string;
  mode: ComparisonMode;
  ratings: Record<string, number>;
  comparedPairs: string[];
  completed: number;
  targetComparisons: number;
  fullPairs?: [string, string][];
  currentPair?: [string, string];
  updatedAt: string;
};
