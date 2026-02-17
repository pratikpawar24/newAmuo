"""Haversine distance calculation.

a = sin²(Δφ/2) + cos(φ₁)·cos(φ₂)·sin²(Δλ/2)
d = 2R · arctan2(√a, √(1−a))
where R = 6,371,000 m
"""

import math
from typing import Tuple

EARTH_RADIUS_M = 6_371_000.0


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the Haversine distance between two points in meters.

    a = sin²(Δφ/2) + cos(φ₁)·cos(φ₂)·sin²(Δλ/2)
    d = 2R · arctan2(√a, √(1−a))
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    d = 2 * EARTH_RADIUS_M * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return d


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in kilometers."""
    return haversine(lat1, lng1, lat2, lng2) / 1000.0


def haversine_np(lat1: float, lng1: float, lats: list, lngs: list) -> list:
    """Vectorized haversine for a point against an array of points. Returns meters."""
    import numpy as np

    phi1 = np.radians(lat1)
    phi2 = np.radians(lats)
    dphi = np.radians(np.array(lats) - lat1)
    dlam = np.radians(np.array(lngs) - lng1)

    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlam / 2) ** 2
    d = 2 * EARTH_RADIUS_M * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return d.tolist()
