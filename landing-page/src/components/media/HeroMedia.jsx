import { useEffect, useState } from "react";
import MediaPlaceholder from "./MediaPlaceholder.jsx";

const MOBILE_MEDIA_QUERY = "(max-width: 720px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQueryMatch(query) {
  return typeof window !== "undefined" && window.matchMedia(query).matches;
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => getMediaQueryMatch(query));

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatch = () => setMatches(mediaQuery.matches);

    updateMatch();
    mediaQuery.addEventListener("change", updateMatch);

    return () => mediaQuery.removeEventListener("change", updateMatch);
  }, [query]);

  return matches;
}

export default function HeroMedia({ asset }) {
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [unavailableVideo, setUnavailableVideo] = useState("");

  const videoSrc = isMobile ? asset.mobileSrc : asset.desktopSrc;
  const posterSrc = isMobile ? asset.mobilePoster : asset.desktopPoster;

  if (prefersReducedMotion) {
    return (
      <img
        className="hero-media-asset"
        src={posterSrc}
        alt={asset.alt}
        loading="eager"
        fetchPriority="high"
      />
    );
  }

  if (!videoSrc || unavailableVideo === videoSrc) {
    return <MediaPlaceholder asset={asset} eager />;
  }

  return (
    <video
      key={videoSrc}
      className="hero-media-asset"
      src={videoSrc}
      poster={posterSrc}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={asset.alt}
      onError={() => setUnavailableVideo(videoSrc)}
    />
  );
}
