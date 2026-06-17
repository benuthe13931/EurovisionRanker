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
          <h1>Eurovision Ranker</h1>
          <p>
            Rank songs by contest year, keep favorites, or build a dedicated Global Ranking with
            drag-and-drop and comparison insertion.
          </p>
        </div>

        <Link className="featurePanel yearPanel" to="/years">
          <span>{years.length} contests</span>
          <h2>Years</h2>
          <p>Rank songs from a specific contest year.</p>
        </Link>

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
      </section>
    </main>
  );
}
