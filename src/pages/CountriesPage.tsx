import { type CSSProperties } from "react";
import { Link } from "react-router-dom";
import FlagEmoji from "../components/FlagEmoji";
import { allSongsBackground, countries } from "../data/years";

export default function CountriesPage() {
  return (
    <main
      className="pageShell"
      style={{ "--bg-image": `url(${allSongsBackground})` } as CSSProperties}
    >
      <section className="contentColumn homeGrid">
        <div className="pageHeader">
          <p className="eyebrow">Country leaderboards</p>
          <h1>Countries</h1>
          <p>Rank every entry from a country across all loaded contest years.</p>
        </div>

        <div className="yearGrid">
          {countries.map((country) => (
            <Link className="yearCard countryCard" to={`/country/${country.slug}`} key={country.slug}>
              <span>
                <FlagEmoji alt="" code={country.countryCode} src={country.flagEmoji} />{" "}
                {country.countryCode}
              </span>
              <h2>{country.country}</h2>
              <p>{country.songs.length} songs to rank</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
