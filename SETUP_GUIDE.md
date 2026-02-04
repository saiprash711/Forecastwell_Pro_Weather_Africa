# ForecastWell Dashboard - Quick Start Guide

## Installation Steps

### 1. Set Up Python Environment

```powershell
# Navigate to the project directory
cd "c:\Users\spras\OneDrive\Desktop\Hansei Consultancy\Jan 2026\Weather Based Dashboard"

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

```powershell
# Copy the example environment file
copy .env.example .env

# Edit .env file with your configuration (optional for demo)
# You can use notepad or any text editor
notepad .env
```

### 3. Run the Application

```powershell
# Make sure virtual environment is activated
# Run the Flask application
python app.py
```

The dashboard will be available at: **http://localhost:5000**

## Features Overview

### 🗺️ Interactive Map
- Visual representation of South India with 6 key cities
- Real-time temperature markers
- Click on markers for detailed information
- Color-coded by temperature (cool/warm/hot)

### 📊 Temperature Trends
- Historical data visualization (30 days)
- 7-day forecast projection
- Interactive Chart.js graphs

### ⚠️ Alert System
- **CRITICAL**: Temperature ≥ 40°C → Critical Acceleration
- **HIGH**: Temperature ≥ 35°C → Acceleration
- **LOW**: Temperature ≤ 28°C → De-acceleration
- **NORMAL**: Within normal range

### 💡 Recommendations
Each alert includes specific action items:
- Inventory adjustment recommendations
- Production planning guidance
- Distribution network alerts
- Marketing campaign suggestions

### 📈 Demand Index
- 0-100 scale based on temperature and humidity
- Visual meter display
- Real-time calculation

## API Endpoints

### Dashboard Summary
```
GET /api/dashboard/summary
```
Returns overall statistics and metrics

### Current Weather
```
GET /api/weather/current
```
Get current weather for all cities

### City Details
```
GET /api/weather/city/<city_id>
```
Get detailed weather data for a specific city

### Alerts
```
GET /api/alerts
```
Get all active alerts

### Forecast Analysis
```
GET /api/forecast/analysis/<city_id>
```
Get forecast analysis and recommendations

## City Coverage

1. **Chennai** (Tamil Nadu)
2. **Bangalore** (Karnataka)
3. **Hyderabad** (Telangana)
4. **Kochi** (Kerala)
5. **Coimbatore** (Tamil Nadu)
6. **Visakhapatnam** (Andhra Pradesh)

## Customization

### Adjust Temperature Thresholds
Edit `config.py`:
```python
THRESHOLD_HIGH = 35      # Acceleration trigger
THRESHOLD_CRITICAL = 40  # Critical acceleration
THRESHOLD_LOW = 28       # De-acceleration trigger
```

### Add More Cities
Edit `config.py` CITIES array:
```python
{
    'id': 'city_id',
    'name': 'City Name',
    'state': 'State',
    'lat': latitude,
    'lon': longitude,
    'imd_station': 'IMD_STATION_CODE'
}
```

## Integrating Real IMD Data

Currently using simulated data. To integrate real IMD API:

1. Get IMD API key from IMD website
2. Update `.env` file with your API key
3. Modify `utils/weather_service.py` `_call_imd_api()` method with actual IMD endpoints

## Troubleshooting

### Port Already in Use
```powershell
# Change port in .env file
PORT=5001
```

### Module Not Found
```powershell
# Reinstall dependencies
pip install -r requirements.txt --upgrade
```

### Map Not Loading
- Check internet connection (Leaflet uses CDN)
- Ensure JavaScript is enabled in browser

## Production Deployment

For production deployment:

1. Set environment to production in `.env`:
```
FLASK_ENV=production
```

2. Use Gunicorn or similar WSGI server:
```powershell
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

3. Set up reverse proxy (nginx/Apache)
4. Enable HTTPS
5. Configure proper logging

## Support

For issues or questions:
- Check the README.md file
- Review API documentation
- Contact: Hansei Consultancy

---

**Note**: This is a demonstration version using simulated IMD data. For production use, integrate with actual IMD API endpoints.
