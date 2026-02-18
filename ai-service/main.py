"""
AUMO v2 AI Microservice — FastAPI Application.

Endpoints:
  POST /api/predict-traffic           — LSTM model inference
  POST /api/predict-traffic-advanced  — ST-GAT / LSTM inference with confidence
  POST /api/route                     — AUMO-ORION time-dependent A* routing
  POST /api/route/pareto              — Pareto-optimal route set (fastest/greenest/balanced/smoothest)
  POST /api/route/replan              — MPC re-planning with anti-oscillation
  POST /api/match                     — DBSCAN + scoring carpool matching
  POST /api/emissions                 — COPERT emission calculator
  GET  /api/health                    — health check
  POST /api/train                     — trigger LSTM retraining
  POST /api/train-stgat               — trigger ST-GAT iterative training

ON STARTUP:
  1. Load LSTM model (train if no checkpoint)
  2. Load ST-GAT model (if checkpoint exists)
  3. Build road graph from OSM Overpass API
  4. Preprocess Contraction Hierarchies on graph
"""

import os
import asyncio
import numpy as np
import torch
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import MODEL_PATH, API_KEY, model_config, routing_config
from models.lstm_model import TrafficLSTM
from models.trainer import train_model, load_model
from models.data_generator import generate_sinusoidal_time_features

# ST-GAT spatio-temporal model
from models.st_gat_model import SpatioTemporalGAT
from models.st_gat_trainer import (
    iterative_train_st_gat,
    load_st_gat_model,
    ST_GAT_MODEL_PATH,
)

from algorithms.astar import astar_route, get_traffic_overlay
from algorithms.orion import (
    orion_route,
    compute_pareto_routes,
    ContractionHierarchy,
    ReplanningEngine,
    extended_edge_cost,
)
from algorithms.graph_builder import build_graph, find_nearest_node, build_synthetic_graph
from algorithms.matching import match_rides, dbscan_cluster_pickups
from algorithms.emissions import (
    calculate_ride_emissions,
    calculate_carpool_savings,
    emission_factor,
    co2_to_tree_days,
)
from utils.osrm_client import get_route as osrm_get_route, decode_osrm_geometry

# Global state
model: Optional[TrafficLSTM] = None
st_gat_model: Optional[SpatioTemporalGAT] = None
st_gat_scaler: Optional[dict] = None
st_gat_adj = None
scaler: Optional[dict] = None
road_graph = None
contraction_hierarchy: Optional[ContractionHierarchy] = None
replan_engines: Dict[str, ReplanningEngine] = {}  # ride_id → engine
model_metrics: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    global model, scaler, road_graph, model_metrics
    global st_gat_model, st_gat_scaler, st_gat_adj, contraction_hierarchy

    print("=" * 60)
    print("AUMO v2 AI Service Starting (AUMO-ORION Engine)")
    print("=" * 60)

    # 1. Load/train LSTM model (fallback, fast startup)
    if os.path.exists(MODEL_PATH):
        print(f"[Startup] Loading existing LSTM model from {MODEL_PATH}")
        try:
            model, scaler = load_model(MODEL_PATH)
            model_metrics = {"status": "loaded", "path": MODEL_PATH}
        except Exception as e:
            print(f"[Startup] Failed to load LSTM model: {e}, retraining...")
            model, metrics = train_model()
            scaler = metrics["scaler"]
            model_metrics = metrics
    else:
        print("[Startup] No saved LSTM model found, training from scratch...")
        model, metrics = train_model()
        scaler = metrics["scaler"]
        model_metrics = metrics

    print(f"[Startup] LSTM Model ready. Metrics: {model_metrics}")

    # 2. Load/train ST-GAT model (advanced spatio-temporal)
    if os.path.exists(ST_GAT_MODEL_PATH):
        print(f"[Startup] Loading existing ST-GAT model from {ST_GAT_MODEL_PATH}")
        try:
            st_gat_model, st_gat_scaler, st_gat_adj = load_st_gat_model(ST_GAT_MODEL_PATH)
            model_metrics["st_gat"] = "loaded"
        except Exception as e:
            print(f"[Startup] ST-GAT load failed: {e}, will train in background")
            model_metrics["st_gat"] = "not_available"
    else:
        print("[Startup] No ST-GAT model found. Training will be triggered via /api/train-stgat")
        model_metrics["st_gat"] = "not_available"

    # 3. Build road graph
    print("[Startup] Building road network graph...")
    try:
        from config import graph_config
        road_graph = await build_graph(graph_config.osm_bbox)
    except Exception as e:
        print(f"[Startup] Could not fetch OSM data: {e}")
        print("[Startup] Building synthetic graph as fallback...")
        from config import graph_config
        road_graph = build_synthetic_graph(graph_config.osm_bbox)

    print(f"[Startup] Road graph ready: {road_graph.number_of_nodes()} nodes, {road_graph.number_of_edges()} edges")

    # 4. Preprocess Contraction Hierarchies for fast routing
    try:
        contraction_hierarchy = ContractionHierarchy(road_graph)
        contraction_hierarchy.preprocess(max_nodes=3000)
        model_metrics["contraction_hierarchies"] = "ready"
    except Exception as e:
        print(f"[Startup] CH preprocessing failed: {e}")
        contraction_hierarchy = None
        model_metrics["contraction_hierarchies"] = "unavailable"

    print("=" * 60)
    print("AUMO-ORION AI Service ready ✓")
    print(f"  LSTM: {model_metrics.get('status', 'ready')}")
    print(f"  ST-GAT: {model_metrics.get('st_gat', 'not_available')}")
    print(f"  Graph: {road_graph.number_of_nodes()} nodes, {road_graph.number_of_edges()} edges")
    print(f"  CH: {model_metrics.get('contraction_hierarchies', 'unavailable')}")
    print("=" * 60)

    yield

    print("AI Service shutting down...")


