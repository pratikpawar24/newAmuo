"""
AUMO-ORION: ST-GAT Trainer with iterative model improvement.

╔══════════════════════════════════════════════════════════════════════════════╗
║  Training Pipeline:                                                          ║
║    1. Load/generate spatio-temporal traffic dataset                          ║
║    2. Build adjacency matrix from road network                               ║
║    3. Train ST-GAT with composite loss                                       ║
║    4. Evaluate on test set with MAE, RMSE, MAPE metrics                     ║
║    5. Iteratively improve: adjust hyperparams, re-train if metrics poor     ║
║                                                                              ║
║  Improvement Strategy:                                                       ║
║    - Round 1: Base config (lr=0.001, GAT heads=4, hidden=32)                ║
║    - Round 2: If MAPE > 15%, increase model capacity                        ║
║    - Round 3: If still poor, add learning rate warmup + cosine annealing    ║
║    - Round 4: Add gradient accumulation for effective larger batch           ║
║                                                                              ║
║  Metrics reported after each round:                                          ║
║    - MAE: Mean Absolute Error                                                ║
║    - RMSE: Root Mean Squared Error                                           ║
║    - MAPE: Mean Absolute Percentage Error                                    ║
║    - Per-horizon breakdown (15min, 30min, 60min)                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import os
import time
import json
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from typing import Tuple, Optional, Dict, Any, List

from models.st_gat_model import SpatioTemporalGAT, SpatioTemporalLoss
from models.dataset_loader import (
    download_metr_la,
    prepare_st_gat_data,
    _generate_metr_la_like_data,
)
from config import model_config

ST_GAT_MODEL_PATH = os.getenv("ST_GAT_MODEL_PATH", "saved_models/st_gat_traffic.pt")


def create_st_gat_dataloaders(
    X: np.ndarray,
    y: np.ndarray,
    batch_size: int = 32,
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
) -> Tuple[DataLoader, DataLoader, DataLoader]:
    """Split spatio-temporal data and create DataLoaders.

    X: (samples, T, N, F) → batched tensors
    y: (samples, N, H, F_out) → batched tensors
    """
    total = len(X)
    train_end = int(total * train_ratio)
    val_end = int(total * (train_ratio + val_ratio))

    X_train, y_train = X[:train_end], y[:train_end]
    X_val, y_val = X[train_end:val_end], y[train_end:val_end]
    X_test, y_test = X[val_end:], y[val_end:]

    train_ds = TensorDataset(torch.FloatTensor(X_train), torch.FloatTensor(y_train))
    val_ds = TensorDataset(torch.FloatTensor(X_val), torch.FloatTensor(y_val))
    test_ds = TensorDataset(torch.FloatTensor(X_test), torch.FloatTensor(y_test))

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, drop_last=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)

    print(f"[ST-GAT Trainer] Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    return train_loader, val_loader, test_loader


def compute_metrics(
    model: SpatioTemporalGAT,
    loader: DataLoader,
    adj_tensor: torch.Tensor,
    scaler: dict,
    device: torch.device,
) -> Dict[str, float]:
    """Compute MAE, RMSE, MAPE on a dataset.

    De-normalizes predictions before computing metrics.
    Also computes per-horizon metrics (if forecast_steps > 1).
    """
    model.eval()
    all_preds = []
    all_targets = []

    y_min = np.array(scaler["y_min"])
    y_max = np.array(scaler["y_max"])
    y_range = y_max - y_min
    y_range[y_range == 0] = 1.0

    with torch.no_grad():
        for batch_X, batch_y in loader:
            batch_X = batch_X.to(device)
            batch_y = batch_y.to(device)
            preds, _ = model(batch_X, adj_tensor)

            # De-normalize
            preds_np = preds.cpu().numpy()
            targets_np = batch_y.cpu().numpy()

            # preds_np: (batch, N, H, F_out), same for targets
            preds_denorm = preds_np * y_range + y_min
            targets_denorm = targets_np * y_range + y_min

            all_preds.append(preds_denorm)
            all_targets.append(targets_denorm)

    all_preds = np.concatenate(all_preds, axis=0)
    all_targets = np.concatenate(all_targets, axis=0)

    # Overall metrics (on speed component, index 0)
    pred_speed = all_preds[:, :, :, 0].flatten()
    true_speed = all_targets[:, :, :, 0].flatten()

    mae = np.mean(np.abs(pred_speed - true_speed))
    rmse = np.sqrt(np.mean((pred_speed - true_speed) ** 2))

    # MAPE: avoid division by zero
    mask = np.abs(true_speed) > 1.0
    if mask.sum() > 0:
        mape = np.mean(np.abs((pred_speed[mask] - true_speed[mask]) / true_speed[mask])) * 100
    else:
        mape = 0.0

    metrics = {
        "mae": float(mae),
        "rmse": float(rmse),
        "mape": float(mape),
    }

    # Per-horizon metrics (each horizon = 5 minutes)
    H = all_preds.shape[2]
    for h in range(H):
        pred_h = all_preds[:, :, h, 0].flatten()
        true_h = all_targets[:, :, h, 0].flatten()
        h_mae = np.mean(np.abs(pred_h - true_h))
        h_rmse = np.sqrt(np.mean((pred_h - true_h) ** 2))
        horizon_min = (h + 1) * 5
        metrics[f"mae_{horizon_min}min"] = float(h_mae)
        metrics[f"rmse_{horizon_min}min"] = float(h_rmse)

    return metrics


def train_st_gat(
    round_num: int = 1,
    prev_metrics: Optional[Dict[str, float]] = None,
    save_path: Optional[str] = None,
) -> Tuple[SpatioTemporalGAT, Dict[str, Any]]:
    """Train the ST-GAT model with iterative improvement.

    Round 1: Base configuration
    Round 2: If MAPE > 15%, increase capacity
    Round 3: If still poor, use cosine annealing + warmup
    Round 4: Gradient accumulation

    Args:
        round_num: current training round (1-4)
        prev_metrics: metrics from previous round
        save_path: where to save model

    Returns:
        (model, full_metrics_dict)
    """
    if save_path is None:
        save_path = ST_GAT_MODEL_PATH

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n{'='*70}")
    print(f"[ST-GAT Trainer] Round {round_num} — Device: {device}")
    print(f"{'='*70}")

    # ── Hyperparameters based on round ─────────────────────────
    configs = {
        1: {"gat_hidden": 32, "gat_heads": 4, "lstm_hidden": 64, "lr": 0.001,
            "batch_size": 32, "epochs": 80, "dropout": 0.2, "gat_layers": 2},
        2: {"gat_hidden": 48, "gat_heads": 6, "lstm_hidden": 96, "lr": 0.0008,
            "batch_size": 32, "epochs": 100, "dropout": 0.15, "gat_layers": 2},
        3: {"gat_hidden": 48, "gat_heads": 6, "lstm_hidden": 96, "lr": 0.0005,
            "batch_size": 24, "epochs": 120, "dropout": 0.15, "gat_layers": 3},
        4: {"gat_hidden": 64, "gat_heads": 8, "lstm_hidden": 128, "lr": 0.0003,
            "batch_size": 16, "epochs": 150, "dropout": 0.1, "gat_layers": 3},
    }
    cfg = configs.get(round_num, configs[1])

    if prev_metrics:
        print(f"[ST-GAT Trainer] Previous round metrics: MAE={prev_metrics.get('mae', '?'):.2f}, "
              f"RMSE={prev_metrics.get('rmse', '?'):.2f}, MAPE={prev_metrics.get('mape', '?'):.1f}%")

    # ── Load/generate dataset ──────────────────────────────────
    print("[ST-GAT Trainer] Loading dataset...")
    t0 = time.time()
    speeds, adj_raw = download_metr_la()

    X, y, adj, scaler = prepare_st_gat_data(
        speeds, adj_raw,
        lookback=model_config.lookback,
        forecast=model_config.forecast,
    )
    print(f"[ST-GAT Trainer] Data prepared in {time.time()-t0:.1f}s")

    N = X.shape[2]  # Number of nodes
    adj_tensor = torch.FloatTensor(adj).to(device)

    train_loader, val_loader, test_loader = create_st_gat_dataloaders(
        X, y, batch_size=cfg["batch_size"],
    )

    # ── Initialize model ────────────────────────────────────────
    model = SpatioTemporalGAT(
        input_dim=10,
        gat_hidden=cfg["gat_hidden"],
        gat_heads=cfg["gat_heads"],
        gat_layers=cfg["gat_layers"],
        lstm_hidden=cfg["lstm_hidden"],
        output_dim=model_config.output_dim,
        forecast_steps=model_config.forecast,
        dropout=cfg["dropout"],
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[ST-GAT Trainer] Model: {total_params:,} params ({trainable_params:,} trainable)")

    # ── Loss & Optimizer ─────────────────────────────────────────
    criterion = SpatioTemporalLoss(
        l2_lambda=0.005,
        temporal_lambda=0.001,
        spatial_lambda=0.0005,
    )

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=cfg["lr"],
        weight_decay=0.01,
    )

    # Scheduler: cosine annealing with warmup for round >= 3
    if round_num >= 3:
        warmup_epochs = 5
        scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
            optimizer, T_0=20, T_mult=2,
        )
    else:
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode="min", patience=7, factor=0.5,
        )

    # ── Training loop ────────────────────────────────────────────
    best_val_loss = float("inf")
    patience_counter = 0
    early_stop_patience = 15
    history = {"train_loss": [], "val_loss": [], "lr": []}

    gradient_accumulation_steps = 4 if round_num >= 4 else 1

    print(f"\n[ST-GAT Trainer] Config: GAT({cfg['gat_layers']}×{cfg['gat_heads']}h×{cfg['gat_hidden']}d), "
          f"LSTM({cfg['lstm_hidden']}), lr={cfg['lr']}, epochs={cfg['epochs']}")
    print(f"[ST-GAT Trainer] Loss: MSE + L2(0.005) + TempSmooth(0.001) + SpatSmooth(0.0005)")
    print("-" * 70)

    for epoch in range(cfg["epochs"]):
        # Training
        model.train()
        train_losses = []
        optimizer.zero_grad()

        for step, (batch_X, batch_y) in enumerate(train_loader):
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            preds, _ = model(batch_X, adj_tensor)
            loss = criterion(preds, batch_y, model, adj_tensor)
            loss = loss / gradient_accumulation_steps
            loss.backward()

            if (step + 1) % gradient_accumulation_steps == 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                optimizer.zero_grad()

            train_losses.append(loss.item() * gradient_accumulation_steps)

        avg_train_loss = np.mean(train_losses)

        # Validation
        model.eval()
        val_losses = []
        with torch.no_grad():
            for batch_X, batch_y in val_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                preds, _ = model(batch_X, adj_tensor)
                loss = criterion(preds, batch_y, model, adj_tensor)
                val_losses.append(loss.item())

        avg_val_loss = np.mean(val_losses) if val_losses else float("inf")
        current_lr = optimizer.param_groups[0]["lr"]

        history["train_loss"].append(float(avg_train_loss))
        history["val_loss"].append(float(avg_val_loss))
        history["lr"].append(float(current_lr))

        # Scheduler step
        if round_num >= 3:
            scheduler.step()
        else:
            scheduler.step(avg_val_loss)

        # Print progress
        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(f"  Epoch [{epoch+1:3d}/{cfg['epochs']}] "
                  f"Train: {avg_train_loss:.6f} | Val: {avg_val_loss:.6f} | LR: {current_lr:.6f}")

        # Early stopping
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            patience_counter = 0
            os.makedirs(os.path.dirname(save_path) if os.path.dirname(save_path) else ".", exist_ok=True)
            torch.save({
                "model_state_dict": model.state_dict(),
                "scaler": scaler,
                "adj": adj.tolist(),
                "num_nodes": N,
                "config": {
                    "gat_hidden": cfg["gat_hidden"],
                    "gat_heads": cfg["gat_heads"],
                    "gat_layers": cfg["gat_layers"],
                    "lstm_hidden": cfg["lstm_hidden"],
                    "output_dim": model_config.output_dim,
                    "forecast": model_config.forecast,
                    "dropout": cfg["dropout"],
                },
                "best_val_loss": float(best_val_loss),
                "epoch": epoch + 1,
                "round": round_num,
            }, save_path)
        else:
            patience_counter += 1
            if patience_counter >= early_stop_patience:
                print(f"\n  Early stopping at epoch {epoch+1}")
                break

    print("-" * 70)

    # ── Test evaluation ──────────────────────────────────────────
    # Reload best model
    checkpoint = torch.load(save_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])

    test_metrics = compute_metrics(model, test_loader, adj_tensor, scaler, device)

    print(f"\n[ST-GAT Trainer] Round {round_num} Test Results:")
    print(f"  MAE:  {test_metrics['mae']:.2f} km/h")
    print(f"  RMSE: {test_metrics['rmse']:.2f} km/h")
    print(f"  MAPE: {test_metrics['mape']:.1f}%")
    for h in range(model_config.forecast):
        horizon_min = (h + 1) * 5
        print(f"  {horizon_min:2d}min — MAE: {test_metrics.get(f'mae_{horizon_min}min', 0):.2f}, "
              f"RMSE: {test_metrics.get(f'rmse_{horizon_min}min', 0):.2f}")

    full_metrics = {
        **test_metrics,
        "best_val_loss": float(best_val_loss),
        "epochs_trained": len(history["train_loss"]),
        "round": round_num,
        "config": cfg,
        "scaler": scaler,
        "num_nodes": N,
    }

    return model, full_metrics


def iterative_train_st_gat(
    max_rounds: int = 3,
    target_mape: float = 12.0,
) -> Tuple[SpatioTemporalGAT, Dict[str, Any]]:
    """Iteratively train ST-GAT, increasing capacity if metrics are poor.

    Strategy:
        Round 1: Base config
        Round 2: If MAPE > target, increase model size
        Round 3: If still > target, add advanced scheduling
        Stop when MAPE ≤ target or max rounds reached

    Args:
        max_rounds: maximum training rounds
        target_mape: target MAPE (%) to achieve

    Returns:
        (best_model, best_metrics)
    """
    print(f"\n{'='*70}")
    print(f"[ST-GAT] Starting iterative training (target MAPE: {target_mape}%)")
    print(f"{'='*70}")

    best_model = None
    best_metrics = None
    prev_metrics = None

    for round_num in range(1, max_rounds + 1):
        model, metrics = train_st_gat(
            round_num=round_num,
            prev_metrics=prev_metrics,
        )

        if best_metrics is None or metrics["mape"] < best_metrics["mape"]:
            best_model = model
            best_metrics = metrics

        if metrics["mape"] <= target_mape:
            print(f"\n[ST-GAT] ✓ Target MAPE achieved: {metrics['mape']:.1f}% ≤ {target_mape}%")
            break

        print(f"\n[ST-GAT] Round {round_num} MAPE ({metrics['mape']:.1f}%) > target ({target_mape}%)")
        if round_num < max_rounds:
            print(f"[ST-GAT] → Increasing model capacity for round {round_num + 1}")
        prev_metrics = metrics

    print(f"\n{'='*70}")
    print(f"[ST-GAT] Best model: Round {best_metrics['round']}, "
          f"MAE={best_metrics['mae']:.2f}, RMSE={best_metrics['rmse']:.2f}, "
          f"MAPE={best_metrics['mape']:.1f}%")
    print(f"{'='*70}\n")

    return best_model, best_metrics


def load_st_gat_model(
    path: Optional[str] = None,
) -> Tuple[SpatioTemporalGAT, dict, np.ndarray]:
    """Load a trained ST-GAT model from disk.

    Returns:
        (model, scaler, adjacency_matrix)
    """
    if path is None:
        path = ST_GAT_MODEL_PATH

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = torch.load(path, map_location=device, weights_only=False)
    cfg = checkpoint["config"]

    model = SpatioTemporalGAT(
        input_dim=10,
        gat_hidden=cfg["gat_hidden"],
        gat_heads=cfg["gat_heads"],
        gat_layers=cfg["gat_layers"],
        lstm_hidden=cfg["lstm_hidden"],
        output_dim=cfg["output_dim"],
        forecast_steps=cfg["forecast"],
        dropout=cfg["dropout"],
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model = model.to(device)
    model.eval()

    scaler = checkpoint["scaler"]
    adj = np.array(checkpoint["adj"], dtype=np.float32)

    print(f"[ST-GAT] Model loaded from {path}")
    print(f"  Nodes: {checkpoint['num_nodes']}, Round: {checkpoint.get('round', 1)}, "
          f"Val loss: {checkpoint['best_val_loss']:.6f}")

    return model, scaler, adj
