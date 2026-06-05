import { getYouTubeEmbedUrl } from "../utils/youtube";

type VideoPreviewProps = {
  className?: string;
  onEnded?: () => void;
  onError?: () => void;
  onReady?: () => void;
  startSeconds?: number;
  title: string;
  url: string;
};

export default function VideoPreview({
  className,
  onEnded,
  onError,
  onReady,
  startSeconds,
  title,
  url,
}: VideoPreviewProps) {
  const youtubeEmbedUrl = getYouTubeEmbedUrl(url, startSeconds);
  const isAudioUrl = /\.(aac|flac|m4a|mp3|oga|ogg|opus|wav)(\?|#|$)/i.test(url);

  if (youtubeEmbedUrl) {
    return (
      <iframe
        className={className}
        src={youtubeEmbedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={onReady}
        onError={onError}
      />
    );
  }

  if (isAudioUrl) {
    return (
      <audio
        className={className}
        src={url}
        controls
        autoPlay
        onLoadedMetadata={(event) => {
          if (typeof startSeconds === "number" && Number.isFinite(startSeconds) && startSeconds > 0) {
            event.currentTarget.currentTime = startSeconds;
          }
        }}
        onCanPlay={onReady}
        onEnded={onEnded}
        onError={onError}
      />
    );
  }

  return (
    <video
      className={className}
      src={url}
      controls
      autoPlay
      playsInline
      onLoadedMetadata={(event) => {
        if (typeof startSeconds === "number" && Number.isFinite(startSeconds) && startSeconds > 0) {
          event.currentTarget.currentTime = startSeconds;
        }
      }}
      onCanPlay={onReady}
      onEnded={onEnded}
      onError={onError}
    />
  );
}
