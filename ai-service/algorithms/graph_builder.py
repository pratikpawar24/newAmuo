"""
OSM Graph Builder — Build road network graph from OpenStreetMap data.

Graph construction from OpenStreetMap:
    G = (V, E)
    V = {OSM nodes (intersections)}
    E = {OSM ways (road segments)}
    Each edge e: {length_m, speed_limit, lanes, road_type, oneway}

Uses Overpass API to download road data for a configurable bounding box.
"""

import math
import httpx
import networkx as nx
from typing import Dict, Any, Optional, Tuple, List
from utils.haversine import haversine
from config import graph_config

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Default speed limits by road type (km/h)
ROAD_SPEED_LIMITS: Dict[str, float] = {
    "motorway": 120.0,
    "motorway_link": 80.0,
    "trunk": 100.0,
    "trunk_link": 60.0,
    "primary": 80.0,
    "primary_link": 50.0,
    "secondary": 60.0,
    "secondary_link": 40.0,
    "tertiary": 50.0,
    "tertiary_link": 30.0,
    "residential": 30.0,
    "living_street": 20.0,
    "unclassified": 40.0,
    "service": 20.0,
}

# Lanes by road type (default)
ROAD_LANES: Dict[str, int] = {
    "motorway": 3,
    "trunk": 2,
    "primary": 2,
    "secondary": 2,
    "tertiary": 1,
    "residential": 1,
    "unclassified": 1,
    "service": 1,
}

# Capacity per lane per hour
CAPACITY_PER_LANE_HOUR = 1800


def build_overpass_query(bbox: Tuple[float, float, float, float]) -> str:
    """Build Overpass QL query for road network.

    Args:
        bbox: (south_lat, west_lng, north_lat, east_lng)
    """
    south, west, north, east = bbox
    return f"""
    [out:json][timeout:120];
    (
      way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|service)$"]({south},{west},{north},{east});
    );
    out body;
    >;
    out skel qt;
    """


async def fetch_osm_data(bbox: Tuple[float, float, float, float]) -> Dict[str, Any]:
    """Fetch road data from Overpass API."""
    query = build_overpass_query(bbox)
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(OVERPASS_URL, data={"data": query})
            response.raise_for_status()
            return response.json()
    except Exception as e:
        print(f"[GraphBuilder] Overpass API error: {e}")
        return {"elements": []}


def parse_speed_limit(tags: Dict[str, str], highway_type: str) -> float:
    """Parse speed limit from OSM tags or use default."""
    if "maxspeed" in tags:
        try:
            speed_str = tags["maxspeed"].replace("mph", "").replace("km/h", "").strip()
            return float(speed_str)
        except (ValueError, AttributeError):
            pass
    return ROAD_SPEED_LIMITS.get(highway_type, 40.0)


def parse_lanes(tags: Dict[str, str], highway_type: str) -> int:
    """Parse number of lanes from OSM tags or use default."""
    if "lanes" in tags:
        try:
            return int(tags["lanes"])
        except (ValueError, AttributeError):
            pass
    return ROAD_LANES.get(highway_type, 1)


