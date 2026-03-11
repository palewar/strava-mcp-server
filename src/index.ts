import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StravaClient, getClientFromToken } from "./services/stravaClient";
import { registerAthleteTools } from "./tools/athlete";
import { registerActivityTools } from "./tools/activities";
import { registerZoneAndGearTools } from "./tools/zones";
import {
  STRAVA_AUTH_URL, STRAVA_TOKEN_URL
} from "./constants";
import axios from "axios";

// ── Environment ────────────────────────────────────────────────────────────
const CLIENT_ID     = process.env.STRAVA_CLIENT_ID     ?? "";
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET ?? "";
const REDIRECT_URI  = process.env.STRAVA_REDIRECT_URI  ?? "http://localhost:3000/auth/callback";
const PORT          = parseInt(process.env.PORT ?? "3000");
const TRANSPORT     = process.env.TRANSPORT            ?? "http";

if (TRANSPORT === "http" && (!CLIENT_ID || !CLIENT_SECRET)) {
  console.error("⚠️  STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in environment");
  process.exit(1);
}

// ── MCP Server factory ─────────────────────────────────────────────────────
// We create a new McpServer per HTTP request so each user gets their own
// isolated instance authenticated with their own Strava token.
function createMcpServer(client: StravaClient): McpServer {
  const server = new McpServer({
    name: "strava-mcp-server",
    version: "1.0.0"
  });

  const getClient = () => client;

  registerAthleteTools(server, getClient);
  registerActivityTools(server, getClient);
  registerZoneAndGearTools(server, getClient);

  return server;
}

// ── HTTP mode (remote/multi-user) ──────────────────────────────────────────
async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  // ── OAuth Step 1: redirect user to Strava ──────────────────────────────
  app.get("/auth", (_req, res) => {
    const scope = "read,activity:read_all,profile:read_all";
    const url = `${STRAVA_AUTH_URL}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scope}`;
    res.redirect(url);
  });

  // ── OAuth Step 2: exchange code for tokens ─────────────────────────────
  app.get("/auth/callback", async (req, res) => {
    const { code, error } = req.query;

    if (error || !code) {
      res.status(400).send(`Auth failed: ${error ?? "no code returned"}`);
      return;
    }

    try {
      const tokenRes = await axios.post(STRAVA_TOKEN_URL, {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      });

      const { access_token, refresh_token, expires_at, athlete } = tokenRes.data;

      // In production: persist tokens against athlete.id in a database.
      // Return the access_token to the client so they can pass it to the MCP server.
      res.json({
        message: `Authenticated as ${athlete.firstname} ${athlete.lastname}`,
        access_token,          // ← user stores this and provides it to MCP calls
        refresh_token,
        expires_at,
        athlete_id: athlete.id,
      });
    } catch (err) {
      console.error("Token exchange failed:", err);
      res.status(500).send("Token exchange failed");
    }
  });

  // ── MCP endpoint ───────────────────────────────────────────────────────
  // Expects: Authorization: Bearer <strava_access_token>
  app.post("/mcp", async (req, res) => {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({ error: "Authorization: Bearer <strava_access_token> required" });
      return;
    }

    const client = getClientFromToken(token);
    const server = createMcpServer(client);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — new transport per request
      enableJsonResponse: true,
    });

    res.on("close", () => transport.close());

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // Health check
  app.get("/health", (_req, res) => res.json({ status: "ok", server: "strava-mcp-server" }));

  app.listen(PORT, () => {
    console.error(`✅ strava-mcp-server running on http://localhost:${PORT}`);
    console.error(`   OAuth flow:  GET  http://localhost:${PORT}/auth`);
    console.error(`   MCP endpoint: POST http://localhost:${PORT}/mcp`);
  });
}

// ── stdio mode (local / Claude Desktop) ───────────────────────────────────
async function runStdio(): Promise<void> {
  const token = process.env.STRAVA_ACCESS_TOKEN;
  if (!token) {
    console.error("STRAVA_ACCESS_TOKEN env var required in stdio mode");
    process.exit(1);
  }

  const client = getClientFromToken(token);
  const server = createMcpServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("strava-mcp-server running (stdio)");
}

// ── Entry point ────────────────────────────────────────────────────────────
if (TRANSPORT === "http") {
  runHTTP().catch((err) => { console.error(err); process.exit(1); });
} else {
  runStdio().catch((err) => { console.error(err); process.exit(1); });
}
