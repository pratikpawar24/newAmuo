"""
COPERT IV Speed-Dependent Emission Calculator.

EF(v) in g CO₂/km:
    fuel_consumption(v) = 0.0667 + 0.0556/v + 0.000472·v²  [L/km]
    EF(v) = 2310 × fuel_consumption(v)  [g CO₂/km]
    (2310 g CO₂ per liter of petrol)

Per-ride total emissions:
    CO₂_ride = Σ_segments [length_km(s) × EF(v_avg(s))]

Carpool savings:
    CO₂_saved = Σᵢ₌₁ⁿ (dᵢ × EF(vᵢ)) − d_shared × EF(v_shared)
    percentage_saved = CO₂_saved / Σᵢ (dᵢ × EF(vᵢ)) × 100
"""

from typing import List, Dict, Any
from config import emission_config


def fuel_consumption(speed_kmh: float) -> float:
    """Calculate fuel consumption in L/km using simplified COPERT model.

    fuel_consumption(v) = 0.0667 + 0.0556/v + 0.000472·v²  [L/km]
    """
    v = max(speed_kmh, 5.0)  # Avoid division by zero, minimum 5 km/h
    fc = emission_config.fuel_a + emission_config.fuel_b / v + emission_config.fuel_c * v ** 2
    return max(fc, 0.01)  # Minimum consumption


def emission_factor(speed_kmh: float) -> float:
    """Calculate emission factor in g CO₂/km.

    EF(v) = 2310 × fuel_consumption(v)  [g CO₂/km]
    """
    fc = fuel_consumption(speed_kmh)
    ef = emission_config.co2_per_liter * fc
    return ef


def emission_factor_by_fuel_type(speed_kmh: float, fuel_type: str = "petrol") -> float:
    """Calculate emission factor adjusted for fuel type.

    Petrol: baseline (2310 g CO₂/L)
    Diesel: 2680 g CO₂/L
    Hybrid: 50% of petrol
    Electric: 0 (direct emissions)
    """
    if fuel_type == "electric":
        return 0.0

    v = max(speed_kmh, 5.0)
    fc = emission_config.fuel_a + emission_config.fuel_b / v + emission_config.fuel_c * v ** 2
    fc = max(fc, 0.01)

    co2_per_liter = {
        "petrol": 2310.0,
        "diesel": 2680.0,
        "hybrid": 2310.0 * 0.5,
    }.get(fuel_type, 2310.0)

    return co2_per_liter * fc


def calculate_ride_emissions(
    segments: List[Dict[str, float]],
    fuel_type: str = "petrol",
) -> float:
    """Calculate total CO₂ emissions for a ride.

    CO₂_ride = Σ_segments [length_km(s) × EF(v_avg(s))]

    Args:
        segments: list of {"distanceKm": float, "avgSpeedKmh": float}
        fuel_type: vehicle fuel type

    Returns:
        Total CO₂ in grams
    """
    total_co2 = 0.0
    for seg in segments:
        distance_km = seg.get("distanceKm", 0.0)
        avg_speed = seg.get("avgSpeedKmh", 30.0)
        ef = emission_factor_by_fuel_type(avg_speed, fuel_type)
        total_co2 += distance_km * ef
    return total_co2


def calculate_carpool_savings(
    individual_trips: List[Dict[str, float]],
    shared_trip: Dict[str, float],
    fuel_type: str = "petrol",
) -> Dict[str, float]:
    """Calculate carpool CO₂ savings.

    CO₂_saved = Σᵢ₌₁ⁿ (dᵢ × EF(vᵢ)) − d_shared × EF(v_shared)
    percentage_saved = CO₂_saved / Σᵢ (dᵢ × EF(vᵢ)) × 100

    Args:
        individual_trips: list of {"distanceKm": float, "avgSpeedKmh": float}
        shared_trip: {"distanceKm": float, "avgSpeedKmh": float}

    Returns:
        {"co2_saved_g": float, "percentage_saved": float, "individual_total_g": float, "shared_total_g": float}
    """
    individual_total = 0.0
    for trip in individual_trips:
        d = trip.get("distanceKm", 0.0)
        v = trip.get("avgSpeedKmh", 30.0)
        ef = emission_factor_by_fuel_type(v, fuel_type)
        individual_total += d * ef

    shared_d = shared_trip.get("distanceKm", 0.0)
    shared_v = shared_trip.get("avgSpeedKmh", 30.0)
    shared_ef = emission_factor_by_fuel_type(shared_v, fuel_type)
    shared_total = shared_d * shared_ef

    co2_saved = individual_total - shared_total
    percentage_saved = (co2_saved / individual_total * 100) if individual_total > 0 else 0.0

    return {
        "co2_saved_g": max(co2_saved, 0.0),
        "percentage_saved": max(percentage_saved, 0.0),
        "individual_total_g": individual_total,
        "shared_total_g": shared_total,
    }


def co2_to_tree_days(co2_grams: float) -> float:
    """Convert CO₂ saved to equivalent tree-days.

    A mature tree absorbs approximately 22 kg (22000 g) of CO₂ per year ≈ 60.3 g/day.
    """
    tree_absorption_per_day_g = 22000.0 / 365.0  # ~60.3 g/day
    return co2_grams / tree_absorption_per_day_g
