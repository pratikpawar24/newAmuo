"""
Training loop for Traffic LSTM model with early stopping.

Training config:
  - Adam optimizer, lr=0.001 with ReduceLROnPlateau(patience=5, factor=0.5)
  - Batch size: 64, epochs: 100 with early stopping (patience=10)
  - Composite loss: MSE + L2 reg + temporal smoothness
"""

import os
import json
import time
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from typing import Tuple, Optional

from models.lstm_model import TrafficLSTM, TrafficLoss
from models.data_generator import generate_synthetic_data, normalize_data
from config import model_config, MODEL_PATH


def create_dataloaders(
    X: np.ndarray,
    y: np.ndarray,
    batch_size: int = 64,
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
) -> Tuple[DataLoader, DataLoader, DataLoader]:
    """Split data and create DataLoaders."""
    total = len(X)
    train_end = int(total * train_ratio)
    val_end = int(total * (train_ratio + val_ratio))

    X_train, y_train = X[:train_end], y[:train_end]
    X_val, y_val = X[train_end:val_end], y[train_end:val_end]
    X_test, y_test = X[val_end:], y[val_end:]

    train_dataset = TensorDataset(torch.FloatTensor(X_train), torch.FloatTensor(y_train))
    val_dataset = TensorDataset(torch.FloatTensor(X_val), torch.FloatTensor(y_val))
    test_dataset = TensorDataset(torch.FloatTensor(X_test), torch.FloatTensor(y_test))

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, drop_last=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)

    print(f"[Trainer] Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")

    return train_loader, val_loader, test_loader


