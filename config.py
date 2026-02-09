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
    
    # Cities configuration - South India focus
    CITIES = [
        {
            'id': 'chennai',
            'name': 'Chennai',
            'state': 'Tamil Nadu',
            'lat': 13.0827,
            'lon': 80.2707,
            'imd_station': 'CHENNAI'
        },
        {
            'id': 'bangalore',
            'name': 'Bangalore',
            'state': 'Karnataka',
            'lat': 12.9716,
            'lon': 77.5946,
            'imd_station': 'BANGALORE'
        },
        {
            'id': 'hyderabad',
            'name': 'Hyderabad',
            'state': 'Telangana',
            'lat': 17.3850,
            'lon': 78.4867,
            'imd_station': 'HYDERABAD'
        },
        {
            'id': 'kochi',
            'name': 'Kochi',
            'state': 'Kerala',
            'lat': 9.9312,
            'lon': 76.2673,
            'imd_station': 'KOCHI'
        },
        {
            'id': 'coimbatore',
            'name': 'Coimbatore',
            'state': 'Tamil Nadu',
            'lat': 11.0168,
            'lon': 76.9558,
            'imd_station': 'COIMBATORE'
        },
        {
            'id': 'visakhapatnam',
            'name': 'Visakhapatnam',
            'state': 'Andhra Pradesh',
            'lat': 17.6868,
            'lon': 83.2185,
            'imd_station': 'VISAKHAPATNAM'
        },
        {
            'id': 'madurai',
            'name': 'Madurai',
            'state': 'Tamil Nadu',
            'lat': 9.9252,
            'lon': 78.1198,
            'imd_station': 'MADURAI'
        },
        {
            'id': 'vijayawada',
            'name': 'Vijayawada',
            'state': 'Andhra Pradesh',
            'lat': 16.5062,
            'lon': 80.6480,
            'imd_station': 'VIJAYAWADA'
        }
    ]
