import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { dataByRegion, years } from "../data/years";

export default function YearsPage() {
  return (
    <main
      className="pageShell"
      style={{ "--bg-image": `url(${years[0]?.backgroundImage})` } as CSSProperties}
    >
      <section className="contentColumn homeGrid">
        <div className="pageHeader">
          <Link className="backButton" to="/">
            <ArrowLeft size={16} /> Back
          </Link>
          <h1>Years</h1>
          <p>Choose a contest year and build your ranking for that edition.</p>
        </div>

        {(["europe", "asia"] as const).map((region) => (
          <section className="yearsSection" key={region} aria-labelledby={`years-${region}`}>
            <h2 id={`years-${region}`}>{region === "europe" ? "Europe" : "Asia"}</h2>
            <div className="yearGrid">
              {dataByRegion[region].years.map((year) => (
                <Link className="yearCard" to={`/year/${year.id}`} key={year.id}>
                  <span>
                    {year.hostCity}, {year.country}
                  </span>
                  <h3>{year.label}</h3>
                  <p>{year.songs.length} songs to rank</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