def train_model(
    model: Optional[TrafficLSTM] = None,
    save_path: Optional[str] = None,
) -> Tuple[TrafficLSTM, dict]:
    """Train the LSTM model on synthetic data.

    Returns trained model and metrics dict including scaler params.
    """
    cfg = model_config
    if save_path is None:
        save_path = MODEL_PATH

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Trainer] Using device: {device}")

    # Generate synthetic data
    print("[Trainer] Generating synthetic training data...")
    start_time = time.time()
    X_raw, y_raw = generate_synthetic_data()
    gen_time = time.time() - start_time
    print(f"[Trainer] Data generation took {gen_time:.1f}s")

    # Normalize
    X_norm, y_norm, scaler = normalize_data(X_raw, y_raw)

    # Create dataloaders
    train_loader, val_loader, test_loader = create_dataloaders(
        X_norm, y_norm, batch_size=cfg.batch_size
    )

    # Initialize model
    if model is None:
        model = TrafficLSTM(
            input_dim=cfg.input_dim,
            hidden_dim_1=cfg.hidden_dim_1,
            hidden_dim_2=cfg.hidden_dim_2,
            output_dim=cfg.output_dim,
            forecast_steps=cfg.forecast,
            dropout=cfg.dropout,
        )
    model = model.to(device)

    # Loss function: L = MSE(y, ŷ) + 0.01·‖W‖² + 0.001·Σ|∂ŷ/∂t − ∂y/∂t|²
    criterion = TrafficLoss(
        l2_lambda=cfg.l2_lambda,
        temporal_lambda=cfg.temporal_lambda,
    )

    # Optimizer: Adam, lr=0.001
    optimizer = torch.optim.Adam(model.parameters(), lr=cfg.learning_rate)

    # Scheduler: ReduceLROnPlateau(patience=5, factor=0.5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", patience=cfg.lr_patience, factor=cfg.lr_factor, verbose=True
    )

    # Training loop
    best_val_loss = float("inf")
    patience_counter = 0
    training_history = {"train_loss": [], "val_loss": [], "lr": []}

    print(f"\n[Trainer] Starting training: {cfg.epochs} epochs, batch={cfg.batch_size}")
    print(f"[Trainer] Model parameters: {sum(p.numel() for p in model.parameters()):,}")
    print("-" * 70)

    for epoch in range(cfg.epochs):
        # Training phase
        model.train()
        train_losses = []
        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)

            optimizer.zero_grad()
            predictions, _ = model(batch_X)
            loss = criterion(predictions, batch_y, model)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_losses.append(loss.item())

        avg_train_loss = np.mean(train_losses)

        # Validation phase
        model.eval()
        val_losses = []
        with torch.no_grad():
            for batch_X, batch_y in val_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                predictions, _ = model(batch_X)
                loss = criterion(predictions, batch_y, model)
                val_losses.append(loss.item())

        avg_val_loss = np.mean(val_losses)
        current_lr = optimizer.param_groups[0]["lr"]

        training_history["train_loss"].append(avg_train_loss)
        training_history["val_loss"].append(avg_val_loss)
        training_history["lr"].append(current_lr)

        # ReduceLROnPlateau
        scheduler.step(avg_val_loss)

        # Print progress
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(
                f"Epoch [{epoch+1:3d}/{cfg.epochs}] "
                f"Train Loss: {avg_train_loss:.6f} | "
                f"Val Loss: {avg_val_loss:.6f} | "
                f"LR: {current_lr:.6f}"
            )

        # Early stopping (patience=10)
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            patience_counter = 0
            # Save best model
            os.makedirs(os.path.dirname(save_path) if os.path.dirname(save_path) else ".", exist_ok=True)
            torch.save({
                "model_state_dict": model.state_dict(),
                "scaler": scaler,
                "config": {
                    "input_dim": cfg.input_dim,
                    "hidden_dim_1": cfg.hidden_dim_1,
                    "hidden_dim_2": cfg.hidden_dim_2,
                    "output_dim": cfg.output_dim,
                    "forecast": cfg.forecast,
                    "dropout": cfg.dropout,
                },
                "best_val_loss": best_val_loss,
                "epoch": epoch + 1,
            }, save_path)
        else:
            patience_counter += 1
            if patience_counter >= cfg.early_stop_patience:
                print(f"\n[Trainer] Early stopping at epoch {epoch+1} (patience={cfg.early_stop_patience})")
                break

    print("-" * 70)

    # Test evaluation
    model.eval()
    test_losses = []
    test_mse = []
    with torch.no_grad():
        mse_fn = nn.MSELoss()
        for batch_X, batch_y in test_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            predictions, _ = model(batch_X)
            test_losses.append(criterion(predictions, batch_y, model).item())
            test_mse.append(mse_fn(predictions, batch_y).item())

    avg_test_loss = np.mean(test_losses)
    avg_test_mse = np.mean(test_mse)
    avg_test_rmse = np.sqrt(avg_test_mse)

    print(f"[Trainer] Test Loss: {avg_test_loss:.6f}")
    print(f"[Trainer] Test MSE: {avg_test_mse:.6f}")
    print(f"[Trainer] Test RMSE: {avg_test_rmse:.6f}")
    print(f"[Trainer] Best Val Loss: {best_val_loss:.6f}")
    print(f"[Trainer] Model saved to: {save_path}")

    metrics = {
        "best_val_loss": best_val_loss,
        "test_loss": avg_test_loss,
        "test_mse": avg_test_mse,
        "test_rmse": avg_test_rmse,
        "epochs_trained": len(training_history["train_loss"]),
        "scaler": scaler,
    }

    return model, metrics


def load_model(path: Optional[str] = None) -> Tuple[TrafficLSTM, dict]:
    """Load a trained model from disk."""
    if path is None:
        path = MODEL_PATH

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = torch.load(path, map_location=device, weights_only=False)
    config = checkpoint["config"]

    model = TrafficLSTM(
        input_dim=config["input_dim"],
        hidden_dim_1=config["hidden_dim_1"],
        hidden_dim_2=config["hidden_dim_2"],
        output_dim=config["output_dim"],
        forecast_steps=config["forecast"],
        dropout=config["dropout"],
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model = model.to(device)
    model.eval()

    scaler = checkpoint["scaler"]
    print(f"[Trainer] Model loaded from {path} (val_loss={checkpoint['best_val_loss']:.6f})")

    return model, scaler
