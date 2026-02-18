FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Copy application code
COPY . .

# Create directories for models
RUN mkdir -p saved_models

# Create a non-root user for Hugging Face Spaces
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy files with proper ownership
COPY --chown=user . $HOME/app

# Hugging Face Spaces uses port 7860, local dev uses 8000
# The PORT env variable is set automatically by HF Spaces
ENV PORT=7860

EXPOSE 7860
EXPOSE 8000

# Use shell form to allow variable substitution
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}
