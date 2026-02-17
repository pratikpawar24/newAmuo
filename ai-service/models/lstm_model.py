"""
Stacked Bidirectional LSTM with Temporal Attention for Traffic Prediction.

Architecture (Section 2A):
  - Input: sequence of 12 timesteps (5-min intervals = 1hr lookback)
  - Feature vector per timestep (dim=10):
    [flow, speed, density, sin(2π·hour/24), cos(2π·hour/24),
     sin(2π·day/7), cos(2π·day/7), is_holiday, weather_code, precipitation]
  - Layer 1: Bidirectional LSTM(input=10, hidden=128)
  - Layer 2: Bidirectional LSTM(input=256, hidden=64)
  - Temporal Attention:
      eₜ = vᵀ · tanh(W_a · hₜ + b_a)
      αₜ = softmax(eₜ)
      context = Σ αₜ · hₜ
  - Dense(128) → ReLU → Dropout(0.3) → Dense(3)
  - Output: [predicted_speed, predicted_flow, congestion_level] for next 6 steps
"""

import torch
import torch.nn as nn
from typing import Tuple


class TemporalAttention(nn.Module):
    """Temporal attention mechanism over LSTM hidden states.

    Computes:
        eₜ = vᵀ · tanh(W_a · hₜ + b_a)
        αₜ = softmax(eₜ)
        context = Σ αₜ · hₜ
    """

    def __init__(self, hidden_dim: int):
        super().__init__()
        self.W_a = nn.Linear(hidden_dim, hidden_dim, bias=True)
        self.v = nn.Linear(hidden_dim, 1, bias=False)

    def forward(self, hidden_states: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            hidden_states: (batch, seq_len, hidden_dim) - all LSTM hidden states H = [h₁, ..., hₜ]

        Returns:
            context: (batch, hidden_dim) - weighted sum context vector
            attention_weights: (batch, seq_len) - attention weights αₜ
        """
        # eₜ = vᵀ · tanh(W_a · hₜ + b_a)
        energy = self.v(torch.tanh(self.W_a(hidden_states)))  # (batch, seq_len, 1)
        energy = energy.squeeze(-1)  # (batch, seq_len)

        # αₜ = softmax(eₜ)  i.e. αₜ = exp(eₜ) / Σⱼ exp(eⱼ)
        attention_weights = torch.softmax(energy, dim=1)  # (batch, seq_len)

        # context = Σₜ αₜ · hₜ
        context = torch.bmm(
            attention_weights.unsqueeze(1),  # (batch, 1, seq_len)
            hidden_states                     # (batch, seq_len, hidden_dim)
        ).squeeze(1)  # (batch, hidden_dim)

        return context, attention_weights


class TrafficLSTM(nn.Module):
    """Stacked Bidirectional LSTM with Temporal Attention for traffic prediction.

    LSTM cell equations (each of 2 stacked layers):
        fₜ = σ(W_f · [h_{t-1}, xₜ] + b_f)          // forget gate
        iₜ = σ(W_i · [h_{t-1}, xₜ] + b_i)          // input gate
        C̃ₜ = tanh(W_C · [h_{t-1}, xₜ] + b_C)      // candidate
        Cₜ = fₜ ⊙ C_{t-1} + iₜ ⊙ C̃ₜ              // cell state
        oₜ = σ(W_o · [h_{t-1}, xₜ] + b_o)          // output gate
        hₜ = oₜ ⊙ tanh(Cₜ)                         // hidden state
    """

    def __init__(
        self,
        input_dim: int = 10,
        hidden_dim_1: int = 128,
        hidden_dim_2: int = 64,
        output_dim: int = 3,
        forecast_steps: int = 6,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.forecast_steps = forecast_steps
        self.output_dim = output_dim

        # Layer 1: Bidirectional LSTM(input=10, hidden=128)
        self.lstm1 = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim_1,
            batch_first=True,
            bidirectional=True,
        )

        # Layer 2: Bidirectional LSTM(input=256, hidden=64)
        # Input size = hidden_dim_1 * 2 because of bidirectional
        self.lstm2 = nn.LSTM(
            input_size=hidden_dim_1 * 2,
            hidden_size=hidden_dim_2,
            batch_first=True,
            bidirectional=True,
        )

        # Temporal Attention over hidden states
        # Attention input dim = hidden_dim_2 * 2 (bidirectional)
        self.attention = TemporalAttention(hidden_dim_2 * 2)

        # Dense(128) → ReLU → Dropout(0.3) → Dense(output_dim * forecast_steps)
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim_2 * 2, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, output_dim * forecast_steps),
        )

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: (batch, seq_len=12, input_dim=10) - input sequence

        Returns:
            predictions: (batch, forecast_steps=6, output_dim=3) - [speed, flow, congestion]
            attention_weights: (batch, seq_len) - temporal attention weights
        """
        # Layer 1: Bidirectional LSTM
        lstm1_out, _ = self.lstm1(x)  # (batch, seq_len, hidden_dim_1*2)

        # Layer 2: Bidirectional LSTM
        lstm2_out, _ = self.lstm2(lstm1_out)  # (batch, seq_len, hidden_dim_2*2)

        # Temporal Attention
        context, attention_weights = self.attention(lstm2_out)  # (batch, hidden_dim_2*2)

        # ŷ = W_out · context + b_out
        output = self.fc(context)  # (batch, output_dim * forecast_steps)

        # Reshape to (batch, forecast_steps, output_dim)
        predictions = output.view(-1, self.forecast_steps, self.output_dim)

        return predictions, attention_weights


class TrafficLoss(nn.Module):
    """Composite loss function:
        L = MSE(y, ŷ) + λ₁·‖W‖² + λ₂·Σ|∂ŷ/∂t − ∂y/∂t|²

    Where:
        - MSE: mean squared error between prediction and target
        - L2 regularization: weighted sum of squared model parameters
        - Temporal smoothness: difference between temporal gradients
    """

    def __init__(self, l2_lambda: float = 0.01, temporal_lambda: float = 0.001):
        super().__init__()
        self.mse = nn.MSELoss()
        self.l2_lambda = l2_lambda
        self.temporal_lambda = temporal_lambda

    def forward(
        self,
        predictions: torch.Tensor,
        targets: torch.Tensor,
        model: nn.Module,
    ) -> torch.Tensor:
        """
        Args:
            predictions: (batch, forecast_steps, output_dim)
            targets: (batch, forecast_steps, output_dim)
            model: the TrafficLSTM model for L2 regularization

        Returns:
            total_loss: scalar tensor
        """
        # MSE loss: (1/N) Σ(yₜ - ŷₜ)²
        mse_loss = self.mse(predictions, targets)

        # L2 regularization: λ₁‖W‖²
        l2_reg = torch.tensor(0.0, device=predictions.device)
        for param in model.parameters():
            l2_reg = l2_reg + torch.sum(param ** 2)
        l2_loss = self.l2_lambda * l2_reg

        # Temporal smoothness: λ₂ Σ|∂ŷ/∂t - ∂y/∂t|²
        if predictions.size(1) > 1:
            pred_diff = predictions[:, 1:, :] - predictions[:, :-1, :]  # ∂ŷ/∂t
            target_diff = targets[:, 1:, :] - targets[:, :-1, :]        # ∂y/∂t
            temporal_loss = self.temporal_lambda * torch.mean((pred_diff - target_diff) ** 2)
        else:
            temporal_loss = torch.tensor(0.0, device=predictions.device)

        total_loss = mse_loss + l2_loss + temporal_loss
        return total_loss
