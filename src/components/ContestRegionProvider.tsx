import { createContext, useContext, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { dataByRegion, regionForContest, type ContestRegion } from "../data/years";

const RegionContext = createContext<ContestRegion>("europe");
export function useContestRegion() { return useContext(RegionContext); }
export function useContestData() { return dataByRegion[useContestRegion()]; }

export default function ContestRegionProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const contestId = location.pathname.match(/^\/year\/([^/]+)/)?.[1];
  const region: ContestRegion = contestId ? regionForContest(contestId)
    : new URLSearchParams(location.search).get("region") === "asia" ? "asia" : "europe";
  return <RegionContext.Provider value={region}>
    <div key={region}>{children}</div>
  </RegionContext.Provider>;
}
