import { Navigate, Route, Routes } from "react-router-dom";
import { AudioProvider } from "./components/AudioProvider";
import NavBar from "./components/NavBar";
import AllSongsPage from "./pages/AllSongsPage";
import CountriesPage from "./pages/CountriesPage";
import CountryPage from "./pages/CountryPage";
import GlobalRankingsPage from "./pages/GlobalRankingsPage";
import HomePage from "./pages/HomePage";
import TriviaPage from "./pages/TriviaPage";
import YearPage from "./pages/YearPage";

export default function App() {
  return (
    <AudioProvider>
      <NavBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/years" element={<HomePage />} />
        <Route path="/year/:year" element={<YearPage />} />
        <Route path="/countries" element={<CountriesPage />} />
        <Route path="/country/:countrySlug" element={<CountryPage />} />
        <Route path="/global-rankings" element={<GlobalRankingsPage />} />
        <Route path="/all-songs" element={<Navigate to="/global-rankings" replace />} />
        <Route path="/favorites" element={<AllSongsPage favoritesOnly />} />
        <Route path="/trivia" element={<TriviaPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AudioProvider>
  );
}
