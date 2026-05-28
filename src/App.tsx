import { Navigate, Route, Routes } from "react-router-dom";
import { AudioProvider } from "./components/AudioProvider";
import NavBar from "./components/NavBar";
import AllSongsPage from "./pages/AllSongsPage";
import HomePage from "./pages/HomePage";
import YearPage from "./pages/YearPage";

export default function App() {
  return (
    <AudioProvider>
      <NavBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/years" element={<HomePage />} />
        <Route path="/year/:year" element={<YearPage />} />
        <Route path="/all-songs" element={<AllSongsPage />} />
        <Route path="/favorites" element={<AllSongsPage favoritesOnly />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AudioProvider>
  );
}
