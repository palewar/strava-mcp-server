// Strava API response types

export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  city: string;
  country: string;
  profile: string;
  follower_count: number;
  friend_count: number;
  measurement_preference: "feet" | "meters";
  weight: number;
  bikes: StravaGear[];
  shoes: StravaGear[];
}

export interface StravaGear {
  id: string;
  name: string;
  distance: number; // in metres
  primary: boolean;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number;        // in metres
  moving_time: number;     // in seconds
  elapsed_time: number;    // in seconds
  total_elevation_gain: number; // in metres
  average_speed: number;   // in m/s
  max_speed: number;       // in m/s
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  kilojoules?: number;
  suffer_score?: number;
  kudos_count: number;
  achievement_count: number;
  map?: { summary_polyline: string };
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  gear_id?: string;
  description?: string;
  trainer: boolean;
  commute: boolean;
  private: boolean;
  device_name?: string;
}

export interface StravaDetailedActivity extends StravaActivity {
  calories?: number;
  laps?: StravaLap[];
  best_efforts?: StravaBestEffort[];
  segment_efforts?: StravaSegmentEffort[];
  splits_metric?: StravaSplit[];
}

export interface StravaLap {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_speed: number;
  average_heartrate?: number;
  average_watts?: number;
  lap_index: number;
}

export interface StravaBestEffort {
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  start_date_local: string;
  pr_rank?: number;
}

export interface StravaSegmentEffort {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  average_speed: number;
  average_heartrate?: number;
  average_watts?: number;
  kom_rank?: number;
  pr_rank?: number;
}

export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  average_heartrate?: number;
  pace_zone?: number;
}

export interface StravaStats {
  recent_run_totals: ActivityTotals;
  recent_ride_totals: ActivityTotals;
  recent_swim_totals: ActivityTotals;
  ytd_run_totals: ActivityTotals;
  ytd_ride_totals: ActivityTotals;
  ytd_swim_totals: ActivityTotals;
  all_run_totals: ActivityTotals;
  all_ride_totals: ActivityTotals;
  all_swim_totals: ActivityTotals;
}

export interface ActivityTotals {
  count: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_gain: number;
  achievement_count?: number;
}

export interface StravaZones {
  heart_rate?: { zones: Zone[]; custom_zones: boolean };
  power?: { zones: Zone[] };
}

export interface Zone {
  min: number;
  max: number;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface ResponseFormat {
  response_format?: "markdown" | "json";
}
