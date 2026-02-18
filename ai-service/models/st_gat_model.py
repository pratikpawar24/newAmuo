"""
AUMO-ORION: Spatio-Temporal Graph Attention Network for Traffic Prediction.

╔══════════════════════════════════════════════════════════════════════════════╗
║                    MATHEMATICAL FOUNDATION                                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  WHY LSTM ALONE IS INSUFFICIENT:                                             ║
║  ─────────────────────────────────                                           ║
║  LSTM models traffic as: T̂_ij(t+Δ) = f_θ(X_ij(t-k:t))                     ║
║  This treats each road segment independently — but traffic on edge e_ij     ║
║  at time t depends on ADJACENT edges (congestion propagation):               ║
║                                                                              ║
║    T̂_ij(t+Δ) = f_θ(X_{t-k:t}, A)                                          ║
║                                                                              ║
║  where A is the adjacency matrix of the road network graph G = (V, E).      ║
║                                                                              ║
║  Example: If upstream edge e_ab has congestion, downstream e_bc will be      ║
║  affected within Δt ≈ length(e_ab) / v_ab seconds.                          ║
║                                                                              ║
║  WHY SPATIO-TEMPORAL MODELING IS REQUIRED:                                   ║
║  ─────────────────────────────────────────                                   ║
║  Traffic is a spatio-temporal field T(x, t) where:                           ║
║    - Temporal: periodic (rush hours), trend (long-term), residual            ║
║    - Spatial: congestion propagates along graph edges                         ║
║                                                                              ║
║  Our ST-GAT architecture captures both:                                      ║
║    1. Spatial: Graph Attention Network (GAT) learns edge importance          ║
║       α_ij = softmax_j(LeakyReLU(a^T [Wh_i || Wh_j]))                      ║
║       h'_i = σ(Σ_{j∈N(i)} α_ij · W · h_j)                                 ║
║                                                                              ║
║    2. Temporal: Bidirectional LSTM with attention captures sequences         ║
║       e_t = v^T · tanh(W_a · h_t + b_a)                                    ║
║       α_t = softmax(e_t)                                                     ║
║       context = Σ α_t · h_t                                                 ║
║                                                                              ║
║  ARCHITECTURE:                                                               ║
║  ────────────                                                                ║
║  Input: X ∈ ℝ^{N×T×F} (N nodes, T timesteps, F features)                   ║
║  A ∈ ℝ^{N×N} adjacency matrix                                              ║
║                                                                              ║
║  For each timestep t:                                                        ║
║    H^(0)_t = X_t ∈ ℝ^{N×F}                                                ║
║    H^(l+1)_t = GAT_l(H^(l)_t, A)  // L=2 GAT layers                       ║
║    Z_t = H^(L)_t ∈ ℝ^{N×d_gat}                                            ║
║                                                                              ║
║  For each node i:                                                            ║
║    LSTM input: [Z_1[i], Z_2[i], ..., Z_T[i]] ∈ ℝ^{T×d_gat}               ║
║    context_i = TemporalAttention(BiLSTM([Z_1[i],...,Z_T[i]]))              ║
║    ŷ_i = MLP(context_i) ∈ ℝ^{F_out×H_forecast}                            ║
║                                                                              ║
║  Output: ŷ ∈ ℝ^{N×H×F_out} (speed, flow, congestion for H future steps)   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple, Optional


class GraphAttentionLayer(nn.Module):
    """Single-head Graph Attention Layer (Veličković et al., 2018).

    Computes:
        e_ij = LeakyReLU(a^T [W·h_i ∥ W·h_j])
        α_ij = softmax_j(e_ij) = exp(e_ij) / Σ_{k∈N(i)} exp(e_ik)
        h'_i = σ(Σ_{j∈N(i)} α_ij · W · h_j)

    Self-loops included so each node attends to itself.
    """

    def __init__(self, in_features: int, out_features: int, dropout: float = 0.1,
                 alpha: float = 0.2, concat: bool = True):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.concat = concat

        # W ∈ ℝ^{F' × F}: shared linear transform
        self.W = nn.Parameter(torch.empty(in_features, out_features))
        nn.init.xavier_uniform_(self.W, gain=1.414)

        # a ∈ ℝ^{2F'}: attention mechanism
        self.a = nn.Parameter(torch.empty(2 * out_features, 1))
        nn.init.xavier_uniform_(self.a, gain=1.414)

        self.leaky_relu = nn.LeakyReLU(alpha)
        self.dropout = nn.Dropout(dropout)

    def forward(self, h: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        """
        Args:
            h: (batch, N, in_features) — node features
            adj: (N, N) or (batch, N, N) — adjacency matrix (1=connected, 0=not)

        Returns:
            h': (batch, N, out_features) — updated node features
        """
        # Wh = h · W, shape: (batch, N, out_features)
        Wh = torch.matmul(h, self.W)

        N = Wh.size(1)  # number of nodes

        # Prepare pairwise concatenation [Wh_i ∥ Wh_j] for all i,j
        # Wh_i: (batch, N, 1, out_features) → repeat → (batch, N, N, out_features)
        # Wh_j: (batch, 1, N, out_features) → repeat → (batch, N, N, out_features)
        Wh_i = Wh.unsqueeze(2).expand(-1, -1, N, -1)  # (batch, N, N, F')
        Wh_j = Wh.unsqueeze(1).expand(-1, N, -1, -1)  # (batch, N, N, F')

        # e_ij = LeakyReLU(a^T [Wh_i ∥ Wh_j])
        concat_ij = torch.cat([Wh_i, Wh_j], dim=-1)   # (batch, N, N, 2F')
        e = self.leaky_relu(torch.matmul(concat_ij, self.a).squeeze(-1))  # (batch, N, N)

        # Mask: set non-adjacent pairs to -inf before softmax
        if adj.dim() == 2:
            adj = adj.unsqueeze(0)  # (1, N, N)
        # Add self-loops
        identity = torch.eye(N, device=adj.device).unsqueeze(0)
        adj_with_self = torch.clamp(adj + identity, max=1.0)

        e = e.masked_fill(adj_with_self == 0, float('-inf'))

        # α_ij = softmax_j(e_ij)
        attention = F.softmax(e, dim=-1)  # (batch, N, N)
        attention = self.dropout(attention)

        # Handle NaN from softmax of all -inf rows
        attention = torch.nan_to_num(attention, nan=0.0)

        # h'_i = σ(Σ_{j∈N(i)} α_ij · W · h_j)
        h_prime = torch.bmm(attention, Wh)  # (batch, N, out_features)

        if self.concat:
            return F.elu(h_prime)
        else:
            return h_prime


class MultiHeadGAT(nn.Module):
    """Multi-Head Graph Attention.

    Concatenates K attention heads:
        h'_i = ∥_{k=1}^{K} σ(Σ_{j∈N(i)} α^k_ij · W^k · h_j)

    For the final layer, averages instead:
        h'_i = σ(1/K Σ_{k=1}^{K} Σ_{j∈N(i)} α^k_ij · W^k · h_j)
    """

    def __init__(self, in_features: int, out_features: int, num_heads: int = 4,
                 dropout: float = 0.1, is_last: bool = False):
        super().__init__()
        self.is_last = is_last
        self.heads = nn.ModuleList([
            GraphAttentionLayer(in_features, out_features, dropout=dropout,
                                concat=not is_last)
            for _ in range(num_heads)
        ])
        self.dropout = nn.Dropout(dropout)

    def forward(self, h: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        if self.is_last:
            # Average heads for final layer
            outputs = [head(h, adj) for head in self.heads]
            return torch.mean(torch.stack(outputs), dim=0)
        else:
            # Concatenate heads for intermediate layers
            outputs = [head(h, adj) for head in self.heads]
            return torch.cat(outputs, dim=-1)


class SpatioTemporalGAT(nn.Module):
    """AUMO-ORION: Spatio-Temporal GAT for Traffic Prediction.

    Architecture:
        For each timestep t ∈ {1,...,T}:
            Z_t = GAT_L(GAT_{L-1}(...GAT_1(X_t, A)..., A), A)

        For each node i ∈ {1,...,N}:
            [h_1,...,h_T] = BiLSTM([Z_1[i],...,Z_T[i]])
            context_i = TemporalAttention(H)
            ŷ_i = FC(context_i) ∈ ℝ^{forecast_steps × output_dim}

    Loss:
        L = MSE(y, ŷ) + λ₁·‖W‖² + λ₂·Σ|∂ŷ/∂t − ∂y/∂t|² + λ₃·SpatialSmooth
    """

    def __init__(
        self,
        input_dim: int = 10,
        gat_hidden: int = 32,
        gat_heads: int = 4,
        gat_layers: int = 2,
        lstm_hidden: int = 64,
        output_dim: int = 3,
        forecast_steps: int = 6,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.output_dim = output_dim
        self.forecast_steps = forecast_steps
        self.gat_hidden = gat_hidden
        self.gat_heads = gat_heads

        # ── GAT layers ──────────────────────────────────────────
        # Layer 1: input_dim → gat_hidden * gat_heads (concatenated)
        # Layer 2: gat_hidden * gat_heads → gat_hidden (averaged)
        self.gat_layers = nn.ModuleList()
        current_dim = input_dim
        for i in range(gat_layers):
            is_last = (i == gat_layers - 1)
            layer = MultiHeadGAT(
                in_features=current_dim,
                out_features=gat_hidden,
                num_heads=gat_heads,
                dropout=dropout,
                is_last=is_last,
            )
            current_dim = gat_hidden if is_last else gat_hidden * gat_heads
            self.gat_layers.append(layer)

        gat_out_dim = gat_hidden  # Last layer averages heads

        # ── Temporal module: BiLSTM + Attention ────────────────
        self.lstm = nn.LSTM(
            input_size=gat_out_dim,
            hidden_size=lstm_hidden,
            batch_first=True,
            bidirectional=True,
            num_layers=2,
            dropout=dropout,
        )

        lstm_out_dim = lstm_hidden * 2  # bidirectional

        # Temporal Attention
        self.attn_W = nn.Linear(lstm_out_dim, lstm_out_dim, bias=True)
        self.attn_v = nn.Linear(lstm_out_dim, 1, bias=False)

        # ── Output MLP ─────────────────────────────────────────
        self.fc = nn.Sequential(
            nn.Linear(lstm_out_dim, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, output_dim * forecast_steps),
        )

    def forward(
        self,
        x: torch.Tensor,
        adj: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: (batch, T, N, F) — traffic features
                batch: batch size
                T: lookback timesteps (e.g. 12)
                N: number of nodes/segments
                F: feature dimension (10)
            adj: (N, N) — adjacency matrix of road graph

        Returns:
            predictions: (batch, N, forecast_steps, output_dim)
            attention_weights: (batch, N, T) — temporal attention per node
        """
        batch, T, N, F = x.shape

        # ── Step 1: Spatial aggregation per timestep ──────────
        # For each t, run GAT on X_t
        spatial_out = []
        for t in range(T):
            h_t = x[:, t, :, :]  # (batch, N, F)
            for gat_layer in self.gat_layers:
                h_t = gat_layer(h_t, adj)
            spatial_out.append(h_t)  # (batch, N, gat_out_dim)

        # Stack: (batch, T, N, gat_out_dim)
        Z = torch.stack(spatial_out, dim=1)

        # ── Step 2: Temporal modeling per node ────────────────
        # Reshape: process each node's time series
        # Z: (batch, T, N, d) → (batch*N, T, d)
        gat_out_dim = Z.size(-1)
        Z_reshaped = Z.permute(0, 2, 1, 3).reshape(batch * N, T, gat_out_dim)

        # BiLSTM
        lstm_out, _ = self.lstm(Z_reshaped)  # (batch*N, T, lstm_out_dim)

        # Temporal Attention
        energy = self.attn_v(torch.tanh(self.attn_W(lstm_out)))  # (batch*N, T, 1)
        attn_weights = F.softmax(energy.squeeze(-1), dim=1)      # (batch*N, T)
        context = torch.bmm(
            attn_weights.unsqueeze(1),  # (batch*N, 1, T)
            lstm_out                     # (batch*N, T, lstm_out_dim)
        ).squeeze(1)                     # (batch*N, lstm_out_dim)

        # ── Step 3: Prediction ─────────────────────────────────
        output = self.fc(context)  # (batch*N, output_dim * forecast_steps)
        output = output.view(batch, N, self.forecast_steps, self.output_dim)

        # Reshape attention weights for output
        attn_weights = attn_weights.view(batch, N, T)

        return output, attn_weights


