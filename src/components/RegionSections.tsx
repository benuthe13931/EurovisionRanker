import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { dataByRegion } from "../data/years";

export default function RegionSections({ title, children }: { title: string; children: ReactNode }) {
  const { pathname, search } = useLocation();
  const region = new URLSearchParams(search).get("region");
  if (region === "europe" || region === "asia") return <>
    <div className="regionBackLink"><Link className="backButton" to={pathname}>? All {title}</Link></div>
    {children}
  </>;
  return <main className="pageShell">
    <div className="contentColumn homeGrid">
      <header className="pageHeader"><h1>{title}</h1><p>Explore each contest series below.</p></header>
      {(["europe", "asia"] as const).map((region) => <section className="yearsSection" key={region}>
        <h2>{region === "europe" ? "Europe" : "Asia"}</h2>
        <Link className="featurePanel allSongsPanel" to={`${pathname}?region=${region}`}>
          <span>{dataByRegion[region].years.length} contests ? {dataByRegion[region].allSongs.length} songs</span>
          <h3>{region === "europe" ? "Europe" : "Asia"} {title}</h3>
          <p>Open {title.toLowerCase()} for this contest series.</p>
        </Link>
      </section>)}
    </div>
  </main>;
}
