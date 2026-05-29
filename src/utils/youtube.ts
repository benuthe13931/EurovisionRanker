export function getYouTubeVideoId(urlOrId: string) {
  const value = urlOrId.trim();
  if (!value) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/").filter(Boolean)[1] ?? null;
      }

      return url.searchParams.get("v");
    }
  } catch {
    return null;
  }

  return null;
}

export function getYouTubeEmbedUrl(urlOrId: string, startSeconds?: number) {
  const videoId = getYouTubeVideoId(urlOrId);
  if (!videoId) return null;

  const params = new URLSearchParams({
    autoplay: "1",
    playsinline: "1",
    rel: "0",
    enablejsapi: "1",
  });

  if (typeof window !== "undefined") {
    params.set("origin", window.location.origin);
  }

  if (typeof startSeconds === "number" && Number.isFinite(startSeconds) && startSeconds > 0) {
    params.set("start", `${Math.floor(startSeconds)}`);
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}
