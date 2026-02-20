"""
AUMO v2 AI Microservice — FastAPI Application.

Endpoints:
  POST /api/predict-traffic  — LSTM model inference
  POST /api/route            — Time-dependent A* routing
  POST /api/match            — DBSCAN + scoring carpool matching
  POST /api/emissions        — COPERT emission calculator
  GET  /api/health           — health check
  POST /api/train            — trigger model retraining

ON STARTUP:
  1. Check if saved_models/traffic_lstm.pt exists
  2. If not: generate synthetic data, train model, save weights
  3. Load model into memory
  4. Log "AI Service ready" with model accuracy metrics
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
from algorithms.astar import astar_route, get_traffic_overlay
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
scaler: Optional[dict] = None
road_graph = None
model_metrics: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    global model, scaler, road_graph, model_metrics

    print("=" * 60)
    print("AUMO v2 AI Service Starting...")
    print("=" * 60)

    # 1. Check if model exists, if not train it
    if os.path.exists(MODEL_PATH):
        print(f"[Startup] Loading existing model from {MODEL_PATH}")
        try:
            model, scaler = load_model(MODEL_PATH)
            model_metrics = {"status": "loaded", "path": MODEL_PATH}
        except Exception as e:
            print(f"[Startup] Failed to load model: {e}, retraining...")
            model, metrics = train_model()
            scaler = metrics["scaler"]
            model_metrics = metrics
    else:
        print("[Startup] No saved model found, training from scratch...")
        model, metrics = train_model()
        scaler = metrics["scaler"]
        model_metrics = metrics

    print(f"[Startup] Model ready. Metrics: {model_metrics}")

    # 2. Build road graph
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
    print("=" * 60)
    print("AI Service ready ✓")
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
        "model_loaded": model is not None,
        "graph_nodes": road_graph.number_of_nodes() if road_graph else 0,
        "graph_edges": road_graph.number_of_edges() if road_graph else 0,
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
    """Calculate eco-weighted route using time-dependent A*.

    1. Build/load graph from OSM (cache in memory)
    2. Get traffic predictions for relevant segments
    3. Run time-dependent A* with multi-objective cost
    4. Also get OSRM route as fallback/comparison
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

    # Run A* routing
    primary_result = astar_route(
        road_graph,
        start_node,
        goal_node,
        departure,
        alpha=request.weights.alpha,
        beta=request.weights.beta,
        gamma=request.weights.gamma,
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
            road_graph, primary_result["path_nodes"], None, departure
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
    """Trigger model retraining (admin only, secured with API key)."""
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
