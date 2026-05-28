import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import VideoPreview from "./VideoPreview";

type AudioStatus = "idle" | "loading" | "playing" | "error";

type AudioContextValue = {
  activeSongId: string | null;
  statusBySong: Record<string, AudioStatus>;
  toggleAudio: (songId: string, url?: string, mode?: "inline" | "modal") => void;
  stopAudio: () => void;
  setStatusForSong: (songId: string, status: AudioStatus) => void;
  activePreviewUrl: string | null;
  activePreviewMode: "inline" | "modal" | null;
};

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [statusBySong, setStatusBySong] = useState<Record<string, AudioStatus>>({});
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [activePreviewMode, setActivePreviewMode] = useState<"inline" | "modal" | null>(null);

  const stopAudio = useCallback(() => {
    if (activeSongId) {
      setStatusBySong((status) => ({ ...status, [activeSongId]: "idle" }));
    }
    setActiveSongId(null);
    setActivePreviewUrl(null);
    setActivePreviewMode(null);
  }, [activeSongId]);

  const toggleAudio = useCallback(
    (songId: string, url?: string, mode: "inline" | "modal" = "modal") => {
      if (activeSongId === songId) {
        stopAudio();
        return;
      }

      if (!url) return;

      // start new preview
      setActiveSongId(songId);
      setActivePreviewUrl(url ?? null);
      setActivePreviewMode(mode);
      setStatusBySong((status) => ({ ...status, [songId]: "loading" }));
    },
    [activeSongId, stopAudio],
  );

  const setStatusForSong = useCallback((songId: string, status: AudioStatus) => {
    setStatusBySong((s) => ({ ...s, [songId]: status }));
    if ((status === "idle" || status === "error") && activeSongId === songId) {
      setActiveSongId(null);
      setActivePreviewUrl(null);
      setActivePreviewMode(null);
    }
  }, [activeSongId]);

  useEffect(() => {
    return () => {
      setActiveSongId(null);
      setActivePreviewUrl(null);
      setActivePreviewMode(null);
    };
  }, []);

  return (
    <AudioContext.Provider
      value={{
        activeSongId,
        statusBySong,
        toggleAudio,
        stopAudio,
        setStatusForSong,
        activePreviewUrl,
        activePreviewMode,
      }}
    >
      {children}
      {activePreviewMode === "modal" && activePreviewUrl
        ? createPortal(
            <div className="videoModal">
              <div className="videoModalBackdrop" onClick={stopAudio} />
              <div className="videoModalContent">
                <button className="videoModalClose" type="button" onClick={stopAudio} aria-label="Close preview">
                  <X size={16} />
                </button>
                <VideoPreview
                  url={activePreviewUrl}
                  title="Song preview"
                  onReady={() => {
                    if (activeSongId) setStatusBySong((s) => ({ ...s, [activeSongId]: "playing" }));
                  }}
                  onEnded={() => stopAudio()}
                  onError={() => {
                    if (activeSongId) setStatusBySong((s) => ({ ...s, [activeSongId]: "error" }));
                    stopAudio();
                  }}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useAudio must be used inside AudioProvider");
  return context;
}
