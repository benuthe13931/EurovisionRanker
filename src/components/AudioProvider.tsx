import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type AudioStatus = "idle" | "loading" | "playing" | "error";

type AudioContextValue = {
  activeSongId: string | null;
  statusBySong: Record<string, AudioStatus>;
  toggleAudio: (songId: string, url: string) => void;
  stopAudio: () => void;
};

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [statusBySong, setStatusBySong] = useState<Record<string, AudioStatus>>({});

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    if (activeSongId) {
      setStatusBySong((status) => ({ ...status, [activeSongId]: "idle" }));
    }
    setActiveSongId(null);
  }, [activeSongId]);

  const toggleAudio = useCallback(
    (songId: string, url: string) => {
      if (activeSongId === songId && audioRef.current && !audioRef.current.paused) {
        stopAudio();
        return;
      }

      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      setActiveSongId(songId);
      setStatusBySong((status) => ({ ...status, [songId]: "loading" }));

      audio.addEventListener("canplay", () => {
        setStatusBySong((status) => ({ ...status, [songId]: "playing" }));
      });
      audio.addEventListener("ended", () => {
        setStatusBySong((status) => ({ ...status, [songId]: "idle" }));
        setActiveSongId(null);
      });
      audio.addEventListener("error", () => {
        setStatusBySong((status) => ({ ...status, [songId]: "error" }));
        setActiveSongId(null);
      });

      void audio.play().catch(() => {
        setStatusBySong((status) => ({ ...status, [songId]: "error" }));
        setActiveSongId(null);
      });
    },
    [activeSongId, stopAudio],
  );

  useEffect(() => () => audioRef.current?.pause(), []);

  return (
    <AudioContext.Provider value={{ activeSongId, statusBySong, toggleAudio, stopAudio }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useAudio must be used inside AudioProvider");
  return context;
}