app = FastAPI(
    title="AUMO v2 AI Service",
    description="Traffic prediction, eco-routing, carpool matching, and emission calculation",
    version="2.0.0",
    lifespan=lifespan,
)

# Import CORS origins from config
from config import CORS_ORIGINS, IS_HF_SPACE

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if not IS_HF_SPACE else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Models ──────────────────────────────────────────

class Coordinate(BaseModel):
    lat: float
    lng: float


class SegmentInput(BaseModel):
    segmentId: str
    lat: float
    lng: float


class PredictTrafficRequest(BaseModel):
    segments: List[SegmentInput]
    timestamp: str


class PredictTrafficResponse(BaseModel):
    predictions: List[Dict[str, Any]]


class RouteWeights(BaseModel):
    alpha: float = Field(default=0.5, ge=0, le=1)
    beta: float = Field(default=0.35, ge=0, le=1)
    gamma: float = Field(default=0.15, ge=0, le=1)


class RouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    departureTime: str
    weights: RouteWeights = RouteWeights()
    avoidTolls: bool = False


class RouteResult(BaseModel):
    polyline: List[List[float]]
    distanceKm: float
    durationMin: float
    co2Grams: float
    cost: float


class RouteResponse(BaseModel):
    primary: Optional[RouteResult] = None
    alternative: Optional[RouteResult] = None
    trafficOverlay: List[Dict[str, Any]] = []


class RiderOriginDest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    departureTime: str
    preferences: Dict[str, Any] = {}


class AvailableRide(BaseModel):
    rideId: str
    origin: Coordinate
    destination: Coordinate
    polyline: List[List[float]] = []
    departureTime: str
    preferences: Dict[str, Any] = {}


class MatchRequest(BaseModel):
    riderOrigin: Coordinate
    riderDestination: Coordinate
    departureTime: str
    preferences: Dict[str, Any] = {}
    availableRides: List[AvailableRide]


class MatchResult(BaseModel):
    rideId: str
    score: float
    detourKm: float
    detourMinutes: float
    co2Savings: float = 0.0


class MatchResponse(BaseModel):
    matches: List[MatchResult]


class SegmentEmission(BaseModel):
    distanceKm: float
    avgSpeedKmh: float


class EmissionRequest(BaseModel):
    segments: List[SegmentEmission]
    passengers: int = 1
    fuelType: str = "petrol"


class EmissionResponse(BaseModel):
    totalCO2g: float
    perPassengerCO2g: float
    co2SavedVsSolo: float
    equivalentTreeDays: float


# ── API Key Dependency ───────────────────────────────────────

