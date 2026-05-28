import { AlertCircle, Loader2, Pause, Play } from "lucide-react";
import { useAudio } from "./AudioProvider";

type AudioButtonProps = {
  songId: string;
  url: string;
};

export default function AudioButton({ songId, url }: AudioButtonProps) {
  const { activeSongId, statusBySong, toggleAudio } = useAudio();
  const status = statusBySong[songId] ?? "idle";
  const isActive = activeSongId === songId;

  return (
    <button
      className={`iconButton ${isActive ? "active" : ""}`}
      type="button"
      onClick={() => toggleAudio(songId, url)}
      title={status === "error" ? "Audio preview unavailable" : "Play audio preview"}
      aria-label={status === "playing" ? "Pause audio preview" : "Play audio preview"}
    >
      {status === "loading" && isActive ? <Loader2 className="spin" size={17} /> : null}
      {status === "error" ? <AlertCircle size={17} /> : null}
      {status !== "loading" && status !== "error" ? (
        isActive ? <Pause size={17} /> : <Play size={17} />
      ) : null}
    </button>
  );
}
