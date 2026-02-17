"""
Time-Dependent A* Routing on Road Network Graph.

Haversine heuristic h(n, goal):
    a = sin²(Δφ/2) + cos(φ₁)·cos(φ₂)·sin²(Δλ/2)
    h = 2 × 6371000 × arctan2(√a, √(1−a)) / v_max_global

Time-dependent edge weight w(e, t):
    IF LSTM prediction available for edge e at time t:
        w(e,t) = length(e) / v_predicted(e, t)
    ELSE use BPR function:
        t₀ = length(e) / free_flow_speed(e)
        w(e,t) = t₀ × [1 + 0.15 × (volume(e,t)/capacity(e))⁴]

A* with time expansion:
    f(n, t) = g(n, t) + h(n)
    g(n, t) = cumulative travel time arriving at n at time t
    Priority queue orders by f(n, t)

Multi-objective cost function:
    Cost(path) = α·T(path) + β·E(path) + γ·D(path)
    T = Σ w(eᵢ, tᵢ) in seconds
    E = Σ length_km(eᵢ) × EF(v_predicted(eᵢ)) in gCO₂
    D = Σ length(eᵢ) in meters
    α + β + γ = 1
"""

import heapq
import math
import time as time_module
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta

import networkx as nx

from utils.haversine import haversine
from algorithms.emissions import emission_factor
from config import graph_config, routing_config


def heuristic(
    G: nx.DiGraph,
    node: int,
    goal: int,
    v_max_ms: float,
) -> float:
    """Haversine heuristic (admissible, consistent).

    h(n, goal) = 2R · arctan2(√a, √(1−a)) / v_max

    Args:
        G: the road network graph
        node: current node
        goal: goal node
        v_max_ms: maximum speed in m/s

    Returns:
        Estimated time in seconds to reach goal from node
    """
    node_data = G.nodes[node]
    goal_data = G.nodes[goal]
    dist_m = haversine(node_data["lat"], node_data["lng"], goal_data["lat"], goal_data["lng"])
    return dist_m / v_max_ms if v_max_ms > 0 else float("inf")


def bpr_travel_time(
    length_m: float,
    free_flow_speed_kmh: float,
    volume: float,
    capacity: float,
) -> float:
    """BPR (Bureau of Public Roads) function for travel time.

    t(e) = t₀(e) × [1 + 0.15 × (volume(e)/capacity(e))⁴]
    t₀(e) = length(e) / free_flow_speed(e)

    Args:
        length_m: edge length in meters
        free_flow_speed_kmh: free flow speed in km/h
        volume: current traffic volume
        capacity: edge capacity

    Returns:
        Travel time in seconds
    """
    free_flow_speed_ms = free_flow_speed_kmh / 3.6
    if free_flow_speed_ms <= 0:
        return float("inf")

    t0 = length_m / free_flow_speed_ms  # free flow travel time in seconds

    vc_ratio = volume / capacity if capacity > 0 else 0.0
    travel_time = t0 * (1.0 + graph_config.bpr_alpha * (vc_ratio ** graph_config.bpr_beta))
    return travel_time


