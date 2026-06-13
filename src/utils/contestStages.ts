import type { Song } from "../types";

export type ContestStageKey =
  | "overall"
  | "semi-final"
  | "semi-final-1"
  | "semi-final-2"
  | "grand-final";

export type ContestStage = {
  key: ContestStageKey;
  label: string;
  spoilerWarning?: boolean;
};

export const GRAND_FINAL_WARNING_KEY =
  "eurovision-ranker:hide-grand-final-warning";

export function grandFinalWarningKeyForYear(year: string) {
  return `${GRAND_FINAL_WARNING_KEY}:${year}`;
}

export function getContestStages(year: number): ContestStage[] {
  if (year <= 2003) return [{ key: "overall", label: "Overall" }];

  if (year <= 2007) {
    return [
      { key: "overall", label: "Overall" },
      { key: "semi-final", label: "Semi-Final" },
      { key: "grand-final", label: "Grand Final", spoilerWarning: true },
    ];
  }

  return [
    { key: "overall", label: "Overall" },
    { key: "semi-final-1", label: "Semi-Final 1" },
    { key: "semi-final-2", label: "Semi-Final 2" },
    { key: "grand-final", label: "Grand Final", spoilerWarning: true },
  ];
}

export function rankingKeyForStage(year: string, stageKey: ContestStageKey) {
  return stageKey === "overall" ? `year:${year}` : `year:${year}:${stageKey}`;
}

export function predictionKeyForStage(year: string, stageKey: ContestStageKey) {
  return `year:${year}:prediction:${stageKey}`;
}

export function predictionStagesForYear(year: number) {
  return getContestStages(year).filter((stage) =>
    stage.key.includes("semi-final"),
  );
}

function qualifiedForGrandFinal(song: Song) {
  return song.qualifiedForFinal !== false;
}

export function isAutoQualifier(song: Song) {
  return song.qualifiedForFinal === "auto";
}

export function isOfficialQualifier(song: Song) {
  return song.qualifiedForFinal !== false && !isAutoQualifier(song);
}

export function songsForContestStage(songs: Song[], stageKey: ContestStageKey) {
  switch (stageKey) {
    case "overall":
      return songs;
    case "semi-final":
      return songs.filter((song) => song.semiFinal === "single");
    case "semi-final-1":
      return songs.filter((song) => song.semiFinal === 1);
    case "semi-final-2":
      return songs.filter((song) => song.semiFinal === 2);
    case "grand-final":
      return songs.filter(qualifiedForGrandFinal);
  }
}