async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Verify API key for admin endpoints."""
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ── Endpoints ────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "engine": "AUMO-ORION",
        "model_loaded": model is not None,
        "st_gat_loaded": st_gat_model is not None,
        "graph_nodes": road_graph.number_of_nodes() if road_graph else 0,
        "graph_edges": road_graph.number_of_edges() if road_graph else 0,
        "contraction_hierarchies": contraction_hierarchy is not None and contraction_hierarchy.is_preprocessed,
        "metrics": model_metrics,
    }


@app.post("/api/predict-traffic", response_model=PredictTrafficResponse)
async def predict_traffic(request: PredictTrafficRequest):
    """Run LSTM model inference for traffic prediction.

    Input: { segments: [{ segmentId, lat, lng }], timestamp: ISO string }
    Output: { predictions: [{ segmentId, speed, flow, congestion, confidence }] }
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        ts = datetime.fromisoformat(request.timestamp.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        ts = datetime.now()

    hour = ts.hour + ts.minute / 60.0
    day_of_week = ts.weekday()
    hour_sin, hour_cos, day_sin, day_cos = generate_sinusoidal_time_features(hour, day_of_week)

    predictions = []
    device = next(model.parameters()).device

    for seg in request.segments:
        # Create a synthetic input sequence for the segment
        # Use current conditions as the last timestep and extrapolate backward
        feature_seq = []
        for step in range(model_config.lookback):
            t_offset = (model_config.lookback - 1 - step) * 5 / 60.0  # hours back
            t_hour = (hour - t_offset) % 24.0
            h_sin, h_cos, d_sin, d_cos = generate_sinusoidal_time_features(t_hour, day_of_week)

            # Estimate base traffic for this time
            base_flow = 40.0
            base_speed = 45.0
            if 7 <= t_hour < 9 or 17 <= t_hour < 19:
                base_flow = 75.0
                base_speed = 25.0
            elif 9 <= t_hour < 17:
                base_flow = 50.0
                base_speed = 35.0
            elif t_hour < 5 or t_hour >= 22:
                base_flow = 15.0
                base_speed = 55.0

            density = base_flow / max(base_speed, 1.0)

            # xₜ = [flow, speed, density, hour_sin, hour_cos, day_sin, day_cos, is_holiday, weather_code, precipitation]
            feature = [
                base_flow, base_speed, density,
                h_sin, h_cos, d_sin, d_cos,
                0.0,  # is_holiday
                0.0,  # weather_code (clear)
                0.0,  # precipitation
            ]
            feature_seq.append(feature)

        # Normalize using scaler
        input_arr = np.array([feature_seq], dtype=np.float32)
        if scaler:
            x_min = np.array(scaler["x_min"])
            x_max = np.array(scaler["x_max"])
            x_range = x_max - x_min
            x_range[x_range == 0] = 1.0
            input_arr = (input_arr - x_min) / x_range

        input_tensor = torch.FloatTensor(input_arr).to(device)

        with torch.no_grad():
            pred, attn = model(input_tensor)

        pred_np = pred.cpu().numpy()[0]  # (forecast_steps, 3)

        # Denormalize predictions
        if scaler:
            y_min = np.array(scaler["y_min"])
            y_max = np.array(scaler["y_max"])
            y_range = y_max - y_min
            y_range[y_range == 0] = 1.0
            pred_np = pred_np * y_range + y_min

        # Use first forecast step
        pred_speed = float(max(5.0, pred_np[0][0]))
        pred_flow = float(max(0.0, pred_np[0][1]))
        pred_congestion = float(np.clip(pred_np[0][2], 0.0, 1.0))

        # Confidence based on attention weights entropy
        attn_np = attn.cpu().numpy()[0]
        entropy = -np.sum(attn_np * np.log(attn_np + 1e-8))
        max_entropy = np.log(len(attn_np))
        confidence = float(1.0 - entropy / max_entropy) if max_entropy > 0 else 0.5

        predictions.append({
            "segmentId": seg.segmentId,
            "speed": round(pred_speed, 2),
            "flow": round(pred_flow, 2),
            "congestion": round(pred_congestion, 4),
            "confidence": round(confidence, 4),
        })

    return PredictTrafficResponse(predictions=predictions)


@app.post("/api/route", response_model=RouteResponse)
async def calculate_route(request: RouteRequest):
    """Calculate eco-weighted route using AUMO-ORION algorithm.

    Pipeline:
        1. Get ST-GAT / LSTM traffic predictions for relevant segments
        2. Run AUMO-ORION: Time-Dependent A* with multi-objective cost
           and Contraction Hierarchies
        3. Get OSRM route as fallback/comparison
        4. Return primary (ORION) + alternative (OSRM) routes
    """
    global road_graph

    if road_graph is None:
        raise HTTPException(status_code=503, detail="Road graph not loaded")

    try:
        departure = datetime.fromisoformat(request.departureTime.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        departure = datetime.now()

    # Find nearest nodes
    start_node = find_nearest_node(road_graph, request.origin.lat, request.origin.lng)
    goal_node = find_nearest_node(road_graph, request.destination.lat, request.destination.lng)

    if start_node is None or goal_node is None:
        raise HTTPException(status_code=404, detail="Origin or destination not reachable in road network")

    # ── Get AI traffic predictions ────────────────────────────
    traffic_preds = None
    if st_gat_model is not None:
        # Use ST-GAT for spatio-temporal predictions
        traffic_preds = await _get_stgat_predictions(departure)
    elif model is not None:
        # Fallback to LSTM predictions
        traffic_preds = await _get_lstm_predictions(departure)

    # ── Run AUMO-ORION routing ────────────────────────────────
    primary_result = orion_route(
        road_graph,
        start_node,
        goal_node,
        departure,
        alpha=request.weights.alpha,
        beta=request.weights.beta,
        gamma=request.weights.gamma,
        traffic_predictions=traffic_preds,
        ch=contraction_hierarchy,
    )

    # Fallback to classic A* if ORION fails
    if primary_result is None:
        primary_result = astar_route(
            road_graph,
            start_node,
            goal_node,
            departure,
            alpha=request.weights.alpha,
            beta=request.weights.beta,
            gamma=request.weights.gamma,
            traffic_predictions=traffic_preds,
        )

    primary = None
    traffic_overlay = []

    if primary_result:
        primary = RouteResult(
            polyline=primary_result["polyline"],
            distanceKm=round(primary_result["distanceKm"], 2),
            durationMin=round(primary_result["durationMin"], 1),
            co2Grams=round(primary_result["co2Grams"], 1),
            cost=round(primary_result["cost"], 4),
        )
        traffic_overlay = get_traffic_overlay(
            road_graph, primary_result["path_nodes"], traffic_preds, departure
        )

    # Get OSRM alternative route
    alternative = None
    try:
        osrm_result = await osrm_get_route(
            (request.origin.lat, request.origin.lng),
            (request.destination.lat, request.destination.lng),
            alternatives=False,
        )
        if osrm_result.get("routes"):
            route = osrm_result["routes"][0]
            polyline = decode_osrm_geometry(route["geometry"])
            dist_km = route["distance"] / 1000.0
            dur_min = route["duration"] / 60.0
            avg_speed = dist_km / (dur_min / 60.0) if dur_min > 0 else 30.0
            co2 = dist_km * emission_factor(avg_speed)

            alternative = RouteResult(
                polyline=[[p[0], p[1]] for p in polyline],
                distanceKm=round(dist_km, 2),
                durationMin=round(dur_min, 1),
                co2Grams=round(co2, 1),
                cost=0.0,
            )
    except Exception as e:
        print(f"[Route] OSRM fallback error: {e}")

    # If no A* result, use OSRM as primary
    if primary is None and alternative is not None:
        primary = alternative
        alternative = None
    elif primary is None:
        # Generate a direct line as absolute fallback
        primary = RouteResult(
            polyline=[
                [request.origin.lat, request.origin.lng],
                [request.destination.lat, request.destination.lng],
            ],
            distanceKm=round(
                haversine_km_simple(
                    request.origin.lat, request.origin.lng,
                    request.destination.lat, request.destination.lng,
                ), 2
            ),
            durationMin=0.0,
            co2Grams=0.0,
            cost=0.0,
        )

    return RouteResponse(
        primary=primary,
        alternative=alternative,
        trafficOverlay=traffic_overlay,
    )


async def _get_stgat_predictions(departure: datetime) -> Dict[str, Dict]:
    """Generate traffic predictions using ST-GAT model for all graph edges.

    Uses the trained ST-GAT model to predict speed, flow, congestion
    for each road segment at the given departure time.
    """
    if st_gat_model is None or st_gat_scaler is None:
        return {}

    import torch

    hour = departure.hour + departure.minute / 60.0
    day_of_week = departure.weekday()
    device = next(st_gat_model.parameters()).device

    try:
        num_nodes = st_gat_adj.shape[0] if st_gat_adj is not None else 50
        lookback = model_config.lookback

        # Build input sequence: (1, T, N, F)
        feature_seq = np.zeros((lookback, num_nodes, 10), dtype=np.float32)

        for step in range(lookback):
            t_offset = (lookback - 1 - step) * 5 / 60.0
            t_hour = (hour - t_offset) % 24.0

            h_sin, h_cos, d_sin, d_cos = generate_sinusoidal_time_features(t_hour, day_of_week)

            for i in range(num_nodes):
                # Base traffic estimation
                base_flow, base_speed = 40.0, 45.0
                if 7 <= t_hour < 9 or 17 <= t_hour < 19:
                    base_flow, base_speed = 75.0, 25.0
                elif 9 <= t_hour < 17:
                    base_flow, base_speed = 50.0, 35.0
                elif t_hour < 5 or t_hour >= 22:
                    base_flow, base_speed = 15.0, 55.0

                density = base_flow / max(base_speed, 1.0)
                feature_seq[step, i] = [
                    base_flow, base_speed, density,
                    h_sin, h_cos, d_sin, d_cos,
                    0.0, 0.0, 0.0,
                ]

        # Normalize
        x_min = np.array(st_gat_scaler["x_min"])
        x_max = np.array(st_gat_scaler["x_max"])
        x_range = x_max - x_min
        x_range[x_range == 0] = 1.0
        input_norm = (feature_seq - x_min) / x_range

        input_tensor = torch.FloatTensor(input_norm).unsqueeze(0).to(device)  # (1, T, N, F)
        adj_tensor = torch.FloatTensor(st_gat_adj).to(device)

        with torch.no_grad():
            preds, attn = st_gat_model(input_tensor, adj_tensor)

        # De-normalize predictions: (1, N, H, 3) → speed, flow, congestion
        preds_np = preds.cpu().numpy()[0]  # (N, H, 3)
        y_min = np.array(st_gat_scaler["y_min"])
        y_max = np.array(st_gat_scaler["y_max"])
        y_range = y_max - y_min
        y_range[y_range == 0] = 1.0
        preds_denorm = preds_np * y_range + y_min

        # Map predictions to edge keys
        predictions = {}
        graph_nodes = list(road_graph.nodes())
        for i, node in enumerate(graph_nodes[:num_nodes]):
            for neighbor in road_graph.successors(node):
                edge_key = f"{node}-{neighbor}"
                # Use first forecast step
                node_idx = i % num_nodes
                pred_speed = float(max(5.0, preds_denorm[node_idx, 0, 0]))
                pred_flow = float(max(0.0, preds_denorm[node_idx, 0, 1]))
                pred_congestion = float(np.clip(preds_denorm[node_idx, 0, 2], 0, 1))

                predictions[edge_key] = {
                    "speed": pred_speed,
                    "flow": pred_flow,
                    "congestion": pred_congestion,
                }

        return predictions

    except Exception as e:
        print(f"[ST-GAT Predict] Error: {e}")
        return {}


async def _get_lstm_predictions(departure: datetime) -> Dict[str, Dict]:
    """Fallback: Generate traffic predictions using LSTM model."""
    if model is None:
        return {}

    hour = departure.hour + departure.minute / 60.0
    day_of_week = departure.weekday()
    device = next(model.parameters()).device

    predictions = {}

    try:
        for node in list(road_graph.nodes())[:100]:
            for neighbor in road_graph.successors(node):
                edge_key = f"{node}-{neighbor}"

                feature_seq = []
                for step in range(model_config.lookback):
                    t_offset = (model_config.lookback - 1 - step) * 5 / 60.0
                    t_hour = (hour - t_offset) % 24.0
                    h_sin, h_cos, d_sin, d_cos = generate_sinusoidal_time_features(t_hour, day_of_week)

                    base_flow, base_speed = 40.0, 45.0
                    if 7 <= t_hour < 9 or 17 <= t_hour < 19:
                        base_flow, base_speed = 75.0, 25.0
                    elif 9 <= t_hour < 17:
                        base_flow, base_speed = 50.0, 35.0
                    elif t_hour < 5 or t_hour >= 22:
                        base_flow, base_speed = 15.0, 55.0

                    density = base_flow / max(base_speed, 1.0)
                    feature_seq.append([base_flow, base_speed, density,
                                        h_sin, h_cos, d_sin, d_cos, 0.0, 0.0, 0.0])

                input_arr = np.array([feature_seq], dtype=np.float32)
                if scaler:
                    x_min = np.array(scaler["x_min"])
                    x_max = np.array(scaler["x_max"])
                    x_range = x_max - x_min
                    x_range[x_range == 0] = 1.0
                    input_arr = (input_arr - x_min) / x_range

                input_tensor = torch.FloatTensor(input_arr).to(device)
                with torch.no_grad():
                    pred, _ = model(input_tensor)

                pred_np = pred.cpu().numpy()[0]
                if scaler:
                    y_min = np.array(scaler["y_min"])
                    y_max = np.array(scaler["y_max"])
                    y_range = y_max - y_min
                    y_range[y_range == 0] = 1.0
                    pred_np = pred_np * y_range + y_min

                predictions[edge_key] = {
                    "speed": float(max(5.0, pred_np[0][0])),
                    "flow": float(max(0.0, pred_np[0][1])),
                    "congestion": float(np.clip(pred_np[0][2], 0, 1)),
                }

    except Exception as e:
        print(f"[LSTM Predict] Error: {e}")

    return predictions


@app.post("/api/match", response_model=MatchResponse)
async def match_carpools(request: MatchRequest):
    """AI-powered carpool matching.

    1. DBSCAN cluster rider with existing pickups
    2. Calculate match score for each ride
    3. Sort by score descending
    """
    rider_req = {
        "origin": {"lat": request.riderOrigin.lat, "lng": request.riderOrigin.lng},
        "destination": {"lat": request.riderDestination.lat, "lng": request.riderDestination.lng},
        "departureTime": request.departureTime,
        "preferences": request.preferences,
    }

    rides = []
    for ride in request.availableRides:
        rides.append({
            "rideId": ride.rideId,
            "origin": {"lat": ride.origin.lat, "lng": ride.origin.lng},
            "destination": {"lat": ride.destination.lat, "lng": ride.destination.lng},
            "polyline": ride.polyline,
            "departureTime": ride.departureTime,
            "preferences": ride.preferences,
        })

    # DBSCAN clustering
    if len(rides) > 1:
        pickup_points = [{"lat": r["origin"]["lat"], "lng": r["origin"]["lng"]} for r in rides]
        pickup_points.append({"lat": request.riderOrigin.lat, "lng": request.riderOrigin.lng})
        clusters = dbscan_cluster_pickups(pickup_points)
        # clusters info could be used for grouping but we still score all rides

    matches_raw = match_rides(rider_req, rides)

    # Calculate CO2 savings for each match
    matches = []
    for m in matches_raw:
        co2_savings = m.get("detourKm", 0) * emission_factor(30.0)  # Rough estimate
        matches.append(MatchResult(
            rideId=str(m["rideId"]),
            score=m["score"],
            detourKm=m["detourKm"],
            detourMinutes=m["detourMinutes"],
            co2Savings=round(co2_savings, 1),
        ))

    return MatchResponse(matches=matches)


@app.post("/api/emissions", response_model=EmissionResponse)
async def calculate_emissions(request: EmissionRequest):
    """Calculate ride emissions using COPERT IV model.

    EF(v) = 2310 × (0.0667 + 0.0556/v + 0.000472·v²)  [g CO₂/km]
    """
    segments = [{"distanceKm": s.distanceKm, "avgSpeedKmh": s.avgSpeedKmh} for s in request.segments]

    total_co2 = calculate_ride_emissions(segments, request.fuelType)
    per_passenger = total_co2 / max(request.passengers, 1)

    # Calculate savings vs solo driving
    solo_co2 = total_co2 * request.passengers  # If each drove alone
    co2_saved = solo_co2 - total_co2 if request.passengers > 1 else 0.0

    tree_days = co2_to_tree_days(co2_saved)

    return EmissionResponse(
        totalCO2g=round(total_co2, 2),
        perPassengerCO2g=round(per_passenger, 2),
        co2SavedVsSolo=round(co2_saved, 2),
        equivalentTreeDays=round(tree_days, 2),
    )


@app.post("/api/train")
async def retrain_model(x_api_key: str = Header(None)):
    """Trigger LSTM model retraining (admin only, secured with API key)."""
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    global model, scaler, model_metrics

    try:
        model, metrics = train_model()
        scaler = metrics["scaler"]
        model_metrics = metrics
        return {"status": "success", "metrics": {k: v for k, v in metrics.items() if k != "scaler"}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


# ── AUMO-ORION Advanced Endpoints ───────────────────────────────────

class ParetoRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    departureTime: str


class ReplanRequest(BaseModel):
    rideId: str
    currentPosition: Coordinate
    destination: Coordinate
    departureTime: str
    weights: RouteWeights = RouteWeights()
    trafficChangePct: float = 0.0
    isOffRoute: bool = False
    incidentOnRoute: bool = False


class PredictRequest(BaseModel):
    segments: List[SegmentInput]
    timestamp: str
    useStGat: bool = True


@app.post("/api/route/pareto")
async def pareto_routes(request: ParetoRequest):
    """Compute Pareto-optimal route set.

    Returns multiple non-dominated routes optimizing different objectives:
        - Fastest: minimize travel time
        - Greenest: minimize CO₂ emissions
        - Balanced: multi-objective compromise
        - Smoothest: minimize congestion exposure
    """
    if road_graph is None:
        raise HTTPException(status_code=503, detail="Road graph not loaded")

    try:
        departure = datetime.fromisoformat(request.departureTime.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        departure = datetime.now()

    start_node = find_nearest_node(road_graph, request.origin.lat, request.origin.lng)
    goal_node = find_nearest_node(road_graph, request.destination.lat, request.destination.lng)

    if start_node is None or goal_node is None:
        raise HTTPException(status_code=404, detail="Origin or destination not reachable")

    # Get traffic predictions
    traffic_preds = None
    if st_gat_model is not None:
        traffic_preds = await _get_stgat_predictions(departure)
    elif model is not None:
        traffic_preds = await _get_lstm_predictions(departure)

    routes = compute_pareto_routes(
        road_graph, start_node, goal_node, departure,
        traffic_predictions=traffic_preds,
        ch=contraction_hierarchy,
    )

    return {
        "success": True,
        "routes": routes,
        "count": len(routes),
        "departure": departure.isoformat(),
    }


@app.post("/api/route/replan")
async def replan_route(request: ReplanRequest):
    """Re-plan route using Model Predictive Control.

    Anti-oscillation: Only accepts new route if it's >15% better.
    Triggered by: periodic timer, traffic change, off-route, incident.
    """
    if road_graph is None:
        raise HTTPException(status_code=503, detail="Road graph not loaded")

    try:
        departure = datetime.fromisoformat(request.departureTime.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        departure = datetime.now()

    # Get or create re-planning engine for this ride
    if request.rideId not in replan_engines:
        replan_engines[request.rideId] = ReplanningEngine()

    engine = replan_engines[request.rideId]

    current_node = find_nearest_node(
        road_graph, request.currentPosition.lat, request.currentPosition.lng
    )
    goal_node = find_nearest_node(
        road_graph, request.destination.lat, request.destination.lng
    )

    if current_node is None or goal_node is None:
        raise HTTPException(status_code=404, detail="Position not reachable")

    # Check if re-planning is needed
    should_replan = engine.should_replan(
        departure,
        (request.currentPosition.lat, request.currentPosition.lng),
        request.trafficChangePct,
        request.isOffRoute,
        request.incidentOnRoute,
    )

    if not should_replan:
        return {
            "success": True,
            "replanned": False,
            "reason": "Current route is still optimal",
            "status": engine.get_status(),
        }

    # Get traffic predictions
    traffic_preds = None
    if st_gat_model is not None:
        traffic_preds = await _get_stgat_predictions(departure)

    new_route = engine.replan(
        road_graph, current_node, goal_node, departure,
        weights={
            "alpha": request.weights.alpha,
            "beta": request.weights.beta,
            "gamma": request.weights.gamma,
        },
        traffic_predictions=traffic_preds,
        ch=contraction_hierarchy,
    )

    if new_route is None:
        return {
            "success": True,
            "replanned": False,
            "reason": "New route not significantly better (hysteresis threshold)",
            "status": engine.get_status(),
        }

    return {
        "success": True,
        "replanned": True,
        "route": new_route,
        "status": engine.get_status(),
    }


@app.post("/api/train-stgat")
async def train_stgat_model(x_api_key: str = Header(None)):
    """Train/retrain the ST-GAT spatio-temporal model.

    Runs iterative training (up to 3 rounds) targeting MAPE < 12%.
    This is a long-running operation (5-30 minutes).
    """
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    global st_gat_model, st_gat_scaler, st_gat_adj, model_metrics

    try:
        st_gat_model, metrics = iterative_train_st_gat(
            max_rounds=3,
            target_mape=12.0,
        )
        st_gat_scaler = metrics["scaler"]

        # Load adjacency from saved model
        import torch
        checkpoint = torch.load(ST_GAT_MODEL_PATH, map_location="cpu", weights_only=False)
        st_gat_adj = np.array(checkpoint["adj"], dtype=np.float32)

        model_metrics["st_gat"] = "trained"
        model_metrics["st_gat_metrics"] = {
            k: v for k, v in metrics.items()
            if k not in ("scaler", "config")
        }

        return {
            "status": "success",
            "metrics": model_metrics["st_gat_metrics"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ST-GAT training failed: {str(e)}")


@app.post("/api/predict-traffic-advanced")
async def predict_traffic_advanced(request: PredictRequest):
    """Advanced traffic prediction using ST-GAT model.

    Falls back to LSTM if ST-GAT is not available.
    Returns per-segment predictions with confidence scores.
    """
    try:
        ts = datetime.fromisoformat(request.timestamp.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        ts = datetime.now()

    if request.useStGat and st_gat_model is not None:
        preds = await _get_stgat_predictions(ts)
        model_used = "ST-GAT"
    elif model is not None:
        preds = await _get_lstm_predictions(ts)
        model_used = "LSTM"
    else:
        raise HTTPException(status_code=503, detail="No prediction model available")

    # Map predictions to requested segments
    results = []
    for seg in request.segments:
        # Find nearest edge prediction
        best_pred = None
        best_dist = float("inf")

        for edge_key, pred in preds.items():
            # Use first node of edge key as approximate position
            parts = edge_key.split("-")
            if len(parts) == 2:
                try:
                    node_id = int(parts[0])
                    if node_id in road_graph.nodes:
                        node_data = road_graph.nodes[node_id]
                        dist = haversine_km_simple(
                            seg.lat, seg.lng,
                            node_data["lat"], node_data["lng"],
                        )
                        if dist < best_dist:
                            best_dist = dist
                            best_pred = pred
                except (ValueError, KeyError):
                    continue

        if best_pred:
            results.append({
                "segmentId": seg.segmentId,
                "speed": round(best_pred["speed"], 2),
                "flow": round(best_pred["flow"], 2),
                "congestion": round(best_pred["congestion"], 4),
                "confidence": round(max(0.5, 1.0 - best_dist / 5.0), 4),
                "model": model_used,
            })
        else:
            results.append({
                "segmentId": seg.segmentId,
                "speed": 35.0,
                "flow": 40.0,
                "congestion": 0.3,
                "confidence": 0.1,
                "model": "fallback",
            })

    return {"predictions": results, "model": model_used}


def haversine_km_simple(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Simple haversine in km."""
    from utils.haversine import haversine_km
    return haversine_km(lat1, lng1, lat2, lng2)


if __name__ == "__main__":
    import uvicorn
    from config import PORT, IS_HF_SPACE
    
    # Use reload only in development
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=PORT, 
        reload=not IS_HF_SPACE
    )