def time_dependent_weight(
    edge_data: Dict[str, Any],
    current_time: datetime,
    traffic_predictions: Optional[Dict[str, Dict]] = None,
    edge_key: Optional[str] = None,
) -> Tuple[float, float]:
    """Calculate time-dependent edge weight.

    w(e, t) = length(e) / v_predicted(e, t)
    When no LSTM prediction available, use BPR function.

    Args:
        edge_data: edge attributes from graph
        current_time: current simulation time
        traffic_predictions: dict of {segment_id: {speed, flow, congestion}}
        edge_key: identifier for this edge segment

    Returns:
        (travel_time_seconds, predicted_speed_kmh)
    """
    length_m = edge_data["length_m"]
    free_flow_speed = edge_data.get("free_flow_speed_kmh", edge_data.get("speed_limit_kmh", 40.0))
    capacity = edge_data.get("capacity", 1800)

    predicted_speed = None

    # Check if LSTM prediction is available
    if traffic_predictions and edge_key and edge_key in traffic_predictions:
        pred = traffic_predictions[edge_key]
        predicted_speed = pred.get("speed", None)
        if predicted_speed and predicted_speed > 0:
            # w(e,t) = length(e) / v_predicted(e, t)
            speed_ms = predicted_speed / 3.6
            travel_time = length_m / speed_ms
            return travel_time, predicted_speed

    # BPR fallback
    # Estimate volume based on time of day
    hour = current_time.hour + current_time.minute / 60.0
    # Simple volume model based on time of day
    if 7 <= hour < 9 or 17 <= hour < 19:
        volume_ratio = 0.85  # Peak hours
    elif 9 <= hour < 17:
        volume_ratio = 0.6   # Midday
    elif 5 <= hour < 7 or 19 <= hour < 22:
        volume_ratio = 0.4   # Shoulders
    else:
        volume_ratio = 0.15  # Night

    volume = capacity * volume_ratio
    travel_time = bpr_travel_time(length_m, free_flow_speed, volume, capacity)
    effective_speed = (length_m / travel_time * 3.6) if travel_time > 0 else free_flow_speed

    return travel_time, effective_speed


def multi_objective_cost(
    travel_time_s: float,
    distance_m: float,
    speed_kmh: float,
    alpha: float,
    beta: float,
    gamma: float,
) -> float:
    """Multi-objective cost function.

    Cost(path) = α·T(path) + β·E(path) + γ·D(path)
    T = travel time in seconds (normalized)
    E = emissions in gCO₂ (normalized)
    D = distance in meters (normalized)

    α + β + γ = 1
    """
    distance_km = distance_m / 1000.0
    co2_grams = distance_km * emission_factor(speed_kmh)

    # Normalize to make components comparable
    t_norm = travel_time_s / 60.0   # minutes
    e_norm = co2_grams / 100.0       # per 100g
    d_norm = distance_m / 1000.0     # km

    return alpha * t_norm + beta * e_norm + gamma * d_norm


