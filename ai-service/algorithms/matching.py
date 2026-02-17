"""
Carpool Matching — DBSCAN + Multi-Factor Scoring.

Step 1: Cluster pending rider pickups using DBSCAN
    ε = 2.0 km (Haversine distance)
    MinPts = 2

Step 2: For each driver route, calculate match score with each rider:
    S(d,r) = 0.35·RouteOverlap + 0.25·TimeCompat + 0.15·PrefMatch + 0.25·Proximity

    RouteOverlap: project rider pickup and dropoff onto driver polyline;
        if both project in order (same direction), overlap = segment_length / total_length
    TimeCompat = max(0, 1 − |t_driver − t_rider| / 1800)  [1800s = 30min]
    PrefMatch = 1 if all preference filters pass, else 0
    Proximity = max(0, 1 − haversine(rider_pickup, nearest_route_point) / 2000)

Step 3: Rank by S, accept if S ≥ 0.4
Step 4: Re-route driver through accepted pickups/dropoffs (TSP with nearest-neighbor + 2-opt)
"""

import numpy as np
from sklearn.cluster import DBSCAN
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from utils.haversine import haversine, haversine_km
from config import matching_config


def haversine_distance_matrix(points: List[Tuple[float, float]]) -> np.ndarray:
    """Compute pairwise Haversine distance matrix in km."""
    n = len(points)
    dist_matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            d = haversine_km(points[i][0], points[i][1], points[j][0], points[j][1])
            dist_matrix[i][j] = d
            dist_matrix[j][i] = d
    return dist_matrix


def dbscan_cluster_pickups(
    pickup_points: List[Dict[str, float]],
    eps_km: float = 2.0,
    min_pts: int = 2,
) -> List[int]:
    """DBSCAN clustering on pickup points.

    ε = 2.0 km (configurable)
    MinPts = 2
    Distance metric: Haversine

    Core point p: |{q ∈ D : haversine(p,q) ≤ ε}| ≥ MinPts

    Args:
        pickup_points: list of {"lat": float, "lng": float}
        eps_km: epsilon in km
        min_pts: minimum points for core point

    Returns:
        Cluster labels (-1 = noise)
    """
    if len(pickup_points) < min_pts:
        return [-1] * len(pickup_points)

    points = [(p["lat"], p["lng"]) for p in pickup_points]
    dist_matrix = haversine_distance_matrix(points)

    clustering = DBSCAN(
        eps=eps_km,
        min_samples=min_pts,
        metric="precomputed",
    ).fit(dist_matrix)

    return clustering.labels_.tolist()


def project_point_on_polyline(
    point: Tuple[float, float],
    polyline: List[List[float]],
) -> Tuple[int, float]:
    """Project a point onto the nearest segment of a polyline.

    Returns (segment_index, distance_from_start_m).
    """
    min_dist = float("inf")
    best_idx = 0
    cumulative_dist = 0.0
    best_cumulative = 0.0

    for i in range(len(polyline) - 1):
        seg_start = polyline[i]
        seg_end = polyline[i + 1]

        d = haversine(point[0], point[1], seg_start[0], seg_start[1])
        if d < min_dist:
            min_dist = d
            best_idx = i
            best_cumulative = cumulative_dist

        cumulative_dist += haversine(seg_start[0], seg_start[1], seg_end[0], seg_end[1])

    # Check last point
    d = haversine(point[0], point[1], polyline[-1][0], polyline[-1][1])
    if d < min_dist:
        best_idx = len(polyline) - 2
        best_cumulative = cumulative_dist

    return best_idx, best_cumulative


def calculate_route_overlap(
    driver_polyline: List[List[float]],
    rider_pickup: Tuple[float, float],
    rider_dropoff: Tuple[float, float],
) -> float:
    """Calculate route overlap ratio.

    Project rider pickup and dropoff onto driver polyline.
    If both project in order (same direction):
        overlap_ratio = Σₖ₌ᵢʲ dist(pₖ, pₖ₊₁) / total_length(P)
    Else: overlap_ratio = 0 (opposite direction)
    """
    if len(driver_polyline) < 2:
        return 0.0

    pickup_idx, pickup_dist = project_point_on_polyline(rider_pickup, driver_polyline)
    dropoff_idx, dropoff_dist = project_point_on_polyline(rider_dropoff, driver_polyline)

    # Check if same direction (pickup before dropoff along route)
    if pickup_idx >= dropoff_idx and pickup_dist >= dropoff_dist:
        return 0.0  # Opposite direction

    # Calculate total route length
    total_length = 0.0
    for i in range(len(driver_polyline) - 1):
        total_length += haversine(
            driver_polyline[i][0], driver_polyline[i][1],
            driver_polyline[i + 1][0], driver_polyline[i + 1][1],
        )

    if total_length <= 0:
        return 0.0

    # Calculate overlap segment length
    overlap_length = 0.0
    start_idx = pickup_idx
    end_idx = min(dropoff_idx + 1, len(driver_polyline) - 1)
    for i in range(start_idx, end_idx):
        overlap_length += haversine(
            driver_polyline[i][0], driver_polyline[i][1],
            driver_polyline[i + 1][0], driver_polyline[i + 1][1],
        )

    overlap_ratio = overlap_length / total_length
    return min(overlap_ratio, 1.0)


