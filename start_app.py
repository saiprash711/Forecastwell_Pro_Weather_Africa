#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Wrapper script to start the ForecastWell Pro dashboard with proper encoding.
APScheduler handles all background cache warming and refresh automatically.
"""
import sys
import os

# Set the encoding for stdout/stderr
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Set environment variable for Python IO encoding
os.environ['PYTHONIOENCODING'] = 'utf-8'

if __name__ == "__main__":
    from app import app
    from config import Config

    # APScheduler is initialized at module level in app.py —
    # it starts automatically on import with jobs:
    #   weather_refresh  (every 10 min, first run at +10s)
    #   alerts_refresh   (every 5 min, first run at +15s)
    #   forecast_refresh (every 30 min, first run at +30s)

    app.run(
        host='0.0.0.0',
        port=Config.PORT,
        debug=(Config.FLASK_ENV == 'development')
    )