def astar_route(
    G: nx.DiGraph,
    start: int,
    goal: int,
    departure_time: datetime,
    alpha: float = 0.5,
    beta: float = 0.35,
    gamma: float = 0.15,
    traffic_predictions: Optional[Dict[str, Dict]] = None,
) -> Optional[Dict[str, Any]]:
    """Time-Dependent A* with multi-objective cost.

    f(n, t) = g(n, t) + h(n)
    g(n, t) = cumulative travel time arriving at n at time t
    Priority queue orders by f(n, t)

    When expanding node n at time t:
        for each neighbor m via edge e:
            t_arrival = t + w(e, t)    // time-dependent weight
            g_new = g(n, t) + w(e, t)
            if g_new < g(m, *):
                update g(m, t_arrival) = g_new

    Returns:
        Dict with path, polyline, distance, duration, co2, cost or None if no path.
    """
    if start not in G or goal not in G:
        return None

    # Maximum speed in graph (for admissible heuristic)
    v_max_kmh = graph_config.v_max_kmh
    v_max_ms = v_max_kmh / 3.6

    # Priority queue: (f_cost, counter, node, arrival_time, g_cost)
    counter = 0
    open_set: List[Tuple[float, int, int, datetime, float]] = []
    h_start = heuristic(G, start, goal, v_max_ms)
    heapq.heappush(open_set, (h_start, counter, start, departure_time, 0.0))

    # g_scores: node -> best g cost found
    g_scores: Dict[int, float] = {start: 0.0}
    # came_from: node -> (parent_node, edge_data)
    came_from: Dict[int, Tuple[int, Dict]] = {}
    # arrival_times: node -> arrival time
    arrival_times: Dict[int, datetime] = {start: departure_time}

    # Track per-edge data for result construction
    edge_costs: Dict[int, Dict[str, float]] = {}

    visited = set()
    max_iterations = 100000

    while open_set and max_iterations > 0:
        max_iterations -= 1
        f_cost, _, current, current_time, current_g = heapq.heappop(open_set)

        if current == goal:
            # Reconstruct path
            path = []
            node = goal
            while node in came_from:
                path.append(node)
                node = came_from[node][0]
            path.append(start)
            path.reverse()

            # Build result
            polyline = []
            total_distance_m = 0.0
            total_duration_s = 0.0
            total_co2_g = 0.0

            for i in range(len(path)):
                node_data = G.nodes[path[i]]
                polyline.append([node_data["lat"], node_data["lng"]])

            for i in range(len(path) - 1):
                edge_data = G.edges[path[i], path[i + 1]]
                edge_info = edge_costs.get(path[i + 1], {})
                seg_dist = edge_data["length_m"]
                seg_time = edge_info.get("travel_time", seg_dist / (40 / 3.6))
                seg_speed = edge_info.get("speed", 40.0)

                total_distance_m += seg_dist
                total_duration_s += seg_time
                total_co2_g += (seg_dist / 1000.0) * emission_factor(seg_speed)

            return {
                "path_nodes": path,
                "polyline": polyline,
                "distanceKm": total_distance_m / 1000.0,
                "durationMin": total_duration_s / 60.0,
                "co2Grams": total_co2_g,
                "cost": current_g,
                "nodesExplored": 100000 - max_iterations,
            }

        if current in visited:
            continue
        visited.add(current)

        # Expand neighbors
        for neighbor in G.successors(current):
            if neighbor in visited:
                continue

            edge_data = G.edges[current, neighbor]

            # Time-dependent weight: w(e, t)
            edge_key = f"{current}-{neighbor}"
            travel_time, pred_speed = time_dependent_weight(
                edge_data, current_time, traffic_predictions, edge_key
            )

            # Multi-objective edge cost
            edge_cost = multi_objective_cost(
                travel_time,
                edge_data["length_m"],
                pred_speed,
                alpha, beta, gamma,
            )

            g_new = current_g + edge_cost

            if g_new < g_scores.get(neighbor, float("inf")):
                g_scores[neighbor] = g_new
                t_arrival = current_time + timedelta(seconds=travel_time)
                arrival_times[neighbor] = t_arrival
                came_from[neighbor] = (current, edge_data)
                edge_costs[neighbor] = {
                    "travel_time": travel_time,
                    "speed": pred_speed,
                    "distance": edge_data["length_m"],
                }

                h = heuristic(G, neighbor, goal, v_max_ms)
                f_new = g_new + h

                counter += 1
                heapq.heappush(open_set, (f_new, counter, neighbor, t_arrival, g_new))

    return None  # No path found


def get_traffic_overlay(
    G: nx.DiGraph,
    path_nodes: List[int],
    traffic_predictions: Optional[Dict[str, Dict]] = None,
    current_time: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """Generate traffic congestion overlay data for map visualization.

    Returns list of {lat, lng, congestion} for each point on the path.
    """
    if current_time is None:
        current_time = datetime.now()

    overlay = []
    for i in range(len(path_nodes) - 1):
        n1 = path_nodes[i]
        n2 = path_nodes[i + 1]

        if not G.has_edge(n1, n2):
            continue

        edge_data = G.edges[n1, n2]
        edge_key = f"{n1}-{n2}"

        _, speed = time_dependent_weight(edge_data, current_time, traffic_predictions, edge_key)

        free_flow = edge_data.get("free_flow_speed_kmh", 40.0)
        congestion = max(0.0, min(1.0, 1.0 - speed / free_flow)) if free_flow > 0 else 0.0

        node_data = G.nodes[n1]
        overlay.append({
            "lat": node_data["lat"],
            "lng": node_data["lng"],
            "congestion": round(congestion, 3),
            "speed": round(speed, 1),
        })

    # Add last node
    if path_nodes:
        last_node = G.nodes[path_nodes[-1]]
        overlay.append({
            "lat": last_node["lat"],
            "lng": last_node["lng"],
            "congestion": overlay[-1]["congestion"] if overlay else 0.0,
            "speed": overlay[-1]["speed"] if overlay else 40.0,
        })

    return overlay
