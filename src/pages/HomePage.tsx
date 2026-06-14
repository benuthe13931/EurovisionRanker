import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { allSongs, countries, years } from "../data/years";

export default function HomePage() {
  return (
    <main
      className="pageShell"
      style={{ "--bg-image": `url(${years[0]?.backgroundImage})` } as CSSProperties}
    >
      <section className="contentColumn homeGrid">
        <div className="pageHeader">
          <p className="eyebrow">Private local ranking app</p>
          <h1>Eurovision Ranker</h1>
          <p>
            Rank songs by contest year, keep favorites, or build a dedicated Global Ranking with
            drag-and-drop and comparison insertion.
          </p>
        </div>

        <Link className="featurePanel allSongsPanel" to="/global-rankings">
          <span>{allSongs.length} songs</span>
          <h2>Global Rankings</h2>
          <p>Insert selected years into one persistent cross-year leaderboard.</p>
        </Link>

        <Link className="featurePanel countryPanel" to="/countries">
          <span>{countries.length} countries</span>
          <h2>Country Rankings</h2>
          <p>Build a separate leaderboard for each country across all loaded years.</p>
        </Link>

        <Link className="featurePanel triviaPanel" to="/trivia">
          <span>Audio Quiz</span>
          <h2>Trivia</h2>
          <p>Test song, country, and year recognition from the preview clips.</p>
        </Link>

        <div className="yearGrid">
          {years.map((year) => (
            <Link className="yearCard" to={`/year/${year.year}`} key={year.year}>
              <span>{year.hostCity}, {year.country}</span>
              <h2>{year.year}</h2>
              <p>{year.songs.length} songs to rank</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
