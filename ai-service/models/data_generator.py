"""
Synthetic Traffic Data Generator for LSTM model training.

Generates 90 days of traffic data for 50 road segments:
  - Peak hours (7-9 AM, 5-7 PM): higher flow, lower speed
  - Weekends: 30% less traffic
  - Random incidents: 5% chance per segment per hour causing 50% speed drop
  - Weather effects: rain reduces speed by 15%, snow by 30%

Feature vector per timestep (dim=10):
  [flow, speed, density, sin(2π·hour/24), cos(2π·hour/24),
   sin(2π·day/7), cos(2π·day/7), is_holiday, weather_code, precipitation]
"""

import numpy as np
import pandas as pd
from typing import Tuple
from config import synthetic_config, model_config


def generate_sinusoidal_time_features(hour: float, day_of_week: int) -> Tuple[float, float, float, float]:
    """Generate sinusoidal time encodings.

    hour_sin = sin(2π × hour / 24)
    hour_cos = cos(2π × hour / 24)
    day_sin  = sin(2π × day_of_week / 7)
    day_cos  = cos(2π × day_of_week / 7)

    This captures cyclical nature — hour 23 and hour 0 are close.
    """
    hour_sin = np.sin(2 * np.pi * hour / 24.0)
    hour_cos = np.cos(2 * np.pi * hour / 24.0)
    day_sin = np.sin(2 * np.pi * day_of_week / 7.0)
    day_cos = np.cos(2 * np.pi * day_of_week / 7.0)
    return hour_sin, hour_cos, day_sin, day_cos


def generate_base_traffic(hour: float, is_weekend: bool) -> Tuple[float, float]:
    """Generate base flow and speed for a given hour.

    Peak hours: 7-9 AM, 5-7 PM have higher flow, lower speed.
    Weekends: 30% less traffic.
    """
    cfg = synthetic_config

    # Base flow pattern (vehicles/5min): sinusoidal with peaks
    base_flow = 30.0
    # Morning peak
    if cfg.peak_morning[0] <= hour < cfg.peak_morning[1]:
        peak_factor = 1.0 - abs(hour - 8.0) / 1.0
        base_flow += 50.0 * max(0, peak_factor)
    # Evening peak
    elif cfg.peak_evening[0] <= hour < cfg.peak_evening[1]:
        peak_factor = 1.0 - abs(hour - 18.0) / 1.0
        base_flow += 60.0 * max(0, peak_factor)
    # Midday moderate
    elif 10 <= hour < 16:
        base_flow += 20.0
    # Night low
    elif hour < 5 or hour >= 22:
        base_flow = 10.0

    # Base speed (km/h)
    free_flow_speed = 60.0
    # Speed inversely related to flow
    congestion_factor = min(1.0, base_flow / 90.0)
    base_speed = free_flow_speed * (1.0 - 0.6 * congestion_factor)

    # Weekend: 30% less traffic
    if is_weekend:
        base_flow *= (1.0 - cfg.weekend_reduction)
        base_speed *= 1.15  # Less congestion

    return base_flow, base_speed


def apply_weather_effects(speed: float, weather_code: int) -> Tuple[float, float]:
    """Apply weather effects to speed.

    weather_code:
        0 = clear
        1 = cloudy
        2 = rain
        3 = snow

    Rain reduces speed by 15%, snow by 30%.
    Returns (adjusted_speed, precipitation_mm)
    """
    cfg = synthetic_config
    precipitation = 0.0

    if weather_code == 2:  # rain
        speed *= (1.0 - cfg.rain_speed_reduction)
        precipitation = np.random.uniform(1.0, 15.0)
    elif weather_code == 3:  # snow
        speed *= (1.0 - cfg.snow_speed_reduction)
        precipitation = np.random.uniform(2.0, 20.0)
    elif weather_code == 1:  # cloudy
        precipitation = np.random.uniform(0.0, 1.0)

    return speed, precipitation


def apply_incident(speed: float, has_incident: bool) -> float:
    """Apply incident effects: 50% speed drop."""
    if has_incident:
        speed *= synthetic_config.incident_speed_factor
    return speed