class SpatioTemporalLoss(nn.Module):
    """AUMO-ORION Loss Function:

    L = MSE(y, ŷ) + λ₁·‖W‖² + λ₂·TemporalSmooth + λ₃·SpatialSmooth

    Where:
        MSE: Mean squared error
        L2: Weight regularization
        TemporalSmooth: |∂ŷ/∂t − ∂y/∂t|² (predictions should have same temporal gradient)
        SpatialSmooth: Σ_{(i,j)∈E} A_ij · ‖ŷ_i − ŷ_j‖² (adjacent nodes should agree)
    """

    def __init__(
        self,
        l2_lambda: float = 0.005,
        temporal_lambda: float = 0.001,
        spatial_lambda: float = 0.0005,
    ):
        super().__init__()
        self.mse = nn.MSELoss()
        self.l2_lambda = l2_lambda
        self.temporal_lambda = temporal_lambda
        self.spatial_lambda = spatial_lambda

    def forward(
        self,
        predictions: torch.Tensor,
        targets: torch.Tensor,
        model: nn.Module,
        adj: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """
        Args:
            predictions: (batch, N, forecast, output_dim)
            targets: (batch, N, forecast, output_dim)
            model: for L2 regularization
            adj: (N, N) adjacency matrix for spatial smoothness
        """
        # MSE loss
        mse_loss = self.mse(predictions, targets)

        # L2 regularization
        l2_reg = torch.tensor(0.0, device=predictions.device)
        for param in model.parameters():
            l2_reg = l2_reg + torch.sum(param ** 2)
        l2_loss = self.l2_lambda * l2_reg

        # Temporal smoothness: λ₂ · Σ|∂ŷ/∂t − ∂y/∂t|²
        temporal_loss = torch.tensor(0.0, device=predictions.device)
        if predictions.size(2) > 1:  # forecast_steps > 1
            pred_diff = predictions[:, :, 1:, :] - predictions[:, :, :-1, :]
            target_diff = targets[:, :, 1:, :] - targets[:, :, :-1, :]
            temporal_loss = self.temporal_lambda * torch.mean((pred_diff - target_diff) ** 2)

        # Spatial smoothness: λ₃ · Σ_{(i,j)∈E} A_ij · ‖ŷ_i − ŷ_j‖²
        spatial_loss = torch.tensor(0.0, device=predictions.device)
        if adj is not None and self.spatial_lambda > 0:
            # Average predictions over forecast steps
            pred_avg = predictions.mean(dim=2)  # (batch, N, output_dim)
            # Compute pairwise differences
            N = pred_avg.size(1)
            # pred_i: (batch, N, 1, F), pred_j: (batch, 1, N, F)
            diff = pred_avg.unsqueeze(2) - pred_avg.unsqueeze(1)  # (batch, N, N, F)
            sq_diff = (diff ** 2).sum(dim=-1)  # (batch, N, N)
            # Weight by adjacency
            if adj.dim() == 2:
                adj_expanded = adj.unsqueeze(0)
            else:
                adj_expanded = adj
            spatial_loss = self.spatial_lambda * torch.mean(adj_expanded * sq_diff)

        total_loss = mse_loss + l2_loss + temporal_loss + spatial_loss
        return total_loss


# ── Fallback: Node-level wrapper for segment-independent inference ──────────

class SegmentIndependentWrapper(nn.Module):
    """Wraps the existing TrafficLSTM for single-segment prediction.

    Used when no graph structure is available (fallback to pure temporal).
    Allows the API to use the same interface for both models.
    """

    def __init__(self, lstm_model):
        super().__init__()
        self.lstm_model = lstm_model

    def predict_segment(
        self,
        x: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: (batch, T, F) — single segment's features

        Returns:
            predictions: (batch, forecast_steps, output_dim)
            attention: (batch, T)
        """
        return self.lstm_model(x)
