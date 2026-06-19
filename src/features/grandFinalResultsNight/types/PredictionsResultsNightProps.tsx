import { ResultCountryInput, Song } from "../../../types";

export type EurovisionNightPhase =
    | "ready"
    | "jury"
    | "jury-complete"
    | "televote-intro"
    | "televote"
    | "winner";

export type FinalistResult = Song & {
    result: ResultCountryInput;
    actualPlacement: number;
};

export type ActiveResultVideo = {
    title: string;
    url: string;
    source: "asset" | "youtube";
    start?: number;
    end?: number;
    key: string;
    syncTwelvePointTimestamp?: number;
    syncDelegationEndTime?: number;
    syncTelevoteEndTimestamp?: number;
    fallback?: Omit<ActiveResultVideo, "fallback">;
};

export type ScoreboardSnapshot = Record<string, number>;

export type AwardAnimation = {
    songId: string;
    points: number;
    delay: number;
    flightDuration?: number;
};
