# ForecastWell Dashboard

Weather-based demand forecasting tool for HVAC and consumer durables companies — predicts AC demand across 6 South India cities using real-time temperature data from Open-Meteo.

> **Core Insight:** Night temperature is the primary demand driver. A city with night temps above 24°C sees 12–16 hours of AC usage daily (evening + overnight), far exceeding a city with high day temps but cool nights.

---

## Features

### Demand Intelligence
- **Night-Priority Demand Index** — 0–100 score weighted 60% night temp / 40% day temp
- **DSB Zone Classification** — Green (≤40) / Amber (40–70) / Red (>70) methodology
- **Wave Sequence Analysis** — Wave 1 (NOW) → Wave 2 (+2 weeks) → Wave 3 (+6 weeks) market timing
- **AC Hours Estimation** — Estimated daily AC usage hours based on day + night temperatures
- **Demand Correlation** — Pearson correlation between weather patterns and simulated sales data

### Alert System
- **6-Level Color Alerts** — Blue → Green → Yellow → Orange → Red → Kerala Special (Purple)
- **Kerala Coastal Alert** — Special purple alert for hot coastal nights triggering overnight AC demand
- **Heatwave Detection** — Consecutive hot day tracking (≥40°C day & ≥28°C night for ≥3 days)
- **Wet Bulb Temperature** — Stull (2011) formula; danger threshold at 32°C
- **Multi-Channel Notifications** — Email (SMTP), SMS and WhatsApp (Twilio) for critical alerts

### Weather & Forecasting
- **Interactive South India Map** — Leaflet.js map with real-time city temperature markers
- **Temperature Trend Charts** — 30-day historical + 120-day seasonal forecast via Chart.js
- **Monsoon Phase Tracker** — Pre-monsoon / Active / Post-monsoon status with days countdown
- **Year-on-Year Comparison** — Monthly and historical temperature comparisons
- **Monthly Heatmaps** — Per-city temperature heatmap grids

### Operations & Planning
- **Service Demand Predictions** — Compressor failures, gas refills, warranty claims, installations
- **Inventory Recommendations** — Actionable steps per alert level (e.g., "Increase inventory 50–60%")
- **Excel Import/Export** — Supports both List format and Matrix (Voltas-style) IMD data files
- **PDF Report Generation** — Alert and forecast reports via ReportLab
- **Refresh Status** — Daily weather / weekly demand / monthly accuracy cadence tracker

### Performance & Infrastructure
- **Multi-Tier Caching** — In-memory (3-hour TTL) + file-based persistent cache (survives restarts)
- **SSE Push Updates** — Server-Sent Events notify browser clients when fresh data is available
- **Gzip Compression** — Automatic response compression; reduces JSON payload ~40%
- **Background Scheduler** — APScheduler refreshes weather data on a 3-hour cycle
- **Supabase Integration** — Optional PostgreSQL persistence for weather logs and alerts
- **JWT Authentication** — Supabase JWT auth with Bearer token support and session fallback

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11 · Flask 3.0 · Flask-CORS · APScheduler |
| Frontend | HTML5 · CSS3 · Vanilla JavaScript · Chart.js · Leaflet.js |
| Database | Supabase (PostgreSQL) |
| Weather API | Open-Meteo |
| Notifications | SMTP email · Twilio (SMS + WhatsApp) |
| Excel | pandas · openpyxl · xlrd · xlsxwriter |
| PDF | ReportLab |
| Deployment | Gunicorn |

---

## Setup Instructions

### Prerequisites
- Python 3.11 (recommended) — older/newer Python may cause binary wheel build issues for numpy/pandas
- pip (Python package manager)

> **Important:** The app runs in real-data-only mode. Synthetic/fallback weather data has been removed from the backend. If the live weather API is unavailable the server returns null values — it does not fabricate data.

### Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables:
```bash
copy .env.example .env
# Edit .env with your Supabase URL/key, email credentials, Twilio keys, etc.
```