def generate_synthetic_data() -> Tuple[np.ndarray, np.ndarray]:
    """Generate synthetic training data.

    Returns:
        X: (num_samples, lookback=12, features=10) input sequences
        y: (num_samples, forecast=6, outputs=3) target sequences
    """
    cfg = synthetic_config
    mcfg = model_config
    np.random.seed(42)

    num_intervals_per_day = 24 * 60 // cfg.interval_minutes  # 288
    total_intervals = cfg.num_days * num_intervals_per_day

    # Holidays (random 10 days)
    holidays = set(np.random.choice(cfg.num_days, size=10, replace=False))

    all_data = {}

    for seg_id in range(cfg.num_segments):
        segment_data = []

        # Segment-specific characteristics
        seg_free_flow = np.random.uniform(40.0, 80.0)
        seg_capacity_factor = np.random.uniform(0.7, 1.3)

        # Generate weather pattern for this segment (changes every ~6 hours)
        weather_sequence = []
        for day in range(cfg.num_days):
            daily_weather = np.random.choice([0, 0, 0, 1, 1, 2, 3], p=[0.3, 0.2, 0.15, 0.15, 0.1, 0.07, 0.03])
            for _ in range(num_intervals_per_day):
                weather_sequence.append(daily_weather)

        for interval in range(total_intervals):
            day = interval // num_intervals_per_day
            time_in_day = interval % num_intervals_per_day
            hour = time_in_day * cfg.interval_minutes / 60.0
            day_of_week = day % 7
            is_weekend = day_of_week >= 5
            is_holiday = day in holidays

            # Base traffic
            base_flow, base_speed = generate_base_traffic(hour, is_weekend or is_holiday)

            # Scale to segment characteristics
            base_speed = base_speed * (seg_free_flow / 60.0)
            base_flow = base_flow * seg_capacity_factor

            # Weather effects
            weather_code = weather_sequence[interval]
            speed, precipitation = apply_weather_effects(base_speed, weather_code)

            # Random incidents: 5% chance per segment per hour
            has_incident = np.random.random() < (cfg.incident_probability / (60 / cfg.interval_minutes))
            speed = apply_incident(speed, has_incident)

            # Add noise
            flow = max(0, base_flow + np.random.normal(0, 5))
            speed = max(5, speed + np.random.normal(0, 3))

            # Density = flow / speed (fundamental traffic relationship)
            density = flow / max(speed, 1.0)

            # Congestion level (0-1)
            congestion = min(1.0, density / (seg_capacity_factor * 1.5))

            # Time features: sinusoidal encoding
            hour_sin, hour_cos, day_sin, day_cos = generate_sinusoidal_time_features(hour, day_of_week)

            # xₜ = [flow_t, speed_t, density_t, hour_sin, hour_cos, day_sin, day_cos, is_holiday, weather_code, precipitation_mm]
            feature_vector = [
                flow,
                speed,
                density,
                hour_sin,
                hour_cos,
                day_sin,
                day_cos,
                float(is_holiday),
                float(weather_code),
                precipitation,
            ]

            segment_data.append(feature_vector)

        all_data[seg_id] = np.array(segment_data)

    # Create sliding window sequences
    lookback = mcfg.lookback  # 12
    forecast = mcfg.forecast  # 6

    X_list = []
    y_list = []

    for seg_id in range(cfg.num_segments):
        data = all_data[seg_id]
        total_len = len(data)

        for i in range(lookback, total_len - forecast):
            # Input: lookback timesteps of all 10 features
            X_list.append(data[i - lookback: i])

            # Target: next forecast timesteps of [speed, flow, congestion]
            target_data = data[i: i + forecast]
            # Extract speed (idx=1), flow (idx=0), congestion (derived from density idx=2)
            targets = np.column_stack([
                target_data[:, 1],  # speed
                target_data[:, 0],  # flow
                np.clip(target_data[:, 2] / 1.5, 0, 1),  # congestion level
            ])
            y_list.append(targets)

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.float32)

    print(f"[DataGenerator] Generated {X.shape[0]} samples")
    print(f"[DataGenerator] X shape: {X.shape}, y shape: {y.shape}")

    return X, y


def normalize_data(X: np.ndarray, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray, dict]:
    """Normalize features using min-max scaling.

    Returns normalized X, y, and scaler parameters for inference.
    """
    x_min = X.reshape(-1, X.shape[-1]).min(axis=0)
    x_max = X.reshape(-1, X.shape[-1]).max(axis=0)
    x_range = x_max - x_min
    x_range[x_range == 0] = 1.0

    y_min = y.reshape(-1, y.shape[-1]).min(axis=0)
    y_max = y.reshape(-1, y.shape[-1]).max(axis=0)
    y_range = y_max - y_min
    y_range[y_range == 0] = 1.0

    X_norm = (X - x_min) / x_range
    y_norm = (y - y_min) / y_range

    scaler = {
        "x_min": x_min.tolist(),
        "x_max": x_max.tolist(),
        "y_min": y_min.tolist(),
        "y_max": y_max.tolist(),
    }

    return X_norm, y_norm, scaler
