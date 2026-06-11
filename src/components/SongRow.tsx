import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Heart } from "lucide-react";
import { useState } from "react";
import type { Song } from "../types";
import AudioButton from "./AudioButton";
import FlagEmoji from "./FlagEmoji";

type SongRowProps = {
  song: Song;
  rank: number;
  favorite: boolean;
  onToggleFavorite: (songId: string) => void;
  metaMode?: "country" | "countryYear" | "year";
};

export default function SongRow({
  song,
  rank,
  favorite,
  onToggleFavorite,
  metaMode = "country",
}: SongRowProps) {
  const [flagFailed, setFlagFailed] = useState(false);
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: song.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const hasCustomFlag = Boolean(song.flagImageUrl);
  const rankClass = rank <= 3 ? `ranked-${rank}` : "";

  return (
    <article
      ref={setNodeRef}
      className={`songRow ${rankClass} ${isDragging ? "dragging" : ""}`}
      style={style}
    >
      {!backgroundFailed && song.imageUrl ? (
        <div className="songRowBackdrop" aria-hidden="true">
          <img src={song.imageUrl} alt="" loading="lazy" onError={() => setBackgroundFailed(true)} />
          <div />
        </div>
      ) : null}
      <button
        className="dragHandle"
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag song"
      >
        <GripVertical size={19} />
      </button>
      <span className={`rankPill rank-${rank <= 3 ? rank : "default"}`}>{rank}</span>
      <span
        className={`flagBadge ${hasCustomFlag ? "customFlagBadge" : "fallbackFlagBadge"}`}
        aria-label={`${song.country} flag`}
      >
        {!flagFailed ? (
          <img
            src={song.flagImageUrl ?? `https://flagcdn.com/w80/${song.countryCode.toLowerCase()}.png`}
            alt=""
            onError={() => setFlagFailed(true)}
          />
        ) : (
          <span>{song.countryCode}</span>
        )}
      </span>
      <div className="songMeta">
        <h3>{song.title}</h3>
        <p>
          {song.artist}
          {metaMode === "year" && song.year ? (
            <>
              <span>/</span>
              {song.year}
            </>
          ) : null}
          {metaMode !== "year" ? (
            <>
              <span>/</span>
              <FlagEmoji alt="" className="metaFlag" code={song.countryCode} src={song.flagEmoji} /> {song.country}
            </>
          ) : null}
          {metaMode === "countryYear" && song.year ? (
            <>
              <span>/</span>
              {song.year}
            </>
          ) : null}
        </p>
      </div>
      <div className="rowActions">
        <AudioButton songId={song.id} url={song.previewVideoUrl ?? ""} mode="modal" />
        <button
          className={`iconButton heartButton ${favorite ? "active" : ""}`}
          type="button"
          onClick={() => onToggleFavorite(song.id)}
          title={favorite ? "Remove from favorites" : "Add to favorites"}
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart size={17} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  );
}
