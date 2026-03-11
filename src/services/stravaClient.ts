import axios, { AxiosInstance, AxiosError } from "axios";
import { STRAVA_API_BASE, STRAVA_TOKEN_URL } from "../constants";

export interface TokenStore {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
}

// In production, this should be persisted (DB, Redis, etc.)
// For now it's per-process in-memory, keyed by athlete ID
const tokenCache = new Map<string, TokenStore>();

export class StravaClient {
  private client: AxiosInstance;
  private clientId: string;
  private clientSecret: string;
  private tokens: TokenStore;

  constructor(tokens: TokenStore) {
    this.clientId = process.env.STRAVA_CLIENT_ID ?? "";
    this.clientSecret = process.env.STRAVA_CLIENT_SECRET ?? "";
    this.tokens = tokens;

    this.client = axios.create({
      baseURL: STRAVA_API_BASE,
      timeout: 15000,
    });

    // Auto-refresh access token on 401
    this.client.interceptors.response.use(
      (res) => res,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          await this.refreshToken();
          const config = error.config!;
          config.headers["Authorization"] = `Bearer ${this.tokens.access_token}`;
          return this.client.request(config);
        }
        return Promise.reject(error);
      }
    );
  }

  private async refreshToken(): Promise<void> {
    const response = await axios.post(STRAVA_TOKEN_URL, {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
      refresh_token: this.tokens.refresh_token,
    });

    this.tokens = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: response.data.expires_at,
    };
  }

  private getAuthHeaders() {
    return { Authorization: `Bearer ${this.tokens.access_token}` };
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.client.get<T>(path, {
        headers: this.getAuthHeaders(),
        params,
      });
      return response.data;
    } catch (error) {
      throw formatStravaError(error);
    }
  }

  async put<T>(path: string, data: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.client.put<T>(path, data, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      throw formatStravaError(error);
    }
  }
}

function formatStravaError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message ?? error.message;

    if (status === 401) return new Error("Authentication failed. Token may be expired.");
    if (status === 403) return new Error("Permission denied. Check your Strava API scopes.");
    if (status === 404) return new Error("Resource not found on Strava.");
    if (status === 429) return new Error("Rate limit exceeded. Try again in a few minutes.");
    if (status === 500) return new Error("Strava API server error. Try again later.");

    return new Error(`Strava API error (${status}): ${message}`);
  }
  if (error instanceof Error) return error;
  return new Error("Unknown error communicating with Strava API");
}

// -------------------------------------------------------
// Factory: build a StravaClient from the Bearer token
// that Claude passes in the Authorization header
// -------------------------------------------------------
export function getClientFromToken(accessToken: string): StravaClient {
  // For a minimal/demo server: caller supplies their own valid access token.
  // A production server would handle full OAuth and token refresh here.
  return new StravaClient({
    access_token: accessToken,
    refresh_token: "", // refresh handled externally in simple mode
    expires_at: Date.now() / 1000 + 3600,
  });
}
