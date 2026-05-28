import { AlertCircle, Loader2, Pause, Play } from "lucide-react";
import { useAudio } from "./AudioProvider";

type AudioButtonProps = {
  songId: string;
  url: string;
  mode?: "inline" | "modal";
};

export default function AudioButton({ songId, url, mode = "modal" }: AudioButtonProps) {
  const { activeSongId, statusBySong, toggleAudio } = useAudio();
  const status = statusBySong[songId] ?? "idle";
  const isActive = activeSongId === songId;
  const hasPreview = Boolean(url);

  return (
    <button
      className={`iconButton ${isActive ? "active" : ""}`}
      type="button"
      disabled={!hasPreview}
      onClick={() => toggleAudio(songId, url, mode)}
      title={!hasPreview || status === "error" ? "Preview unavailable" : "Play preview"}
      aria-label={status === "playing" ? "Stop preview" : "Play preview"}
    >
      {status === "loading" && isActive ? <Loader2 className="spin" size={17} /> : null}
      {status === "error" ? <AlertCircle size={17} /> : null}
      {status !== "loading" && status !== "error" ? (
        isActive ? <Pause size={17} /> : <Play size={17} />
      ) : null}
    </button>
  );
}
