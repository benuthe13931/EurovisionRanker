import { AlertCircle, EyeOff, Volume2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Song } from "../types";
import { resolvePreviewMedia } from "../utils/mediaPreview";
import { getYouTubeEmbedUrl } from "../utils/youtube";

type QuizMediaPlayerProps = {
  song: Song;
  answered: boolean;
  autoPlay?: boolean;
  obscureVideoUntilAnswered?: boolean;
};

function stopOtherQuizMedia(current: HTMLMediaElement) {
  document.querySelectorAll<HTMLMediaElement>(".quiz-media audio, .quiz-media video").forEach((element) => {
    if (element !== current) element.pause();
  });
}

export default function QuizMediaPlayer({
  song,
  answered,
  autoPlay = false,
  obscureVideoUntilAnswered = true,
}: QuizMediaPlayerProps) {
  const media = resolvePreviewMedia(song);
  const youtubeEmbedUrl =
    media.kind === "youtube" && media.sourceUrl
      ? getYouTubeEmbedUrl(media.sourceUrl, 14)
      : null;
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const noteId = useId();
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    setStatus("idle");
    const element = mediaRef.current;
    return () => {
      if (element) {
        element.pause();
        element.removeAttribute("src");
        element.load();
      }
    };
  }, [media.sourceUrl]);

  if (media.kind === "none") {
    return (
      <div className="quiz-media quiz-media--empty">
        <AlertCircle size={19} />
        <p className="quiz-media__fallback-note">No preview available for this song.</p>
      </div>
    );
  }

  const obscureVisual = (media.kind === "video" || media.kind === "youtube") && obscureVideoUntilAnswered && !answered;

  return (
    <div className={`quiz-media ${obscureVisual ? "quiz-media--obscured" : ""}`}>
      {media.kind === "audio" ? (
        <audio
          ref={(node) => {
            mediaRef.current = node;
          }}
          className="quiz-media__audio"
          src={media.sourceUrl ?? undefined}
          controls
          autoPlay={autoPlay}
          aria-describedby={noteId}
          onPlay={(event) => stopOtherQuizMedia(event.currentTarget)}
          onLoadStart={() => setStatus("loading")}
          onCanPlay={() => setStatus("ready")}
          onError={() => setStatus("error")}
        />
      ) : media.kind === "youtube" ? (
        <div className="quiz-media__videoShell">
          {youtubeEmbedUrl ? (
            <iframe
              className="quiz-media__video"
              src={youtubeEmbedUrl}
              title="Trivia preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => setStatus("ready")}
              onError={() => setStatus("error")}
            />
          ) : (
            <div className="quiz-media quiz-media--empty">
              <AlertCircle size={19} />
              <p className="quiz-media__fallback-note">Preview could not be loaded.</p>
            </div>
          )}
          {obscureVisual ? (
            <div className="quiz-media__overlay">
              <EyeOff size={20} />
              <strong>Listen to the preview</strong>
              <span>Video hidden until answered</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="quiz-media__videoShell">
          <video
            ref={(node) => {
              mediaRef.current = node;
            }}
            className="quiz-media__video"
            src={media.sourceUrl ?? undefined}
            poster={answered ? song.previewPosterUrl : undefined}
            controls
            autoPlay={autoPlay}
            playsInline
            aria-describedby={noteId}
            onLoadedMetadata={(event) => {
              if (
                typeof song.compareStartSeconds === "number" &&
                Number.isFinite(song.compareStartSeconds) &&
                song.compareStartSeconds > 0
              ) {
                event.currentTarget.currentTime = song.compareStartSeconds;
              }
            }}
            onPlay={(event) => stopOtherQuizMedia(event.currentTarget)}
            onLoadStart={() => setStatus("loading")}
            onCanPlay={() => setStatus("ready")}
            onError={() => setStatus("error")}
          />
          {obscureVisual ? (
            <div className="quiz-media__overlay">
              <EyeOff size={20} />
              <strong>Listen to the preview</strong>
              <span>Video hidden until answered</span>
            </div>
          ) : null}
        </div>
      )}

      <div className="quiz-media__controls" id={noteId}>
        <Volume2 size={17} />
        {status === "error" ? (
          <span>Preview could not be played.</span>
        ) : (media.kind === "video" || media.kind === "youtube") && !answered ? (
          <span>This song only has a video preview, so the visuals are hidden until you answer.</span>
        ) : media.isFallback ? (
          <span>Using the video preview as a temporary fallback.</span>
        ) : (
          <span>{status === "loading" ? "Loading preview..." : "Preview ready"}</span>
        )}
      </div>
    </div>
  );
}
