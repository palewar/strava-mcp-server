// Utility functions for formatting Strava data

export function metresToKm(m: number): string {
  return (m / 1000).toFixed(2) + " km";
}

export function metresToMiles(m: number): string {
  return (m / 1609.344).toFixed(2) + " mi";
}

export function secondsToHMS(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function mpsToKmh(mps: number): string {
  return (mps * 3.6).toFixed(1) + " km/h";
}

export function mpsToMinPerKm(mps: number): string {
  if (mps === 0) return "—";
  const secPerKm = 1000 / mps;
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")} /km`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export function formatActivitySummary(a: {
  id: number; name: string; type: string;
  start_date_local: string; distance: number;
  moving_time: number; total_elevation_gain: number;
  average_speed: number; average_heartrate?: number;
  suffer_score?: number; kudos_count: number;
}): string {
  return [
    `**${a.name}** (${a.type}) — ${formatDate(a.start_date_local)}`,
    `  📏 ${metresToKm(a.distance)}  ⏱ ${secondsToHMS(a.moving_time)}  ⚡ ${mpsToKmh(a.average_speed)}  🏔 ${a.total_elevation_gain.toFixed(0)}m gain`,
    a.average_heartrate ? `  ❤️ Avg HR: ${a.average_heartrate.toFixed(0)} bpm` : "",
    a.suffer_score ? `  🔥 Suffer score: ${a.suffer_score}` : "",
    `  👍 ${a.kudos_count} kudos  🆔 Activity ID: ${a.id}`,
  ].filter(Boolean).join("\n");
}