def build_graph_from_osm_data(osm_data: Dict[str, Any]) -> nx.DiGraph:
    """Build a NetworkX directed graph from OSM data.

    Nodes V: OSM nodes at intersections
    Edges E: road segments with attributes {length_m, speed_limit_kmh, lanes, road_type, oneway}
    """
    G = nx.DiGraph()
    elements = osm_data.get("elements", [])

    # Separate nodes and ways
    nodes: Dict[int, Dict[str, float]] = {}
    ways: List[Dict[str, Any]] = []

    for el in elements:
        if el["type"] == "node":
            nodes[el["id"]] = {"lat": el["lat"], "lon": el["lon"]}
        elif el["type"] == "way":
            ways.append(el)

    # Count node references to identify intersections
    node_refs: Dict[int, int] = {}
    for way in ways:
        for node_id in way.get("nodes", []):
            node_refs[node_id] = node_refs.get(node_id, 0) + 1

    # Add nodes to graph
    for node_id, coords in nodes.items():
        G.add_node(node_id, lat=coords["lat"], lng=coords["lon"])

    # Add edges from ways
    for way in ways:
        tags = way.get("tags", {})
        highway_type = tags.get("highway", "unclassified")
        speed_limit = parse_speed_limit(tags, highway_type)
        lanes = parse_lanes(tags, highway_type)
        oneway = tags.get("oneway", "no") == "yes"
        capacity = lanes * CAPACITY_PER_LANE_HOUR

        way_nodes = way.get("nodes", [])

        for i in range(len(way_nodes) - 1):
            n1 = way_nodes[i]
            n2 = way_nodes[i + 1]

            if n1 not in nodes or n2 not in nodes:
                continue

            lat1, lng1 = nodes[n1]["lat"], nodes[n1]["lon"]
            lat2, lng2 = nodes[n2]["lat"], nodes[n2]["lon"]

            length_m = haversine(lat1, lng1, lat2, lng2)

            edge_attrs = {
                "length_m": length_m,
                "speed_limit_kmh": speed_limit,
                "free_flow_speed_kmh": speed_limit,
                "lanes": lanes,
                "road_type": highway_type,
                "oneway": oneway,
                "capacity": capacity,
                "osm_way_id": way["id"],
            }

            # Add forward edge
            G.add_edge(n1, n2, **edge_attrs)

            # Add reverse edge if not oneway
            if not oneway:
                G.add_edge(n2, n1, **edge_attrs)

    print(f"[GraphBuilder] Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G


async def build_graph(bbox: Optional[Tuple[float, float, float, float]] = None) -> nx.DiGraph:
    """Build the complete road network graph."""
    if bbox is None:
        bbox = graph_config.osm_bbox

    print(f"[GraphBuilder] Fetching OSM data for bbox: {bbox}")
    osm_data = await fetch_osm_data(bbox)

    if not osm_data.get("elements"):
        print("[GraphBuilder] No OSM data received, building synthetic graph")
        return build_synthetic_graph(bbox)

    return build_graph_from_osm_data(osm_data)


def build_synthetic_graph(
    bbox: Tuple[float, float, float, float],
    grid_size: int = 20,
) -> nx.DiGraph:
    """Build a synthetic grid graph when OSM data is unavailable.

    Creates a grid_size × grid_size grid of nodes within the bounding box.
    """
    G = nx.DiGraph()
    south, west, north, east = bbox

    lat_step = (north - south) / (grid_size - 1)
    lng_step = (east - west) / (grid_size - 1)

    import random
    random.seed(42)

    # Create nodes
    node_id = 1
    node_grid: Dict[Tuple[int, int], int] = {}
    for i in range(grid_size):
        for j in range(grid_size):
            lat = south + i * lat_step
            lng = west + j * lng_step
            G.add_node(node_id, lat=lat, lng=lng)
            node_grid[(i, j)] = node_id
            node_id += 1

    # Create edges (grid connections + some diagonals)
    road_types = ["primary", "secondary", "tertiary", "residential"]
    for i in range(grid_size):
        for j in range(grid_size):
            n1 = node_grid[(i, j)]
            neighbors = []
            if i + 1 < grid_size:
                neighbors.append(((i + 1, j), random.choice(["primary", "secondary"])))
            if j + 1 < grid_size:
                neighbors.append(((i, j + 1), random.choice(["secondary", "tertiary"])))
            # Occasional diagonals
            if i + 1 < grid_size and j + 1 < grid_size and random.random() < 0.3:
                neighbors.append(((i + 1, j + 1), "tertiary"))

            for (ni, nj), road_type in neighbors:
                n2 = node_grid[(ni, nj)]
                lat1 = G.nodes[n1]["lat"]
                lng1 = G.nodes[n1]["lng"]
                lat2 = G.nodes[n2]["lat"]
                lng2 = G.nodes[n2]["lng"]
                length_m = haversine(lat1, lng1, lat2, lng2)
                speed_limit = ROAD_SPEED_LIMITS.get(road_type, 40.0)
                lanes = ROAD_LANES.get(road_type, 1)

                edge_attrs = {
                    "length_m": length_m,
                    "speed_limit_kmh": speed_limit,
                    "free_flow_speed_kmh": speed_limit,
                    "lanes": lanes,
                    "road_type": road_type,
                    "oneway": False,
                    "capacity": lanes * CAPACITY_PER_LANE_HOUR,
                    "osm_way_id": 0,
                }
                G.add_edge(n1, n2, **edge_attrs)
                G.add_edge(n2, n1, **edge_attrs)

    print(f"[GraphBuilder] Synthetic graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G


def find_nearest_node(G: nx.DiGraph, lat: float, lng: float) -> Optional[int]:
    """Find the nearest graph node to given coordinates."""
    min_dist = float("inf")
    nearest = None
    for node_id, data in G.nodes(data=True):
        d = haversine(lat, lng, data["lat"], data["lng"])
        if d < min_dist:
            min_dist = d
            nearest = node_id
    return nearest
