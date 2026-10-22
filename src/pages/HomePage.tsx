import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { dataByRegion, years } from "../data/years";

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

        {(["europe", "asia"] as const).map((region) => {
          const { years, allSongs, countries } = dataByRegion[region];
          return <section className="yearsSection" key={region}>
            <h2>{region === "europe" ? "Europe" : "Asia"}</h2>
            <div className="homeGrid">
              <Link className="featurePanel yearPanel" to={`/years#years-${region}`}>
                <span>{years.length} contests</span><h3>Years</h3><p>Rank songs from a specific contest year.</p>
              </Link>
              <Link className="featurePanel allSongsPanel" to={`/global-rankings?region=${region}`}>
                <span>{allSongs.length} songs</span><h3>Global Rankings</h3><p>Build a leaderboard across this series.</p>
              </Link>
              <Link className="featurePanel countryPanel" to={`/countries#countries-${region}`}>
                <span>{countries.length} countries</span><h3>Country Rankings</h3><p>Rank a country's entries across the years.</p>
              </Link>
              <Link className="featurePanel triviaPanel" to={`/trivia?region=${region}`}>
                <span>Audio Quiz</span><h3>Trivia</h3><p>Test your knowledge of this series.</p>
              </Link>
            </div>
          </section>;
        })}
      </section>
    </main>
  );
}
