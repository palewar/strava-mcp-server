import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StravaClient } from "../services/stravaClient";
import { StravaActivity, StravaDetailedActivity } from "../types";
import {
  metresToKm, secondsToHMS, mpsToKmh, mpsToMinPerKm,
  formatDate, formatActivitySummary
} from "../services/formatters";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants";

export function registerActivityTools(server: McpServer, getClient: () => StravaClient): void {

  // ── List activities ──────────────────────────────────────────────────────
  server.registerTool(
    "strava_list_activities",
    {
      title: "List Activities",
      description: `List the authenticated athlete's Strava activities with optional filters.
Supports filtering by date range, activity type, and pagination.

Args:
  - before (number, optional): Unix timestamp — only return activities before this time
  - after (number, optional): Unix timestamp — only return activities after this time
  - per_page (number): Number of results per page, 1–100 (default 20)
  - page (number): Page number (default 1)
  - response_format: 'markdown' or 'json'

Returns:
  List of activities with distance, time, pace/speed, elevation, and HR data.

Example uses:
  - "Show me my last 10 rides"
  - "What activities did I do this month?"
  - "List my runs from January 2025"`,
      inputSchema: {
        before: z.number().int().optional()
          .describe("Unix timestamp: only return activities before this time"),
        after: z.number().int().optional()
          .describe("Unix timestamp: only return activities after this time"),
        per_page: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
          .describe("Number of activities to return (default 20, max 100)"),
        page: z.number().int().min(1).default(1)
          .describe("Page number for pagination (default 1)"),
        response_format: z.enum(["markdown", "json"]).default("markdown")
          .describe("Output format")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ before, after, per_page, page, response_format }) => {
      const params: Record<string, unknown> = { per_page, page };
      if (before) params.before = before;
      if (after) params.after = after;

      const activities = await getClient().get<StravaActivity[]>("/athlete/activities", params);

      if (!activities.length) {
        return { content: [{ type: "text", text: "No activities found for the given filters." }] };
      }

      if (response_format === "json") {
        return { content: [{ type: "text", text: JSON.stringify(activities, null, 2) }] };
      }

      const text = [
        `## 🏅 Activities (page ${page}, ${activities.length} results)`,
        "",
        ...activities.map(a => formatActivitySummary(a) + "\n"),
      ].join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  // ── Get single activity ──────────────────────────────────────────────────
  server.registerTool(
    "strava_get_activity",
    {
      title: "Get Activity Detail",
      description: `Get full details for a single Strava activity by its ID.
Includes laps, splits, segment efforts, best efforts, and calories.

Args:
  - activity_id (number): The Strava activity ID (get from strava_list_activities)
  - response_format: 'markdown' or 'json'

Returns:
  Full activity detail including laps, splits, segment PRs, and best efforts.

Example uses:
  - "Tell me everything about activity 12345678"
  - "Show me the laps for my last run"
  - "Did I set any PRs in that ride?"`,
      inputSchema: {
        activity_id: z.number().int().positive()
          .describe("Strava activity ID — get this from strava_list_activities"),
        response_format: z.enum(["markdown", "json"]).default("markdown")
          .describe("Output format")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ activity_id, response_format }) => {
      const a = await getClient().get<StravaDetailedActivity>(`/activities/${activity_id}`);

      if (response_format === "json") {
        return { content: [{ type: "text", text: JSON.stringify(a, null, 2) }] };
      }

      const lines = [
        `## 🏅 ${a.name}`,
        `**Type:** ${a.sport_type || a.type}  |  **Date:** ${formatDate(a.start_date_local)}`,
        "",
        `📏 Distance: ${metresToKm(a.distance)}`,
        `⏱ Moving time: ${secondsToHMS(a.moving_time)}  |  Elapsed: ${secondsToHMS(a.elapsed_time)}`,
        `⚡ Avg speed: ${mpsToKmh(a.average_speed)}  |  Max: ${mpsToKmh(a.max_speed)}`,
        a.type === "Run" ? `🏃 Avg pace: ${mpsToMinPerKm(a.average_speed)}` : "",
        `🏔 Elevation gain: ${a.total_elevation_gain.toFixed(0)}m`,
        a.average_heartrate ? `❤️ HR: avg ${a.average_heartrate.toFixed(0)} / max ${a.max_heartrate?.toFixed(0)} bpm` : "",
        a.average_watts ? `⚡ Power: avg ${a.average_watts.toFixed(0)}W  |  ${a.kilojoules?.toFixed(0)} kJ` : "",
        a.calories ? `🔥 Calories: ${a.calories.toFixed(0)}` : "",
        a.suffer_score ? `😰 Suffer score: ${a.suffer_score}` : "",
        a.description ? `\n📝 ${a.description}` : "",
      ].filter(s => s !== "");

      // Laps
      if (a.laps?.length) {
        lines.push("", `### Laps (${a.laps.length})`)
        a.laps.forEach(lap => {
          lines.push(`  **Lap ${lap.lap_index}:** ${metresToKm(lap.distance)} · ${secondsToHMS(lap.moving_time)} · ${mpsToKmh(lap.average_speed)}${lap.average_heartrate ? ` · ${lap.average_heartrate.toFixed(0)} bpm` : ""}`);
        });
      }

      // Best efforts
      if (a.best_efforts?.length) {
        lines.push("", "### 🏆 Best Efforts");
        a.best_efforts.forEach(be => {
          lines.push(`  **${be.name}:** ${secondsToHMS(be.moving_time)}${be.pr_rank === 1 ? " 🥇 PR!" : be.pr_rank ? ` (#${be.pr_rank} all time)` : ""}`);
        });
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // ── Analyse training load ────────────────────────────────────────────────
  server.registerTool(
    "strava_analyse_training",
    {
      title: "Analyse Training Load",
      description: `Analyse training patterns over a date range. Computes volume, frequency,
intensity trends, and flags potential overtraining. Fetches up to 200 recent activities.

Args:
  - days (number): Number of days to look back (default 30, max 365)
  - sport_type (string, optional): Filter to one sport e.g. "Run", "Ride"
  - response_format: 'markdown' or 'json'

Returns:
  Weekly volume breakdown, average intensity, consistency score, and observations.

Example uses:
  - "Am I overtraining?"
  - "Summarise my running volume for the last 90 days"
  - "How consistent has my cycling been this year?"`,
      inputSchema: {
        days: z.number().int().min(7).max(365).default(30)
          .describe("Number of days to analyse (default 30, max 365)"),
        sport_type: z.string().optional()
          .describe("Filter by sport type e.g. 'Run', 'Ride', 'Swim'"),
        response_format: z.enum(["markdown", "json"]).default("markdown")
          .describe("Output format")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ days, sport_type, response_format }) => {
      const after = Math.floor(Date.now() / 1000) - days * 86400;
      const allActivities = await getClient().get<StravaActivity[]>("/athlete/activities", {
        after, per_page: 200, page: 1
      });

      const activities = sport_type
        ? allActivities.filter(a => a.type === sport_type || a.sport_type === sport_type)
        : allActivities;

      if (!activities.length) {
        return { content: [{ type: "text", text: `No activities found in the last ${days} days${sport_type ? ` for ${sport_type}` : ""}.` }] };
      }

      // Weekly buckets
      const weeks: Record<string, StravaActivity[]> = {};
      activities.forEach(a => {
        const d = new Date(a.start_date_local);
        const monday = new Date(d);
        monday.setDate(d.getDate() - d.getDay() + 1);
        const key = monday.toISOString().slice(0, 10);
        if (!weeks[key]) weeks[key] = [];
        weeks[key].push(a);
      });

      const totalDist = activities.reduce((s, a) => s + a.distance, 0);
      const totalTime = activities.reduce((s, a) => s + a.moving_time, 0);
      const totalElev = activities.reduce((s, a) => s + a.total_elevation_gain, 0);
      const avgHR = activities.filter(a => a.average_heartrate).map(a => a.average_heartrate!);
      const weekCount = Object.keys(weeks).length;

      const analysis = {
        period_days: days,
        sport_filter: sport_type ?? "all",
        total_activities: activities.length,
        total_distance_km: +(totalDist / 1000).toFixed(1),
        total_time_hrs: +(totalTime / 3600).toFixed(1),
        total_elevation_m: +totalElev.toFixed(0),
        avg_per_week: {
          activities: +(activities.length / weekCount).toFixed(1),
          distance_km: +(totalDist / 1000 / weekCount).toFixed(1),
          time_hrs: +(totalTime / 3600 / weekCount).toFixed(1),
        },
        avg_heartrate: avgHR.length ? +(avgHR.reduce((a, b) => a + b) / avgHR.length).toFixed(0) : null,
        weeks: Object.entries(weeks).sort().map(([week, acts]) => ({
          week_starting: week,
          count: acts.length,
          distance_km: +(acts.reduce((s, a) => s + a.distance, 0) / 1000).toFixed(1),
          time_hrs: +(acts.reduce((s, a) => s + a.moving_time, 0) / 3600).toFixed(1),
        }))
      };

      if (response_format === "json") {
        return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
      }

      const lines = [
        `## 📈 Training Analysis — Last ${days} Days${sport_type ? ` (${sport_type})` : ""}`,
        "",
        `**${analysis.total_activities} activities**  |  ${analysis.total_distance_km} km total  |  ${analysis.total_time_hrs}h  |  ${analysis.total_elevation_m}m elevation`,
        analysis.avg_heartrate ? `❤️ Average HR: ${analysis.avg_heartrate} bpm` : "",
        "",
        `### Weekly Averages`,
        `  ${analysis.avg_per_week.activities} sessions/week · ${analysis.avg_per_week.distance_km} km/week · ${analysis.avg_per_week.time_hrs}h/week`,
        "",
        `### Week-by-Week Breakdown`,
        ...analysis.weeks.map(w =>
          `  **w/c ${w.week_starting}:** ${w.count} acts · ${w.distance_km} km · ${w.time_hrs}h`
        ),
      ].filter(s => s !== "");

      // Simple overtraining flag
      const weekDists = analysis.weeks.map(w => w.distance_km);
      const maxWeek = Math.max(...weekDists);
      const avgWeek = analysis.avg_per_week.distance_km;
      if (maxWeek > avgWeek * 1.5) {
        lines.push("", `⚠️ **Note:** One week had ${maxWeek} km vs your ${avgWeek} km average (+${Math.round((maxWeek / avgWeek - 1) * 100)}%). Monitor for fatigue.`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
