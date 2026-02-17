"""AUMO v2 AI Service Configuration."""
import os
from dataclasses import dataclass, field
from typing import Tuple


@dataclass
class ModelConfig:
    input_dim: int = 10
    hidden_dim_1: int = 128
    hidden_dim_2: int = 64
    num_layers: int = 2
    output_dim: int = 3
    dropout: float = 0.3
    lookback: int = 12
    forecast: int = 6
    batch_size: int = 64
    epochs: int = 100
    learning_rate: float = 0.001
    lr_patience: int = 5
    lr_factor: float = 0.5
    early_stop_patience: int = 10
    l2_lambda: float = 0.01
    temporal_lambda: float = 0.001


@dataclass
class GraphConfig:
    osm_bbox: Tuple[float, float, float, float] = field(default_factory=lambda: (
        float(os.getenv("OSM_BBOX", "12.85,77.45,13.15,77.75").split(",")[0]),
        float(os.getenv("OSM_BBOX", "12.85,77.45,13.15,77.75").split(",")[1]),
        float(os.getenv("OSM_BBOX", "12.85,77.45,13.15,77.75").split(",")[2]),
        float(os.getenv("OSM_BBOX", "12.85,77.45,13.15,77.75").split(",")[3]),
    ))
    v_max_kmh: float = 120.0
    bpr_alpha: float = 0.15
    bpr_beta: float = 4.0


@dataclass
class MatchingConfig:
    dbscan_eps_km: float = 2.0
    dbscan_min_pts: int = 2
    max_detour_ratio: float = 0.3
    min_match_score: float = 0.4
    w_route_overlap: float = 0.35
    w_time_compat: float = 0.25
    w_pref_match: float = 0.15
    w_proximity: float = 0.25
    t_max_seconds: float = 1800.0


@dataclass
class RoutingConfig:
    default_alpha: float = 0.5
    default_beta: float = 0.35
    default_gamma: float = 0.15


@dataclass
class EmissionConfig:
    fuel_a: float = 0.0667
    fuel_b: float = 0.0556
    fuel_c: float = 0.000472
    co2_per_liter: float = 2310.0


@dataclass
class SyntheticDataConfig:
    num_days: int = 90
    num_segments: int = 50
    interval_minutes: int = 5
    peak_morning: Tuple[int, int] = (7, 9)
    peak_evening: Tuple[int, int] = (17, 19)
    weekend_reduction: float = 0.3
    incident_probability: float = 0.05
    incident_speed_factor: float = 0.5
    rain_speed_reduction: float = 0.15
    snow_speed_reduction: float = 0.30


OSRM_URL = os.getenv("OSRM_URL", "http://localhost:5001")
MODEL_PATH = os.getenv("MODEL_PATH", "saved_models/traffic_lstm.pt")
API_KEY = os.getenv("API_KEY", "aumo-ai-api-key-change-in-production")

model_config = ModelConfig()
graph_config = GraphConfig()
matching_config = MatchingConfig()
routing_config = RoutingConfig()
emission_config = EmissionConfig()
synthetic_config = SyntheticDataConfig()
