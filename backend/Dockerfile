FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory for persistent storage
RUN mkdir -p /data

# Expose port (Railway uses PORT env var)
EXPOSE 8000

# Set default port
ENV PORT=8000

# Run the application using shell form to expand $PORT
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