def calculate_time_compatibility(
    driver_departure: datetime,
    rider_departure: datetime,
) -> float:
    """Calculate time compatibility score.

    TimeCompat = max(0, 1 − |t_driver − t_rider| / 1800)  [1800s = 30min]
    """
    time_diff = abs((driver_departure - rider_departure).total_seconds())
    return max(0.0, 1.0 - time_diff / matching_config.t_max_seconds)


def calculate_preference_match(
    driver_prefs: Dict[str, Any],
    rider_prefs: Dict[str, Any],
) -> float:
    """Calculate preference match.

    PrefMatch = Π(pref_filters) ∈ {0,1}
    Returns 1 if all filters pass, 0 otherwise.
    """
    # Check smoking preference
    if rider_prefs.get("smokingAllowed") is False and driver_prefs.get("smokingAllowed") is True:
        return 0.0

    # Check gender preference
    if rider_prefs.get("sameGenderOnly") and driver_prefs.get("gender") != rider_prefs.get("gender"):
        return 0.0

    # Check music preference
    rider_music = rider_prefs.get("musicPreference", "no_preference")
    driver_music = driver_prefs.get("musicPreference", "no_preference")
    if rider_music == "silent" and driver_music != "silent" and driver_music != "no_preference":
        return 0.0

    return 1.0


def calculate_proximity_score(
    rider_pickup: Tuple[float, float],
    driver_polyline: List[List[float]],
    epsilon_m: float = 2000.0,
) -> float:
    """Calculate proximity score.

    Proximity = max(0, 1 − haversine(rider_pickup, nearest_point_on_route_d) / ε)
    """
    min_dist = float("inf")
    for point in driver_polyline:
        d = haversine(rider_pickup[0], rider_pickup[1], point[0], point[1])
        if d < min_dist:
            min_dist = d

    return max(0.0, 1.0 - min_dist / epsilon_m)


def calculate_match_score(
    driver_ride: Dict[str, Any],
    rider_request: Dict[str, Any],
) -> Dict[str, Any]:
    """Calculate composite matching score.

    S(d,r) = w₁·RouteOverlap + w₂·TimeCompat + w₃·PrefMatch + w₄·ProximityScore
    w₁=0.35, w₂=0.25, w₃=0.15, w₄=0.25

    Rank matches by S descending; threshold S ≥ 0.4
    """
    cfg = matching_config

    driver_polyline = driver_ride.get("polyline", [])
    rider_pickup = (
        rider_request["origin"]["lat"],
        rider_request["origin"]["lng"],
    )
    rider_dropoff = (
        rider_request["destination"]["lat"],
        rider_request["destination"]["lng"],
    )

    # RouteOverlap ∈ [0,1]
    route_overlap = calculate_route_overlap(driver_polyline, rider_pickup, rider_dropoff)

    # TimeCompat ∈ [0,1]
    driver_time = datetime.fromisoformat(driver_ride["departureTime"].replace("Z", "+00:00")) if isinstance(driver_ride["departureTime"], str) else driver_ride["departureTime"]
    rider_time = datetime.fromisoformat(rider_request["departureTime"].replace("Z", "+00:00")) if isinstance(rider_request["departureTime"], str) else rider_request["departureTime"]
    time_compat = calculate_time_compatibility(driver_time, rider_time)

    # PrefMatch ∈ {0,1}
    driver_prefs = driver_ride.get("preferences", {})
    rider_prefs = rider_request.get("preferences", {})
    pref_match = calculate_preference_match(driver_prefs, rider_prefs)

    # ProximityScore ∈ [0,1]
    proximity = calculate_proximity_score(rider_pickup, driver_polyline)

    # S(d,r) = w₁·RouteOverlap + w₂·TimeCompat + w₃·PrefMatch + w₄·Proximity
    score = (
        cfg.w_route_overlap * route_overlap
        + cfg.w_time_compat * time_compat
        + cfg.w_pref_match * pref_match
        + cfg.w_proximity * proximity
    )

    # Calculate detour
    detour_km = 0.0
    if driver_polyline and len(driver_polyline) >= 2:
        direct_dist = haversine_km(
            driver_polyline[0][0], driver_polyline[0][1],
            driver_polyline[-1][0], driver_polyline[-1][1],
        )
        pickup_detour = haversine_km(
            rider_pickup[0], rider_pickup[1],
            driver_polyline[0][0], driver_polyline[0][1],
        )
        detour_km = pickup_detour * 0.5  # Approximate

    return {
        "rideId": driver_ride.get("rideId", driver_ride.get("_id", "")),
        "score": round(score, 4),
        "routeOverlap": round(route_overlap, 4),
        "timeCompat": round(time_compat, 4),
        "prefMatch": round(pref_match, 4),
        "proximity": round(proximity, 4),
        "detourKm": round(detour_km, 2),
        "detourMinutes": round(detour_km / 30 * 60, 1),  # Rough estimate at 30km/h
        "isValid": score >= cfg.min_match_score,
    }


