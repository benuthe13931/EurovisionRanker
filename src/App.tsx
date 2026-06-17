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
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <AudioProvider>
      <NavBar />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/years" element={<YearsPage />} />
        <Route path="/year/:year" element={<YearPage />} />
        <Route path="/countries" element={<CountriesPage />} />
        <Route path="/country/:countrySlug" element={<CountryPage />} />
        <Route path="/global" element={<Navigate to="/global-rankings" replace />} />
        <Route path="/global-rankings" element={<GlobalRankingsPage />} />
        <Route path="/all-songs" element={<Navigate to="/global-rankings" replace />} />
        <Route path="/favorites" element={<AllSongsPage favoritesOnly />} />
        <Route path="/trivia" element={<TriviaPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AudioProvider>
  );
}
