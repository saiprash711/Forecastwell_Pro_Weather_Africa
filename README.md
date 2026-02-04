# ForecastWell Dashboard

Weather-based demand forecasting tool for HVAC and consumer durables companies to predict AC demand using IMD (India Meteorological Department) temperature data.

## Features

- **Interactive South India Map**: Visual representation of 6 key cities with real-time temperature data
- **Temperature Trend Charts**: Historical and forecast temperature visualization
- **Alert System**: Threshold-based triggers for demand acceleration/de-acceleration
- **Action Recommendations**: AI-driven insights for inventory and production planning
- **IMD Data Integration**: Official weather data from India Meteorological Department

## Setup Instructions

### Prerequisites
- Python 3.9 or higher
- pip (Python package manager)

### Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables:
```bash
copy .env.example .env
# Edit .env file with your configuration
```

3. Run the application:
```bash
python app.py
```

4. Open your browser and navigate to:
```
http://localhost:5000
```

## Project Structure

```
Weather Based Dashboard/
├── app.py                  # Flask application entry point
├── config.py              # Configuration settings
├── requirements.txt       # Python dependencies
├── static/               # Static assets
│   ├── css/
│   ├── js/
│   └── data/
├── templates/            # HTML templates
└── utils/               # Utility modules
    ├── weather_service.py
    ├── alert_engine.py
    └── data_processor.py
```

## Key Cities Coverage

1. Chennai (Tamil Nadu)
2. Bangalore (Karnataka)
3. Hyderabad (Telangana)
4. Kochi (Kerala)
5. Coimbatore (Tamil Nadu)
6. Visakhapatnam (Andhra Pradesh)

## Usage

- **Dashboard View**: Real-time overview of all cities
- **City Details**: Click on map markers for detailed analysis
- **Alerts**: Monitor threshold triggers in the alerts panel
- **Reports**: Export data and insights for business decisions

## Technology Stack

- **Backend**: Python Flask
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Charting**: Chart.js
- **Maps**: Leaflet.js
- **Data**: IMD API, Excel data processing

## License

Copyright © 2026 Hansei Consultancy. All rights reserved.
