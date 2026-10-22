import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { dataByRegion, regionForContest, type ContestRegion } from "../data/years";

const RegionContext = createContext<ContestRegion>("europe");
export function useContestRegion() { return useContext(RegionContext); }
export function useContestData() { return dataByRegion[useContestRegion()]; }

export default function ContestRegionProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedRegion, setSelectedRegion] = useState<ContestRegion>(() =>
    localStorage.getItem("eurovision-ranker:contest-region") === "asia" ? "asia" : "europe",
  );
  const contestId = location.pathname.match(/^\/year\/([^/]+)/)?.[1];
  const region = contestId ? regionForContest(contestId) : selectedRegion;
  useEffect(() => {
    if (contestId) {
      setSelectedRegion(region);
      localStorage.setItem("eurovision-ranker:contest-region", region);
    }
  }, [contestId, region]);
  function selectRegion(next: ContestRegion) {
    localStorage.setItem("eurovision-ranker:contest-region", next);
    setSelectedRegion(next);
    if (contestId) navigate("/years");
    else if (location.pathname.startsWith("/country/")) navigate("/countries");
  }
  return <RegionContext.Provider value={region}>
    <nav className="contestRegionTabs" aria-label="Contest series">
      {(["europe", "asia"] as const).map((item) => <button
        key={item} type="button" className={region === item ? "selected" : ""}
        aria-pressed={region === item} onClick={() => selectRegion(item)}
      >{item === "europe" ? "Europe" : "Asia"}</button>)}
    </nav>
    <div key={region}>{children}</div>
  </RegionContext.Provider>;
}