3. Run the application:
```bash
python app.py
```

4. Open your browser:
```
http://localhost:5000
```

For production, use Gunicorn:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Optional |
| `SUPABASE_KEY` | Supabase anon/service key | Optional |
| `EMAIL_ENABLED` | Enable SMTP email alerts | Optional |
| `EMAIL_SENDER` | Sender email address | Optional |
| `EMAIL_PASSWORD` | SMTP password | Optional |
| `EMAIL_RECIPIENTS` | Comma-separated recipient list | Optional |
| `SMS_ENABLED` | Enable Twilio SMS | Optional |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | Optional |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Optional |
| `WHATSAPP_ENABLED` | Enable Twilio WhatsApp | Optional |

---

## Project Structure

```
Weather Based Dashboard/
├── app.py                        # Flask entry point (~3,600 lines)
├── config.py                     # Thresholds, city configs, feature flags
├── requirements.txt              # Python dependencies
├── templates/
│   ├── index.html                # Main dashboard UI
│   └── login.html                # Supabase authentication page
├── static/
│   ├── css/
│   │   ├── style.css             # Source stylesheet
│   │   └── style.min.css         # Minified (served in production)
│   ├── js/
│   │   ├── dashboard.js          # Source JavaScript
│   │   └── dashboard.min.js      # Minified (served in production)
│   ├── data/
│   │   └── config.json           # City metadata and API endpoint reference
│   ├── images/
│   │   └── logo.png
│   └── favicon.svg
├── utils/
│   ├── weather_service.py        # Open-Meteo API integration
│   ├── alert_engine.py           # Threshold analysis & demand recommendations
│   ├── data_processor.py         # Demand index, Excel import/export, wet bulb
│   ├── supabase_client.py        # Supabase CRUD (weather logs, alerts)
│   ├── notification_service.py   # Email/SMS/WhatsApp dispatch
│   ├── file_cache.py             # File-based persistent cache
│   └── __init__.py
├── remotion-demo/                # Remotion video demo (see below)
└── cache_data/                   # Runtime file cache (auto-created)
```

---

## City Coverage

| City | State | Market Trait |
|------|-------|--------------|
| Chennai | Tamil Nadu | Major HVAC market, coastal climate |
| Bangalore | Karnataka | IT hub, high purchasing power |
| Hyderabad | Telangana | Growing market, hot summers |
| Kochi | Kerala | Coastal high-humidity — Kerala Special alerts |
| Coimbatore | Tamil Nadu | Industrial city, textile hub |
| Visakhapatnam | Andhra Pradesh | Port city, emerging market |

---

## Demand Logic

### Demand Index (0–100)
```
Demand Index = (Night Index × 0.60) + (Day Index × 0.40)
If humidity > 70% → index × 1.15
If humidity < 40% → index × 0.90
```

### Night Temperature Thresholds (primary driver)
| Night Temp | Alert Level | Action |
|------------|-------------|--------|
| ≥ 32°C | 🔴 RED | EXTREME — push inventory +50–60% |
| ≥ 28°C | 🟠 ORANGE | HIGH — accelerate +30–40% |
| ≥ 24°C | 🟡 YELLOW | WARM — position stock +20% |
| ≥ 20°C | 🟢 GREEN | NORMAL — monitor |
| < 20°C | 🔵 BLUE | OFF SEASON — reduce replenishment |
| Kochi special | 🟣 PURPLE | KERALA SPECIAL — coastal hot nights |

### AC Hours Logic
| Scenario | Hours | Season |
|----------|-------|--------|
| Day 35°C + Night 21°C | 4–6 hrs | Afternoon only |
| Day 32°C + Night 25°C | 12–16 hrs | Evening + overnight |

---

## API Endpoints

