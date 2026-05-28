import type { Song } from "../types";
import AudioButton from "./AudioButton";

type ComparisonCardProps = {
  song: Song;
  onChoose: (songId: string) => void;
};

export default function ComparisonCard({ song, onChoose }: ComparisonCardProps) {
  return (
    <section className="comparisonCard">
      <div className="comparisonImage" style={{ backgroundImage: `url(${song.imageUrl})` }}>
        <span>{song.flagEmoji}</span>
      </div>
      <div className="comparisonBody">
        <p className="countryLine">
          <strong>{song.countryCode}</strong> {song.country}
          {song.year ? ` · ${song.year}` : ""}
        </p>
        <h2>{song.title}</h2>
        <p>{song.artist}</p>
        <div className="comparisonActions">
          <AudioButton songId={song.id} url={song.audioPreviewUrl} />
          <button className="primaryButton" type="button" onClick={() => onChoose(song.id)}>
            Choose this song
          </button>
        </div>
      </div>
    </section>
  );
}
