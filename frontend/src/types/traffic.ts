export interface TrafficPrediction {
  segmentId: string;
  flow: number;
  speed: number;
  density: number;
  congestionLevel: 'free' | 'light' | 'moderate' | 'heavy' | 'gridlock';
  lat?: number;
  lng?: number;
}

export interface TrafficHeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

export interface RouteResult {
  path: Array<{ lat: number; lng: number }>;
  distance_km: number;
  duration_min: number;
  emissions_g: number;
  cost: number;
}

// ── AUMO-ORION Types ────────────────────────────────────────────────

export interface RouteSegment {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  distance_km: number;
  travel_time_min: number;
  speed_kmh: number;
  congestion: number;
  co2_grams: number;
}

export interface OrionRouteResult extends RouteResult {
  algorithm: string;
  segments: RouteSegment[];
  efficiency_ratio: number;
  search_time_ms: number;
  arrival_time: string;
  weights: { alpha: number; beta: number; gamma: number };
}

export interface ParetoRoute {
  name: string;
  description: string;
  route: OrionRouteResult;
  isSelected?: boolean;
}

export interface ParetoRoutesResponse {
  success: boolean;
  routes: ParetoRoute[];
  count: number;
  departure: string;
}

export interface ReplanStatus {
  replan_count: number;
  max_replans: number;
  last_replan_time: string | null;
  current_cost: number | null;
  cooldown_active: boolean;
}

export interface ReplanResult {
  success: boolean;
  replanned: boolean;
  reason?: string;
  route?: OrionRouteResult;
  status: ReplanStatus;
}

export interface AdvancedPrediction {
  segmentId: string;
  speed: number;
  flow: number;
  congestion: number;
  confidence: number;
  model: 'ST-GAT' | 'LSTM' | 'fallback';
}
