import { useEffect, useState } from "react";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    const update = () => setMatches(media.matches);
    update();

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export function useResponsive() {
  const isMobilePortrait = useMediaQuery(
    "(max-width: 760px) and (orientation: portrait)"
  );

  const isMobileLandscape = useMediaQuery(
    "(max-width: 950px) and (orientation: landscape)"
  );

  const isMobile = isMobilePortrait || isMobileLandscape;

  return {
    isMobile,
    isMobilePortrait,
    isMobileLandscape,
    isCompactViewport: isMobile,
  };
}
