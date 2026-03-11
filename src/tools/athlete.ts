import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StravaClient } from "../services/stravaClient";
import { StravaAthlete, StravaStats } from "../types";
import { metresToKm, secondsToHMS } from "../services/formatters";

export function registerAthleteTools(server: McpServer, getClient: () => StravaClient): void {

  // ── Get current athlete profile ─────────────────────────────────────────
  server.registerTool(
    "strava_get_athlete",
    {
      title: "Get Athlete Profile",
      description: `Retrieve the authenticated athlete's Strava profile.
Returns name, location, follower/friend counts, gear list, and measurement preferences.

Returns:
  JSON or Markdown summary of the athlete profile.

Example uses:
  - "Who am I on Strava?"
  - "What bikes do I have registered?"
  - "What unit system does my Strava use?"`,
      inputSchema: {
        response_format: z.enum(["markdown", "json"]).default("markdown")
          .describe("Output format: 'markdown' for human-readable, 'json' for structured data")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ response_format }) => {
      const athlete = await getClient().get<StravaAthlete>("/athlete");

      if (response_format === "json") {
        return { content: [{ type: "text", text: JSON.stringify(athlete, null, 2) }] };
      }

      const text = [
        `## 🏃 ${athlete.firstname} ${athlete.lastname} (@${athlete.username})`,
        `📍 ${athlete.city}, ${athlete.country}`,
        `👥 ${athlete.follower_count} followers · ${athlete.friend_count} following`,
        athlete.weight ? `⚖️ Weight: ${athlete.weight} kg` : "",
        "",
        athlete.bikes?.length ? `**Bikes:**\n${athlete.bikes.map(b => `  - ${b.name} (${metresToKm(b.distance)} total)${b.primary ? " ⭐" : ""}`).join("\n")}` : "",
        athlete.shoes?.length ? `**Shoes:**\n${athlete.shoes.map(s => `  - ${s.name} (${metresToKm(s.distance)} total)${s.primary ? " ⭐" : ""}`).join("\n")}` : "",
      ].filter(Boolean).join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  // ── Get athlete stats ────────────────────────────────────────────────────
  server.registerTool(
    "strava_get_stats",
    {
      title: "Get Athlete Stats",
      description: `Retrieve aggregated training stats for the authenticated athlete.
Includes recent (last 4 weeks), year-to-date, and all-time totals for runs, rides, and swims.

Returns:
  Distance, time, and elevation totals broken down by sport and time period.

Example uses:
  - "How many km have I run this year?"
  - "What are my all-time cycling stats?"
  - "Show me my recent training summary"`,
      inputSchema: {
        response_format: z.enum(["markdown", "json"]).default("markdown")
          .describe("Output format")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ response_format }) => {
      const athlete = await getClient().get<StravaAthlete>("/athlete");
      const stats = await getClient().get<StravaStats>(`/athletes/${athlete.id}/stats`);

      if (response_format === "json") {
        return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
      }

      const fmt = (t: { count: number; distance: number; moving_time: number; elevation_gain: number }) =>
        `${t.count} activities · ${metresToKm(t.distance)} · ${secondsToHMS(t.moving_time)} · ${t.elevation_gain.toFixed(0)}m elevation`;

      const text = [
        "## 📊 Training Stats",
        "",
        "### 🗓 Recent (last 4 weeks)",
        `🏃 Run: ${fmt(stats.recent_run_totals)}`,
        `🚴 Ride: ${fmt(stats.recent_ride_totals)}`,
        `🏊 Swim: ${fmt(stats.recent_swim_totals)}`,
        "",
        "### 📅 Year to Date",
        `🏃 Run: ${fmt(stats.ytd_run_totals)}`,
        `🚴 Ride: ${fmt(stats.ytd_ride_totals)}`,
        `🏊 Swim: ${fmt(stats.ytd_swim_totals)}`,
        "",
        "### 🏆 All Time",
        `🏃 Run: ${fmt(stats.all_run_totals)}`,
        `🚴 Ride: ${fmt(stats.all_ride_totals)}`,
        `🏊 Swim: ${fmt(stats.all_swim_totals)}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );
}
