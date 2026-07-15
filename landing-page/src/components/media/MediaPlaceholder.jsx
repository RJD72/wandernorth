import { trackEvent } from "../../services/analyticsService.js";

export default function MediaPlaceholder({
  asset,
  compact = false,
  eager = false,
}) {
  if (asset.src && asset.type === "image")
    return (
      <img
        className="media-actual"
        src={asset.src}
        alt={asset.alt}
        loading={eager ? "eager" : "lazy"}
      />
    );
  if (asset.src && asset.type === "video")
    return (
      <video
        className="media-actual"
        src={asset.src}
        poster={asset.poster || undefined}
        controls
        preload="metadata"
        aria-label={asset.alt}
      />
    );

  return (
    <button
      className={`media-placeholder ${compact ? "media-placeholder--compact" : ""}`}
      type="button"
      onClick={() => trackEvent("demo_media_clicked", { asset: asset.label })}
      aria-label={`${asset.label}. ${asset.recommendedSize}.`}
    >
      <span className="media-sun" aria-hidden="true" />
      <span className="media-ridge media-ridge--back" aria-hidden="true" />
      <span className="media-ridge" aria-hidden="true" />
      <span className="media-route" aria-hidden="true" />
      <span className="media-pin media-pin--one" aria-hidden="true">
        1
      </span>
      <span className="media-pin media-pin--two" aria-hidden="true">
        2
      </span>
      <span className="media-label">
        <strong>{asset.label}</strong>
        <small>
          {asset.type} · {asset.recommendedSize}
        </small>
      </span>
    </button>
  );
}
