import type { Song } from "../types";
import { getYouTubeVideoId } from "./youtube";

export type PreviewMedia = {
  sourceUrl: string | null;
  kind: "audio" | "video" | "youtube" | "none";
  isFallback: boolean;
};

const AUDIO_EXTENSION = /\.(aac|flac|m4a|mp3|oga|ogg|opus|wav)(\?|#|$)/i;
const VIDEO_EXTENSION = /\.(mov|mp4|webm)(\?|#|$)/i;

function inferKind(url: string, declaredType?: Song["previewType"]) {
  if (getYouTubeVideoId(url)) return "youtube";
  if (AUDIO_EXTENSION.test(url)) return "audio";
  if (VIDEO_EXTENSION.test(url)) return "video";
  if (declaredType === "audio" || declaredType === "video" || declaredType === "youtube") {
    return declaredType;
  }
  return "unknown";
}

export function resolvePreviewMedia(song: Song): PreviewMedia {
  if (song.audioPreviewUrl) {
    const kind = inferKind(song.audioPreviewUrl, song.previewType);

    if (kind === "youtube") {
      return { sourceUrl: song.audioPreviewUrl, kind: "youtube", isFallback: false };
    }

    if (kind === "video") {
      return { sourceUrl: song.audioPreviewUrl, kind: "video", isFallback: true };
    }

    return { sourceUrl: song.audioPreviewUrl, kind: "audio", isFallback: false };
  }

  if (song.previewVideoUrl) {
    const kind = inferKind(song.previewVideoUrl, song.previewType);
    if (kind === "youtube") {
      return { sourceUrl: song.previewVideoUrl, kind: "youtube", isFallback: true };
    }

    return { sourceUrl: song.previewVideoUrl, kind: "video", isFallback: true };
  }

  return { sourceUrl: null, kind: "none", isFallback: false };
}
