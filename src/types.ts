export type Song = {
  id: string;
  country: string;
  countryCode: string;
  artist: string;
  title: string;
  acceptedArtistAnswers?: string[];
  acceptedCountryAnswers?: string[];
  acceptedTitleAnswers?: string[];
  // URL or ID for a preview video. YouTube links/IDs render as embeds; local MP4s still work.
  previewVideoUrl?: string;
  // Prefer this for trivia/listening games. Falls back to previewVideoUrl while data is being migrated to MP3s.
  audioPreviewUrl?: string;
  previewPosterUrl?: string;
  previewType?: "audio" | "video" | "youtube" | "unknown";
  // Optional start time, in seconds, used only by comparison previews.
  compareStartSeconds?: number;
  flagEmoji: string;
  flagImageUrl?: string;
  imageUrl: string;
  year?: number;
  semiFinal?: "single" | 1 | 2;
  qualifiedForFinal?: boolean | "auto";
  qualifiedAnnouncedPosition?: number;
};

export type SemiFinalInput = Song["semiFinal"] | 0;

export type YearSongInput = Partial<
  Pick<Song, "id" | "countryCode" | "flagEmoji" | "flagImageUrl" | "imageUrl">
> &
  Pick<Song, "artist" | "title"> & {
    country: string;
    acceptedArtistAnswers?: string[];
    acceptedCountryAnswers?: string[];
    acceptedTitleAnswers?: string[];
    previewVideoUrl?: string;
    audioPreviewUrl?: string;
    previewPosterUrl?: string;
    previewType?: "audio" | "video" | "youtube" | "unknown";
    compareStartSeconds?: number;
    semiFinal?: SemiFinalInput;
    qualifiedForFinal?: boolean | "auto";
    qualifiedAnnouncedPosition?: number;
  };

export type ResultCountryInput = {
  country: string;
  placement: number;
  totalPoints?: number;
  juryPoints?: number;
  televotePoints?: number;
  jury?: {
    url?: string;
    delegationStartTime?: number | null;
    twelvePointTimestamp?: number | null;
    delegationEndTime?: number | null;
    votesAwarded?: {
      country: string;
      points: number;
    }[];
  };
  pointsAnnouncedAt?: number | null;
};

export type YearResultData = {
  year: number;
  televote?: {
    url?: string;
    beginTimestamp?: number | null;
    endTimestamp?: number | null;
  };
  countries: ResultCountryInput[];
};

export type YearData = {
  year: number;
  hostCity: string;
  country: string;
  backgroundImage: string;
  songs: Song[];
};

export type YearDataInput = Omit<YearData, "songs"> & {
  songs: YearSongInput[];
};

export type RankingState = {
  key: string;
  songIds: string[];
  updatedAt: string;
};

export type ComparisonMode = "smart";

export type ComparisonState = {
  key: string;
  mode: ComparisonMode;
  sortedIds: string[];
  pendingIds: string[];
  activeId?: string;
  low: number;
  high: number;
  compareAgainstId?: string;
  completed: number;
  targetComparisons: number;
  currentPair?: [string, string];
  updatedAt: string;
};

export type PredictionState = {
  key: string;
  selectedSongIds: string[];
  lockedAt?: string;
  revealMode?: "instant" | "step";
  revealStartedAt?: string;
  revealOrderIds?: string[];
  revealedSongIds: string[];
  summaryViewedAt?: string;
  updatedAt: string;
};