### Core
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Dashboard (requires login) |
| GET | `/login` | Login page |
| GET | `/api/cities` | List of all cities |
| GET | `/api/dashboard-init` | Bulk init payload (weather + alerts + KPIs) |
| GET | `/api/weather/current` | Current weather for all cities |
| GET | `/api/weather/city/<city_id>` | Detailed weather for one city |
| GET | `/api/alerts` | All active alerts |
| GET | `/api/alerts/city/<city_id>` | Alerts for a specific city |
| POST | `/api/alerts/ack` | Acknowledge an alert |
| GET | `/api/kpis` | Dashboard KPI summary |

### Forecasting & Analysis
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/forecast` | Seasonal forecast (all cities) |
| GET | `/api/forecast/analysis/<city_id>` | Per-city forecast + recommendations |
| GET | `/api/forecast/year-compare` | Year-on-year forecast comparison |
| GET | `/api/wave-sequence` | Wave 1/2/3 market timing analysis |
| GET | `/api/demand-prediction` | Demand prediction for all cities |
| GET | `/api/demand-correlation` | Weather-to-sales correlation data |
| GET | `/api/insights` | Full AI-style demand insights |
| GET | `/api/insights/simple` | Lightweight insights summary |
| GET | `/api/advanced-weather` | Wet bulb, heatwave, monsoon phase |
| GET | `/api/service-predictions` | Compressor/gas/warranty/install demand |
| GET | `/api/dsb-overview` | DSB zone overview for all cities |
| GET | `/api/demand-intel-combined` | Combined demand intelligence payload |

### Historical Data
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/history` | Historical weather data |
| GET | `/api/monthly-history` | Monthly average history |
| GET | `/api/historical/date-compare` | Date-range comparison |
| GET | `/api/historical/two-years` | Two-year historical comparison |
| GET | `/api/historical/summary` | Historical summary statistics |
| GET | `/api/heatmap/monthly` | Monthly temperature heatmap |
| GET | `/api/comparison/monthly-yoy` | Month-over-year comparison |
| GET | `/api/weekly-summary` | Weekly demand summary |
| GET | `/api/energy-estimates` | Energy consumption estimates |

### Import / Export
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/import/excel` | Upload IMD Excel file (list or matrix format) |
| POST | `/api/export/excel` | Export dashboard data to Excel |
| POST | `/api/export/alert-report` | Generate PDF alert report |
| POST | `/api/export/forecast-report` | Generate PDF forecast report |
| GET | `/api/download/<filename>` | Download generated file |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/cache-stats` | Cache hit/miss statistics |
| GET | `/api/stream` | SSE stream for real-time push updates |
| GET | `/api/refresh-status` | Refresh cadence status |
| GET | `/api/dashboard/summary` | Dashboard summary statistics |
| GET | `/api/generate-checklist` | Generate action checklist |

### Supabase
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/supabase/weather-history` | Fetch persisted weather logs |
| GET | `/api/supabase/alerts` | Fetch persisted alerts |
| POST | `/api/supabase/alerts/ack` | Acknowledge alert in DB |
| GET | `/api/supabase/status` | Supabase connection health |

---

## Remotion Demo Video

A 55-second product demo video is included in `remotion-demo/`.

```bash
cd remotion-demo
npm install
npm start           # Preview at http://localhost:3000
npm run render      # Render → out/forecastwell-demo.mp4
```

**Specs:** 1920×1080 · 30fps · 1650 frames
**Scenes:** Hero → Problem → Dashboard → Map → Charts → Alerts → Outro

---

## Excel Import Format

Two formats are supported:

**List Format** (columns: `City`, `Date`, `Day_Temp`, `Night_Temp`, `Humidity`)

**Matrix Format** (Voltas-style: `DATE`, `CHN Max`, `CHN Min`, `HYD Max`, `HYD Min`, …)

City code mappings for matrix format:

| Code | City |
|------|------|
| CHN | Chennai |
| BLR | Bangalore |
| HYD | Hyderabad |
| KOCHI | Kochi |
| CBE | Coimbatore |
| VTZ | Visakhapatnam |

---

## License

Copyright © 2026 Hansei Consultancy. All rights reserved.
