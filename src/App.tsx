import RegionSections from "./components/RegionSections";
import ContestRegionProvider from "./components/ContestRegionProvider";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AudioProvider } from "./components/AudioProvider";
import NavBar from "./components/NavBar";
import AllSongsPage from "./pages/AllSongsPage";
import CountriesPage from "./pages/CountriesPage";
import CountryPage from "./pages/CountryPage";
import GlobalRankingsPage from "./pages/GlobalRankingsPage";
import HomePage from "./pages/HomePage";
import TriviaPage from "./pages/TriviaPage";
import YearPage from "./pages/YearPage";
import YearsPage from "./pages/YearsPage";

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const section = hash ? document.getElementById(hash.slice(1)) : null;
    if (section) section.scrollIntoView({ behavior: "auto", block: "start" });
    else window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <AudioProvider>
      <ContestRegionProvider>
      <NavBar />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/years" element={<YearsPage />} />
        <Route path="/year/:year" element={<YearPage />} />
        <Route path="/countries" element={<CountriesPage />} />
        <Route path="/country/:countrySlug" element={<CountryPage />} />
        <Route path="/global" element={<Navigate to="/global-rankings" replace />} />
        <Route path="/global-rankings" element={<RegionSections title="Global Rankings"><GlobalRankingsPage /></RegionSections>} />
        <Route path="/all-songs" element={<Navigate to="/global-rankings" replace />} />
        <Route path="/favorites" element={<RegionSections title="Favorites"><AllSongsPage favoritesOnly /></RegionSections>} />
        <Route path="/trivia" element={<RegionSections title="Trivia"><TriviaPage /></RegionSections>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ContestRegionProvider>
    </AudioProvider>
  );
}
