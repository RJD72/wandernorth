export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "—";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}
