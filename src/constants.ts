// Strava API constants
export const STRAVA_API_BASE = "https://www.strava.com/api/v3";
export const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

// MCP server limits
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const CHARACTER_LIMIT = 50000;

// Activity type mappings
export const ACTIVITY_TYPES = [
  "Run", "Ride", "Swim", "Walk", "Hike", "VirtualRide",
  "VirtualRun", "WeightTraining", "Yoga", "Workout", "Rowing",
  "Kayaking", "Snowboard", "Ski", "Soccer", "Tennis",
  "Crossfit", "Elliptical", "StairStepper", "Other"
] as const;

export type ActivityType = typeof ACTIVITY_TYPES[number];
