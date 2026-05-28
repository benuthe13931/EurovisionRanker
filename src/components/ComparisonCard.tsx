import type { Song } from "../types";
import AudioButton from "./AudioButton";
import { useAudio } from "./AudioProvider";

type ComparisonCardProps = {
  song: Song;
  onChoose: (songId: string) => void;
};

export default function ComparisonCard({ song, onChoose }: ComparisonCardProps) {
  return (
    <section className="comparisonCard">
      {(() => {
        const { activeSongId, activePreviewMode, setStatusForSong, stopAudio } = useAudio();
        const isActiveInline = activeSongId === song.id && activePreviewMode === "inline";
        return (
          <div
            className="comparisonImage"
            style={isActiveInline ? undefined : { backgroundImage: `url(${song.imageUrl})` }}
          >
            {isActiveInline && song.previewVideoUrl ? (
              <video
                className="comparisonVideo"
                src={song.previewVideoUrl}
                controls
                autoPlay
                playsInline
                onCanPlay={() => setStatusForSong(song.id, "playing")}
                onEnded={() => stopAudio()}
                onError={() => {
                  setStatusForSong(song.id, "error");
                  stopAudio();
                }}
              />
            ) : (
              <span>{song.flagEmoji}</span>
            )}
          </div>
        );
      })()}
      <div className="comparisonBody">
        <p className="countryLine">
          <strong>{song.countryCode}</strong> {song.country}
          {song.year ? ` · ${song.year}` : ""}
        </p>
        <h2>{song.title}</h2>
        <p>{song.artist}</p>
        <div className="comparisonActions">
          <AudioButton songId={song.id} url={song.previewVideoUrl ?? ""} mode="inline" />
          <button className="primaryButton" type="button" onClick={() => onChoose(song.id)}>
            Choose this song
          </button>
        </div>
      </div>
    </section>
  );
}
