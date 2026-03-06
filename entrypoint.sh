#!/bin/sh
# Ensure /app/data directory exists
mkdir -p /app/data

# If DB doesn't exist in the volume, seed it
if [ ! -f /app/data/dashboard.db ]; then
    DB_PATH=/app/data/dashboard.db python seed_demo_data.py
fi

exec "$@"
