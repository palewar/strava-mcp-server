import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StravaClient } from "../services/stravaClient";
import { StravaZones, StravaGear } from "../types";
import { metresToKm } from "../services/formatters";

export function registerZoneAndGearTools(server: McpServer, getClient: () => StravaClient): void {

  // ── Heart rate / power zones ─────────────────────────────────────────────
  server.registerTool(
    "strava_get_zones",
    {
      title: "Get Training Zones",
      description: `Get the authenticated athlete's heart rate and power zones from Strava.

Returns:
  HR zones (min/max bpm per zone) and power zones if available.

Example uses:
  - "What are my heart rate zones?"
  - "Show me my power zones"`,
      inputSchema: {
        response_format: z.enum(["markdown", "json"]).default("markdown")
          .describe("Output format")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ response_format }) => {
      const zones = await getClient().get<StravaZones>("/athlete/zones");

      if (response_format === "json") {
        return { content: [{ type: "text", text: JSON.stringify(zones, null, 2) }] };
      }

      const lines = ["## 🎯 Training Zones", ""];

      if (zones.heart_rate?.zones?.length) {
        lines.push("### ❤️ Heart Rate Zones");
        zones.heart_rate.zones.forEach((z, i) => {
          lines.push(`  Zone ${i + 1}: ${z.min}–${z.max === -1 ? "∞" : z.max} bpm`);
        });
        lines.push("");
      }

      if (zones.power?.zones?.length) {
        lines.push("### ⚡ Power Zones (Watts)");
        zones.power.zones.forEach((z, i) => {
          lines.push(`  Zone ${i + 1}: ${z.min}–${z.max === -1 ? "∞" : z.max} W`);
        });
      }

      if (!zones.heart_rate && !zones.power) {
        lines.push("No zones configured. Set them at strava.com → Settings → My Performance.");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // ── Get gear details ─────────────────────────────────────────────────────
  server.registerTool(
    "strava_get_gear",
    {
      title: "Get Gear Details",
      description: `Get details for a specific piece of gear (bike or shoe) by its Strava gear ID.

Args:
  - gear_id (string): Strava gear ID, e.g. "b1234567" for bikes or "g1234567" for shoes

Returns:
  Gear name, brand, model, total distance, and description.

Example uses:
  - "How many km are on my Trek bike?"
  - "Show me details for gear b12345"`,
      inputSchema: {
        gear_id: z.string()
          .describe("Strava gear ID e.g. 'b1234567' for bike, 'g1234567' for shoe"),
        response_format: z.enum(["markdown", "json"]).default("markdown")
          .describe("Output format")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ gear_id, response_format }) => {
      const gear = await getClient().get<StravaGear & {
        brand_name?: string; model_name?: string; description?: string
      }>(`/gear/${gear_id}`);

      if (response_format === "json") {
        return { content: [{ type: "text", text: JSON.stringify(gear, null, 2) }] };
      }

      const lines = [
        `## 🚴 ${gear.name}${gear.primary ? " ⭐ Primary" : ""}`,
        gear.brand_name ? `Brand: ${gear.brand_name}` : "",
        gear.model_name ? `Model: ${gear.model_name}` : "",
        `Total distance: ${metresToKm(gear.distance)}`,
        gear.description ? `\n${gear.description}` : "",
      ].filter(Boolean);

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