def match_rides(
    rider_request: Dict[str, Any],
    available_rides: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Match a rider with available rides.

    1. DBSCAN cluster rider with existing pickups
    2. Calculate match score for each ride
    3. Sort by score descending
    4. Filter by minimum score threshold (0.4)
    """
    matches = []

    for ride in available_rides:
        result = calculate_match_score(ride, rider_request)
        if result["isValid"]:
            matches.append(result)

    # Sort by score descending
    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches


def nearest_neighbor_tsp(
    start: Tuple[float, float],
    waypoints: List[Tuple[float, float]],
    end: Tuple[float, float],
) -> List[int]:
    """Solve TSP using nearest-neighbor heuristic for waypoint ordering.

    Returns ordered indices of waypoints.
    """
    if not waypoints:
        return []

    n = len(waypoints)
    visited = [False] * n
    order = []
    current = start

    for _ in range(n):
        min_dist = float("inf")
        nearest_idx = -1
        for i in range(n):
            if not visited[i]:
                d = haversine(current[0], current[1], waypoints[i][0], waypoints[i][1])
                if d < min_dist:
                    min_dist = d
                    nearest_idx = i
        if nearest_idx >= 0:
            visited[nearest_idx] = True
            order.append(nearest_idx)
            current = waypoints[nearest_idx]

    return order


def two_opt_improve(
    waypoints: List[Tuple[float, float]],
    order: List[int],
    start: Tuple[float, float],
    end: Tuple[float, float],
) -> List[int]:
    """Improve waypoint ordering using 2-opt local search."""
    improved = True
    best_order = list(order)

    def total_distance(ord_list: List[int]) -> float:
        d = haversine(start[0], start[1], waypoints[ord_list[0]][0], waypoints[ord_list[0]][1])
        for i in range(len(ord_list) - 1):
            d += haversine(
                waypoints[ord_list[i]][0], waypoints[ord_list[i]][1],
                waypoints[ord_list[i + 1]][0], waypoints[ord_list[i + 1]][1],
            )
        d += haversine(
            waypoints[ord_list[-1]][0], waypoints[ord_list[-1]][1],
            end[0], end[1],
        )
        return d

    best_dist = total_distance(best_order)

    max_iter = 100
    while improved and max_iter > 0:
        max_iter -= 1
        improved = False
        for i in range(len(best_order) - 1):
            for j in range(i + 1, len(best_order)):
                new_order = best_order[:i] + best_order[i:j + 1][::-1] + best_order[j + 1:]
                new_dist = total_distance(new_order)
                if new_dist < best_dist:
                    best_order = new_order
                    best_dist = new_dist
                    improved = True

    return best_order


def optimize_waypoint_order(
    origin: Tuple[float, float],
    destination: Tuple[float, float],
    waypoints: List[Tuple[float, float]],
) -> List[int]:
    """Optimize waypoint ordering using nearest-neighbor + 2-opt.

    Returns ordered indices.
    """
    if len(waypoints) <= 1:
        return list(range(len(waypoints)))

    # Initial order via nearest-neighbor
    order = nearest_neighbor_tsp(origin, waypoints, destination)

    # Improve with 2-opt
    order = two_opt_improve(waypoints, order, origin, destination)

    return order
