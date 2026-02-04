# ForecastWell Dashboard - Technical Documentation

## System Architecture

### Overview
ForecastWell Dashboard is a weather-based demand forecasting system designed for HVAC and consumer durables companies. It uses temperature data from the India Meteorological Department (IMD) to predict AC demand and provide actionable recommendations.

### Technology Stack

#### Backend
- **Framework**: Flask 3.0.0
- **Language**: Python 3.9+
- **Data Processing**: Pandas, NumPy
- **Excel Integration**: openpyxl
- **HTTP Client**: Requests
- **CORS**: Flask-CORS

#### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with CSS Grid and Flexbox
- **JavaScript**: Vanilla JS (ES6+)
- **Mapping**: Leaflet.js 1.9.4
- **Charts**: Chart.js 4.4.0

### Architecture Layers

```
┌─────────────────────────────────────────────┐
│         Presentation Layer                   │
│  (HTML/CSS/JS - Leaflet - Chart.js)         │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│         Application Layer                    │
│       (Flask Routes & Controllers)           │
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│         Business Logic Layer                 │
│  WeatherService | AlertEngine | DataProcessor│
└─────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────┐
│         Data Layer                           │
│    IMD API | Excel Files | Config           │
└─────────────────────────────────────────────┘
```

## Core Components

### 1. Weather Service (`utils/weather_service.py`)
**Responsibility**: Fetch and process weather data from IMD

**Key Methods**:
- `get_current_weather(city_id)`: Get current temperature and conditions
- `get_forecast(city_id, days)`: Get temperature forecast
- `get_historical_data(city_id, days)`: Retrieve historical temperature data
- `get_all_cities_current()`: Batch fetch for all cities

**Data Flow**:
```
IMD API → WeatherService → Data Processing → JSON Response
```

### 2. Alert Engine (`utils/alert_engine.py`)
**Responsibility**: Analyze temperatures and generate alerts/recommendations

**Alert Levels**:
- **CRITICAL** (≥40°C): Critical acceleration needed
- **HIGH** (≥35°C): Acceleration recommended
- **LOW** (≤28°C): De-acceleration suggested
- **NORMAL**: No action required

**Key Methods**:
- `analyze_temperature(temp, city)`: Generate single city alert
- `analyze_forecast(forecast, city)`: Analyze forecast trends
- `get_all_alerts(cities_data)`: Batch alert generation

**Recommendation Engine**:
```python
Temperature → Threshold Check → Alert Level → Action Steps
```

### 3. Data Processor (`utils/data_processor.py`)
**Responsibility**: Process data and calculate metrics

**Key Features**:
- Excel file operations
- Demand index calculation (0-100 scale)
- Temperature trend analysis
- Statistical processing

**Demand Index Formula**:
```
Base Index (by temperature) + Humidity Adjustment = Demand Index
- Temperature ≤25°C: Base 10
- Temperature 26-30°C: Base 30
- Temperature 31-35°C: Base 60
- Temperature 36-40°C: Base 85
- Temperature >40°C: Base 95
- Humidity >70%: +15% multiplier
- Humidity <40%: -10% multiplier
```

## API Specification

### Base URL
```
http://localhost:5000/api
```

### Endpoints

#### 1. Dashboard Summary
```http
GET /api/dashboard/summary
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "total_cities": 6,
    "avg_temperature": 34.5,
    "max_temperature": 39.2,
    "min_temperature": 28.3,
    "avg_demand_index": 72.5,
    "critical_alerts": 1,
    "high_alerts": 3,
    "overall_status": "high"
  }
}
```

#### 2. Current Weather
```http
GET /api/weather/current
```

**Response**:
```json
{
  "status": "success",
  "data": [
    {
      "city_id": "chennai",
      "city_name": "Chennai",
      "state": "Tamil Nadu",
      "temperature": 36.5,
      "humidity": 72.3,
      "feels_like": 38.2,
      "wind_speed": 15.5,
      "demand_index": 78.5,
      "lat": 13.0827,
      "lon": 80.2707,
      "timestamp": "2026-02-02T10:30:00",
      "source": "IMD"
    }
  ],
  "timestamp": "2026-02-02T10:30:00"
}
```

#### 3. City Weather Details
```http
GET /api/weather/city/{city_id}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "current": { /* current weather object */ },
    "forecast": [ /* 7-day forecast array */ ],
    "historical": [ /* 30-day historical array */ ]
  }
}
```

#### 4. Alerts
```http
GET /api/alerts
```

