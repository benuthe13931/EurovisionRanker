import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useContestData } from "../components/ContestRegionProvider";

export default function YearsPage() {
  const { years } = useContestData();
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

        <div className="yearGrid">
          {years.map((year) => (
            <Link className="yearCard" to={`/year/${year.id}`} key={year.id}>
              <span>
                {year.hostCity}, {year.country}
              </span>
              <h2>{year.label}</h2>
              <p>{year.songs.length} songs to rank</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
