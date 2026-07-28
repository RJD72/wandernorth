import { useEffect, useRef, useState } from "react";
import MediaPlaceholder from "./MediaPlaceholder.jsx";
import { trackEvent } from "../../services/analyticsService.js";

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
  const trackedPlay = useRef(false);
  const trackedComplete = useRef(false);

  const videoSrc = isMobile ? asset.mobileSrc : asset.desktopSrc;
  const posterSrc = isMobile ? asset.mobilePoster : asset.desktopPoster;
  const videoVersion = isMobile ? "mobile" : "desktop";

  const trackPlay = () => {
    if (trackedPlay.current) return;
    trackedPlay.current = true;
    trackEvent("hero_video_play", { video_version: videoVersion });
  };

  const trackComplete = (event) => {
    const { currentTime, duration } = event.currentTarget;
    if (
      trackedComplete.current ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      currentTime / duration < 0.95
    )
      return;
    trackedComplete.current = true;
    trackEvent("hero_video_complete", { video_version: videoVersion });
  };

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
      onPlay={trackPlay}
      onTimeUpdate={trackComplete}
      onError={() => setUnavailableVideo(videoSrc)}
    />
  );
}
