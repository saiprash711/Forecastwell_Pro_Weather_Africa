import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    FLASK_APP = os.environ.get('FLASK_APP') or 'app.py'
    FLASK_ENV = os.environ.get('FLASK_ENV') or 'development'
    IMD_API_KEY = os.environ.get('IMD_API_KEY') or ''
    # OpenWeatherMap API (FREE - Get key from https://openweathermap.org/api)
    OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY') or ''
    PORT = int(os.environ.get('PORT', 5000))
    
    # Temperature thresholds for alerts (in Celsius) - Per Guide Specifications
    # Day Temperature Color Coding
    THRESHOLD_RED_DAY = 38  # EXTREME - Full Push
    THRESHOLD_ORANGE_DAY = 36  # STRONG - Accelerate
    THRESHOLD_YELLOW_DAY = 34  # WARM - Position Stock
    THRESHOLD_GREEN_DAY = 32  # NORMAL - Monitor
    # Below 32°C = BLUE (Cool - Off Season)
    
    # Night Temperature Color Coding (MORE IMPORTANT than day!)
    THRESHOLD_RED_NIGHT = 24  # EXTREME - Full Push
    THRESHOLD_ORANGE_NIGHT = 22  # STRONG - Accelerate
    THRESHOLD_YELLOW_NIGHT = 20  # WARM - Position Stock
    THRESHOLD_GREEN_NIGHT = 18  # NORMAL - Monitor
    # Below 18°C = BLUE (Cool - Off Season)
    
    # Kerala Special: Purple alert for hot nights
    KERALA_NIGHT_THRESHOLD = 24  # Kerala cities with night temp ≥24°C
    KERALA_CITIES = ['kochi']  # Cities eligible for Kerala special alert
    
    # Wave Sequence Configuration
    WAVE_1_WEEKS = 0  # NOW - Lead indicators
    WAVE_2_WEEKS = 2  # +2 weeks - Building markets
    WAVE_3_WEEKS = 6  # +6 weeks - Lag markets
    
    # DSB Methodology — Actionable Alert Thresholds
    DSB_GREEN = {'label': 'Green — Normal', 'action': 'Normal stocking levels', 'demand_max': 40}
    DSB_AMBER = {'label': 'Amber — Pre-Position', 'action': 'Pre-position additional inventory', 'demand_max': 70}
    DSB_RED = {'label': 'Red — Emergency', 'action': 'Activate emergency replenishment', 'demand_max': 100}
    
    # Heat wave: consecutive days above threshold
    HEATWAVE_DAY_THRESHOLD = 40   # °C day temp
    HEATWAVE_NIGHT_THRESHOLD = 28  # °C night temp
    HEATWAVE_CONSECUTIVE_DAYS = 3  # minimum consecutive days to declare heat wave
    
    # Wet bulb temperature danger threshold (heat stress)
    WET_BULB_DANGER = 32  # °C (above this, human body cannot cool)
    WET_BULB_CAUTION = 28
    
    # Monsoon onset/withdrawal typical dates (South India)
    MONSOON_ONSET = {'month': 6, 'day': 1, 'label': 'Southwest Monsoon Onset'}
    MONSOON_WITHDRAWAL = {'month': 10, 'day': 15, 'label': 'Monsoon Withdrawal'}
    
    # Refresh cadence
    REFRESH_WEATHER_HOURS = 24     # Daily weather refresh
    REFRESH_DEMAND_DAYS = 7        # Weekly demand forecast
    REFRESH_ACCURACY_DAYS = 30     # Monthly accuracy validation
    FORECAST_ACCURACY = 87         # Validated forecast accuracy %

    # Alert webhooks: list of URLs to POST JSON to when Amber/Red/Kerala special alerts are raised
    ALERT_WEBHOOK_URLS = []  # e.g. ['https://hooks.example.com/alerts']
    ALERT_WEBHOOK_HEADERS = {}  # optional additional headers
    ALERT_WEBHOOK_TIMEOUT = 5  # seconds per webhook request
    
    # Cities configuration - 6 Demand Zones (distinct weather-to-demand patterns)
    CITIES = [
        {
            'id': 'chennai',
            'name': 'Chennai',
            'state': 'Tamil Nadu',
            'lat': 13.0827,
            'lon': 80.2707,
            'imd_station': 'CHENNAI',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'High humidity, warm nights, coastal influence'
        },
        {
            'id': 'bangalore',
            'name': 'Bangalore',
            'state': 'Karnataka',
            'lat': 12.9716,
            'lon': 77.5946,
            'imd_station': 'BANGALORE',
            'demand_zone': 'Moderate Plateau Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'Pleasant climate, moderate demand, IT hub'
        },
        {
            'id': 'hyderabad',
            'name': 'Hyderabad',
            'state': 'Telangana',
            'lat': 17.3850,
            'lon': 78.4867,
            'imd_station': 'HYDERABAD',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Extreme dry heat, high day temps, sharp demand spikes'
        },
        {
            'id': 'kochi',
            'name': 'Kochi',
            'state': 'Kerala',
            'lat': 9.9312,
            'lon': 76.2673,
            'imd_station': 'KOCHI',
            'demand_zone': 'Tropical Wet Zone',
            'zone_icon': '🌴',
            'zone_traits': 'Year-round humidity, monsoon-heavy, dehumidifier demand'
        },
        {
            'id': 'coimbatore',
            'name': 'Coimbatore',
            'state': 'Tamil Nadu',
            'lat': 11.0168,
            'lon': 76.9558,
            'imd_station': 'COIMBATORE',
            'demand_zone': 'Manufacturing Hub',
            'zone_icon': '🏭',
            'zone_traits': 'Moderate climate, industrial demand, cost-sensitive'
        },
        {
            'id': 'visakhapatnam',
            'name': 'Visakhapatnam',
            'state': 'Andhra Pradesh',
            'lat': 17.6868,
            'lon': 83.2185,
            'imd_station': 'VISAKHAPATNAM',
            'demand_zone': 'Emerging Tier-2 Zone',
            'zone_icon': '📈',
            'zone_traits': 'Coastal emerging market, growing demand, tier-2 opportunity'
        }
    ]
