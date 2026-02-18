---
title: AUMO AI Service
emoji: 🚗
colorFrom: green
colorTo: blue
sdk: docker
pinned: false
license: mit
app_port: 7860
---

# AUMO v2 AI Service

AI-powered microservice for urban mobility optimization.

## Features

- **Traffic Prediction**: BiLSTM with Temporal Attention for traffic flow forecasting
- **Eco-Routing**: Time-dependent A* algorithm with emission-aware cost function
- **Carpool Matching**: DBSCAN clustering with multi-factor scoring
- **Emissions Calculator**: COPERT IV model for CO₂ estimation

## API Endpoints

- `POST /api/predict-traffic` - LSTM traffic prediction
- `POST /api/route` - Eco-friendly route calculation
- `POST /api/match` - Carpool ride matching
- `POST /api/emissions` - Emission calculation
- `GET /api/health` - Health check

## Environment Variables

Set these in your HF Space secrets:

- `API_KEY`: API authentication key
- `CORS_ORIGINS`: Allowed CORS origins (comma-separated)
- `BACKEND_URL`: Backend API URL for callbacks
