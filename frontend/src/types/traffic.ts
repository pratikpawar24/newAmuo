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
