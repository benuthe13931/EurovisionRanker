import { type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { allSongsBackground, countries } from "../data/years";

export default function CountriesPage() {
  return (
    <main
      className="pageShell"
      style={{ "--bg-image": `url(${allSongsBackground})` } as CSSProperties}
    >
      <section className="contentColumn homeGrid">
        <div className="pageHeader">
          <Link className="backButton" to="/">
            <ArrowLeft size={16} /> Back
          </Link>
          <h1>Countries</h1>
          <p>Rank every entry from a country across all loaded contest years.</p>
        </div>

        <div className="yearGrid">
          {countries.map((country) => (
            <Link className="yearCard countryCard" to={`/country/${country.slug}`} key={country.slug}>
              <span className="countryCardFlag">
                <img
                  src={country.flagImageUrl ?? country.flagEmoji}
                  alt=""
                  loading="lazy"
                />
              </span>
              <span className="countryCardText">
                <strong>{country.country}</strong>
                <small>{country.songs.length} songs to rank</small>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