**Response**:
```json
{
  "status": "success",
  "data": [
    {
      "city": "Chennai",
      "temperature": 39.5,
      "timestamp": "2026-02-02T10:30:00",
      "alert_level": "high",
      "trigger_type": "ACCELERATION",
      "recommendation": {
        "action": "ACCELERATION",
        "priority": "HIGH",
        "steps": [
          "⚠️ HIGH: Chennai showing elevated temperatures",
          "Increase AC inventory by 30-40%",
          "Alert distribution network"
        ]
      }
    }
  ],
  "count": 4
}
```

## Database Schema (Future Enhancement)

Currently using in-memory data. For production, recommend PostgreSQL:

```sql
-- Cities table
CREATE TABLE cities (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    imd_station VARCHAR(100)
);

-- Weather data table
CREATE TABLE weather_data (
    id SERIAL PRIMARY KEY,
    city_id VARCHAR(50) REFERENCES cities(id),
    temperature DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    wind_speed DECIMAL(5, 2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50)
);

-- Alerts table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    city_id VARCHAR(50) REFERENCES cities(id),
    alert_level VARCHAR(20),
    trigger_type VARCHAR(50),
    temperature DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Configuration

### Environment Variables (`.env`)
```bash
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your-secret-key
IMD_API_KEY=your-imd-api-key
PORT=5000
```

### Application Config (`config.py`)
- Temperature thresholds
- City definitions
- API settings
- System parameters

## Security Considerations

### Current Implementation
- CORS enabled for development
- Environment variable configuration
- Input validation on API endpoints

### Production Recommendations
1. **Authentication**: Implement JWT or OAuth2
2. **HTTPS**: Enforce SSL/TLS
3. **Rate Limiting**: Prevent API abuse
4. **CORS**: Restrict to specific origins
5. **API Key Management**: Secure IMD API keys
6. **Input Sanitization**: Prevent injection attacks
7. **Logging**: Implement comprehensive logging
8. **Monitoring**: Use APM tools (e.g., New Relic, Datadog)

## Performance Optimization

### Current Features
- Parallel API calls (async where possible)
- Client-side caching
- Auto-refresh with 5-minute intervals

### Future Enhancements
1. **Redis Caching**: Cache weather data
2. **CDN**: Serve static assets via CDN
3. **Database Connection Pooling**
4. **API Response Compression**
5. **Lazy Loading**: Load charts on demand
6. **Service Workers**: Offline capability

## Deployment Guide

### Development
```bash
python app.py
```

### Production (Gunicorn)
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Docker Deployment
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

### Cloud Deployment Options
1. **AWS Elastic Beanstalk**
2. **Heroku**
3. **Google Cloud Run**
4. **Azure App Service**
5. **DigitalOcean App Platform**

## Testing Strategy

### Unit Tests
```python
# tests/test_weather_service.py
def test_get_current_weather():
    service = WeatherService()
    data = service.get_current_weather('chennai')
    assert data is not None
    assert 'temperature' in data
```

### Integration Tests
- API endpoint testing
- Database operations
- External API integration

### Load Testing
- Apache JMeter
- Locust
- k6

## Monitoring & Logging

### Recommended Tools
- **Application Monitoring**: New Relic, Datadog
- **Log Management**: ELK Stack, Splunk
- **Uptime Monitoring**: Pingdom, UptimeRobot
- **Error Tracking**: Sentry

### Key Metrics
- API response times
- Error rates
- User engagement
- Temperature data accuracy
- Alert generation frequency

## Maintenance

### Regular Tasks
1. **Daily**: Monitor alerts and system health
2. **Weekly**: Review data accuracy
3. **Monthly**: Update IMD API integration
4. **Quarterly**: Security audits

### Backup Strategy
- Database backups (daily)
- Configuration backups
- Historical data archival

## Support & Troubleshooting

### Common Issues

**Issue**: Map not loading
**Solution**: Check internet connection, verify Leaflet CDN

**Issue**: No data displayed
**Solution**: Check IMD API key, verify network connectivity

**Issue**: Port already in use
**Solution**: Change PORT in .env file

### Debug Mode
```bash
export FLASK_ENV=development
export FLASK_DEBUG=1
python app.py
```

## Roadmap

### Phase 1 (Current)
- ✅ Basic dashboard
- ✅ Temperature visualization
- ✅ Alert system
- ✅ IMD integration

### Phase 2 (Q2 2026)
- [ ] User authentication
- [ ] Historical data storage
- [ ] Advanced analytics
- [ ] Email/SMS alerts

### Phase 3 (Q3 2026)
- [ ] Machine learning predictions
- [ ] Multi-region support
- [ ] Mobile app
- [ ] API for third-party integration

## License & Credits

**Developed by**: Hansei Consultancy  
**Data Source**: India Meteorological Department (IMD)  
**Version**: 1.0.0  
**License**: Proprietary

---

For technical support, contact: support@hanseiconsultancy.com
