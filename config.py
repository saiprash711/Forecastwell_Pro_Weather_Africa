import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or os.urandom(32).hex()
    FLASK_APP = os.environ.get('FLASK_APP') or 'app.py'
    FLASK_ENV = os.environ.get('FLASK_ENV') or 'development'
    IMD_API_KEY = os.environ.get('IMD_API_KEY') or ''
    # OpenWeatherMap API (FREE - Get key from https://openweathermap.org/api)
    OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY') or ''
    
    # Supabase Configuration
    SUPABASE_URL = os.environ.get('SUPABASE_URL') or ''
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY') or ''
    
    PORT = int(os.environ.get('PORT', 5000))

    # Persist weather logs to Supabase? (default: false) — set to true only if you want server-side caching
    PERSIST_WEATHER_LOGS = os.environ.get('PERSIST_WEATHER_LOGS', 'false').lower() == 'true'

    
    # ---- Notification Configuration ----
    # Email (SMTP)
    EMAIL_ENABLED = os.environ.get('EMAIL_ENABLED', 'false').lower() == 'true'
    EMAIL_SMTP_SERVER = os.environ.get('EMAIL_SMTP_SERVER', 'smtp.gmail.com')
    EMAIL_SMTP_PORT = int(os.environ.get('EMAIL_SMTP_PORT', 587))
    EMAIL_SENDER = os.environ.get('EMAIL_SENDER', '')
    EMAIL_PASSWORD = os.environ.get('EMAIL_PASSWORD', '')
    EMAIL_RECIPIENTS = [r.strip() for r in os.environ.get('EMAIL_RECIPIENTS', '').split(',') if r.strip()]
    
    # SMS via Twilio
    SMS_ENABLED = os.environ.get('SMS_ENABLED', 'false').lower() == 'true'
    TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
    TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
    TWILIO_FROM_NUMBER = os.environ.get('TWILIO_FROM_NUMBER', '')
    SMS_RECIPIENTS = [r.strip() for r in os.environ.get('SMS_RECIPIENTS', '').split(',') if r.strip()]
    
    # WhatsApp via Twilio
    WHATSAPP_ENABLED = os.environ.get('WHATSAPP_ENABLED', 'false').lower() == 'true'
    WHATSAPP_FROM_NUMBER = os.environ.get('WHATSAPP_FROM_NUMBER', '')
    WHATSAPP_RECIPIENTS = [r.strip() for r in os.environ.get('WHATSAPP_RECIPIENTS', '').split(',') if r.strip()]
    
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
    KERALA_CITIES = ['kochi', 'thiruvananthapuram', 'kozhikode']  # Cities eligible for Kerala special alert
    
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
    
    # Cities configuration - Top 60 Indian cities by population/importance
    CITIES = [
        # ---- Mega Metros (Tier-1) ----
        {
            'id': 'mumbai',
            'name': 'Mumbai',
            'state': 'Maharashtra',
            'lat': 19.0760,
            'lon': 72.8777,
            'imd_station': 'MUMBAI',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'High humidity, warm nights, coastal metropolis'
        },
        {
            'id': 'delhi',
            'name': 'Delhi',
            'state': 'Delhi',
            'lat': 28.7041,
            'lon': 77.1025,
            'imd_station': 'DELHI',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Extreme summers, high AC penetration, peak demand May-Jul'
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
            'id': 'kolkata',
            'name': 'Kolkata',
            'state': 'West Bengal',
            'lat': 22.5726,
            'lon': 88.3639,
            'imd_station': 'KOLKATA',
            'demand_zone': 'Humid Heat Zone',
            'zone_icon': '💧',
            'zone_traits': 'High humidity with heat, prolonged summer, delta climate'
        },
        # ---- Major Metros (Tier-1) ----
        {
            'id': 'ahmedabad',
            'name': 'Ahmedabad',
            'state': 'Gujarat',
            'lat': 23.0225,
            'lon': 72.5714,
            'imd_station': 'AHMEDABAD',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Extreme dry heat, 45°C+ summers, high AC demand'
        },
        {
            'id': 'pune',
            'name': 'Pune',
            'state': 'Maharashtra',
            'lat': 18.5204,
            'lon': 73.8567,
            'imd_station': 'PUNE',
            'demand_zone': 'Moderate Plateau Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'Western Ghats influence, moderate climate, IT hub'
        },
        {
            'id': 'surat',
            'name': 'Surat',
            'state': 'Gujarat',
            'lat': 21.1702,
            'lon': 72.8311,
            'imd_station': 'SURAT',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Coastal heat, diamond/textile hub, growing demand'
        },
        {
            'id': 'jaipur',
            'name': 'Jaipur',
            'state': 'Rajasthan',
            'lat': 26.9124,
            'lon': 75.7873,
            'imd_station': 'JAIPUR',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Desert fringe, extreme dry heat, high diurnal range'
        },
        {
            'id': 'lucknow',
            'name': 'Lucknow',
            'state': 'Uttar Pradesh',
            'lat': 26.8467,
            'lon': 80.9462,
            'imd_station': 'LUCKNOW',
            'demand_zone': 'Indo-Gangetic Heat Zone',
            'zone_icon': '🌾',
            'zone_traits': 'Gangetic plain heat, humid summers, growing market'
        },
        {
            'id': 'kanpur',
            'name': 'Kanpur',
            'state': 'Uttar Pradesh',
            'lat': 26.4499,
            'lon': 80.3319,
            'imd_station': 'KANPUR',
            'demand_zone': 'Indo-Gangetic Heat Zone',
            'zone_icon': '🌾',
            'zone_traits': 'Industrial city, extreme summer heat, high demand'
        },
        {
            'id': 'nagpur',
            'name': 'Nagpur',
            'state': 'Maharashtra',
            'lat': 21.1458,
            'lon': 79.0882,
            'imd_station': 'NAGPUR',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Central India heat, one of hottest cities, 45°C+ peaks'
        },
        {
            'id': 'indore',
            'name': 'Indore',
            'state': 'Madhya Pradesh',
            'lat': 22.7196,
            'lon': 75.8577,
            'imd_station': 'INDORE',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Central plateau, hot dry summers, cleanest city'
        },
        {
            'id': 'bhopal',
            'name': 'Bhopal',
            'state': 'Madhya Pradesh',
            'lat': 23.2599,
            'lon': 77.4126,
            'imd_station': 'BHOPAL',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Lake city, central India heat, moderate humidity'
        },
        {
            'id': 'visakhapatnam',
            'name': 'Visakhapatnam',
            'state': 'Andhra Pradesh',
            'lat': 17.6868,
            'lon': 83.2185,
            'imd_station': 'VISAKHAPATNAM',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Coastal emerging market, growing demand, tier-2 opportunity'
        },
        {
            'id': 'patna',
            'name': 'Patna',
            'state': 'Bihar',
            'lat': 25.6093,
            'lon': 85.1376,
            'imd_station': 'PATNA',
            'demand_zone': 'Indo-Gangetic Heat Zone',
            'zone_icon': '🌾',
            'zone_traits': 'Gangetic plain, extreme heat + humidity combo'
        },
        {
            'id': 'vadodara',
            'name': 'Vadodara',
            'state': 'Gujarat',
            'lat': 22.3072,
            'lon': 73.1812,
            'imd_station': 'VADODARA',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Industrial hub, hot dry summers, growing market'
        },
        {
            'id': 'ghaziabad',
            'name': 'Ghaziabad',
            'state': 'Uttar Pradesh',
            'lat': 28.6692,
            'lon': 77.4538,
            'imd_station': 'NEW DELHI',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'NCR extension, extreme summers, high-density demand'
        },
        {
            'id': 'ludhiana',
            'name': 'Ludhiana',
            'state': 'Punjab',
            'lat': 30.9010,
            'lon': 75.8573,
            'imd_station': 'LUDHIANA',
            'demand_zone': 'North Plains Heat Zone',
            'zone_icon': '🌾',
            'zone_traits': 'Punjab plains, hot summers, industrial city'
        },
        {
            'id': 'agra',
            'name': 'Agra',
            'state': 'Uttar Pradesh',
            'lat': 27.1767,
            'lon': 78.0081,
            'imd_station': 'AGRA',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Semi-arid, extreme summer heat, tourism city'
        },
        {
            'id': 'nashik',
            'name': 'Nashik',
            'state': 'Maharashtra',
            'lat': 19.9975,
            'lon': 73.7898,
            'imd_station': 'NASHIK',
            'demand_zone': 'Moderate Plateau Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'Deccan plateau, moderate climate, wine capital'
        },
        # ---- Emerging Tier-2 Cities ----
        {
            'id': 'varanasi',
            'name': 'Varanasi',
            'state': 'Uttar Pradesh',
            'lat': 25.3176,
            'lon': 82.9739,
            'imd_station': 'VARANASI',
            'demand_zone': 'Indo-Gangetic Heat Zone',
            'zone_icon': '🌾',
            'zone_traits': 'Holy city, Gangetic heat, high humidity summers'
        },
        {
            'id': 'meerut',
            'name': 'Meerut',
            'state': 'Uttar Pradesh',
            'lat': 28.9845,
            'lon': 77.7064,
            'imd_station': 'MEERUT',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Western UP, extreme summers, growing market'
        },
        {
            'id': 'rajkot',
            'name': 'Rajkot',
            'state': 'Gujarat',
            'lat': 22.3039,
            'lon': 70.8022,
            'imd_station': 'RAJKOT',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Saurashtra region, hot dry climate, industrial hub'
        },
        {
            'id': 'madurai',
            'name': 'Madurai',
            'state': 'Tamil Nadu',
            'lat': 9.9252,
            'lon': 78.1198,
            'imd_station': 'MADURAI',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Interior Tamil Nadu, dry heat, temple city'
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
            'id': 'thiruvananthapuram',
            'name': 'Thiruvananthapuram',
            'state': 'Kerala',
            'lat': 8.5241,
            'lon': 76.9366,
            'imd_station': 'THIRUVANANTHAPURAM',
            'demand_zone': 'Tropical Wet Zone',
            'zone_icon': '🌴',
            'zone_traits': 'Tropical coast, year-round warmth, state capital'
        },
        {
            'id': 'kozhikode',
            'name': 'Kozhikode',
            'state': 'Kerala',
            'lat': 11.2588,
            'lon': 75.7804,
            'imd_station': 'KOZHIKODE',
            'demand_zone': 'Tropical Wet Zone',
            'zone_icon': '🌴',
            'zone_traits': 'Malabar coast, high humidity, monsoon-heavy'
        },
        {
            'id': 'chandigarh',
            'name': 'Chandigarh',
            'state': 'Chandigarh',
            'lat': 30.7333,
            'lon': 76.7794,
            'imd_station': 'CHANDIGARH',
            'demand_zone': 'North Plains Heat Zone',
            'zone_icon': '🏙️',
            'zone_traits': 'Planned city, hot summers, Shivalik foothills'
        },
        {
            'id': 'guwahati',
            'name': 'Guwahati',
            'state': 'Assam',
            'lat': 26.1445,
            'lon': 91.7362,
            'imd_station': 'GUWAHATI',
            'demand_zone': 'Humid Heat Zone',
            'zone_icon': '💧',
            'zone_traits': 'Northeast gateway, humid subtropical, Brahmaputra valley'
        },
        {
            'id': 'bhubaneswar',
            'name': 'Bhubaneswar',
            'state': 'Odisha',
            'lat': 20.2961,
            'lon': 85.8245,
            'imd_station': 'BHUBANESWAR',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Coastal Odisha, extreme heat + cyclone prone'
        },
        {
            'id': 'dehradun',
            'name': 'Dehradun',
            'state': 'Uttarakhand',
            'lat': 30.3165,
            'lon': 78.0322,
            'imd_station': 'DEHRADUN',
            'demand_zone': 'Moderate Plateau Zone',
            'zone_icon': '⛰️',
            'zone_traits': 'Himalayan foothills, moderate summers, hill capital'
        },
        {
            'id': 'ranchi',
            'name': 'Ranchi',
            'state': 'Jharkhand',
            'lat': 23.3441,
            'lon': 85.3096,
            'imd_station': 'RANCHI',
            'demand_zone': 'Moderate Plateau Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'Chota Nagpur plateau, moderate summers, mining hub'
        },
        {
            'id': 'raipur',
            'name': 'Raipur',
            'state': 'Chhattisgarh',
            'lat': 21.2514,
            'lon': 81.6296,
            'imd_station': 'RAIPUR',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Central India, hot summers, steel and power hub'
        },
        {
            'id': 'vijayawada',
            'name': 'Vijayawada',
            'state': 'Andhra Pradesh',
            'lat': 16.5062,
            'lon': 80.6480,
            'imd_station': 'VIJAYAWADA',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Krishna delta, hot + humid, AP commercial hub'
        },
        {
            'id': 'jodhpur',
            'name': 'Jodhpur',
            'state': 'Rajasthan',
            'lat': 26.2389,
            'lon': 73.0243,
            'imd_station': 'JODHPUR',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Thar Desert edge, extreme dry heat, 48°C+ peaks'
        },
        {
            'id': 'amritsar',
            'name': 'Amritsar',
            'state': 'Punjab',
            'lat': 31.6340,
            'lon': 74.8723,
            'imd_station': 'AMRITSAR',
            'demand_zone': 'North Plains Heat Zone',
            'zone_icon': '🌾',
            'zone_traits': 'Punjab plains, scorching summers, border city'
        },
        {
            'id': 'allahabad',
            'name': 'Prayagraj',
            'state': 'Uttar Pradesh',
            'lat': 25.4358,
            'lon': 81.8463,
            'imd_station': 'ALLAHABAD',
            'demand_zone': 'Indo-Gangetic Heat Zone',
            'zone_icon': '🌾',
            'zone_traits': 'Confluence city, extreme summer heat + humidity'
        },
        {
            'id': 'gwalior',
            'name': 'Gwalior',
            'state': 'Madhya Pradesh',
            'lat': 26.2183,
            'lon': 78.1828,
            'imd_station': 'GWALIOR',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'North-central India, extreme summers, historical city'
        },
        {
            'id': 'jabalpur',
            'name': 'Jabalpur',
            'state': 'Madhya Pradesh',
            'lat': 23.1815,
            'lon': 79.9864,
            'imd_station': 'JABALPUR',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Central India, hot summers, marble rocks city'
        },
        {
            'id': 'noida',
            'name': 'Noida',
            'state': 'Uttar Pradesh',
            'lat': 28.5355,
            'lon': 77.3910,
            'imd_station': 'NEW DELHI',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'NCR hub, extreme summers, IT/corporate demand'
        },
        {
            'id': 'gurugram',
            'name': 'Gurugram',
            'state': 'Haryana',
            'lat': 28.4595,
            'lon': 77.0266,
            'imd_station': 'NEW DELHI',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Millennium city, corporate hub, extreme heat'
        },
        {
            'id': 'tiruchirappalli',
            'name': 'Tiruchirappalli',
            'state': 'Tamil Nadu',
            'lat': 10.7905,
            'lon': 78.7047,
            'imd_station': 'TIRUCHIRAPPALLI',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Interior Tamil Nadu, hot dry climate, temple city'
        },
        {
            'id': 'salem',
            'name': 'Salem',
            'state': 'Tamil Nadu',
            'lat': 11.6643,
            'lon': 78.1460,
            'imd_station': 'SALEM',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Interior TN, steel city, hot dry summers'
        },
        {
            'id': 'mangalore',
            'name': 'Mangalore',
            'state': 'Karnataka',
            'lat': 12.9141,
            'lon': 74.8560,
            'imd_station': 'MANGALORE',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Coastal Karnataka, humid, heavy monsoon'
        },
        {
            'id': 'mysore',
            'name': 'Mysore',
            'state': 'Karnataka',
            'lat': 12.2958,
            'lon': 76.6394,
            'imd_station': 'MYSORE',
            'demand_zone': 'Moderate Plateau Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'Deccan plateau, pleasant climate, heritage city'
        },
        {
            'id': 'hubli',
            'name': 'Hubli-Dharwad',
            'state': 'Karnataka',
            'lat': 15.3647,
            'lon': 75.1240,
            'imd_station': 'HUBLI',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'North Karnataka, dry heat, commercial hub'
        },
        {
            'id': 'aurangabad',
            'name': 'Chhatrapati Sambhajinagar',
            'state': 'Maharashtra',
            'lat': 19.8762,
            'lon': 75.3433,
            'imd_station': 'AURANGABAD',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Deccan plateau, hot dry summers, heritage tourism'
        },
        {
            'id': 'solapur',
            'name': 'Solapur',
            'state': 'Maharashtra',
            'lat': 17.6599,
            'lon': 75.9064,
            'imd_station': 'SOLAPUR',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Rain shadow region, semi-arid, textile hub'
        },
        {
            'id': 'thane',
            'name': 'Thane',
            'state': 'Maharashtra',
            'lat': 19.2183,
            'lon': 72.9781,
            'imd_station': 'MUMBAI',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Mumbai satellite, humid coastal, high residential demand'
        },
        {
            'id': 'navi_mumbai',
            'name': 'Navi Mumbai',
            'state': 'Maharashtra',
            'lat': 19.0330,
            'lon': 73.0297,
            'imd_station': 'MUMBAI',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Planned city, coastal humid, growing IT hub'
        },
        {
            'id': 'warangal',
            'name': 'Warangal',
            'state': 'Telangana',
            'lat': 17.9784,
            'lon': 79.5941,
            'imd_station': 'HYDERABAD',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Deccan interior, hot dry climate, heritage city'
        },
        {
            'id': 'jammu',
            'name': 'Jammu',
            'state': 'Jammu & Kashmir',
            'lat': 32.7266,
            'lon': 74.8570,
            'imd_station': 'JAMMU',
            'demand_zone': 'North Plains Heat Zone',
            'zone_icon': '⛰️',
            'zone_traits': 'Shivalik foothills, extremely hot summers, winter capital'
        },
        {
            'id': 'cuttack',
            'name': 'Cuttack',
            'state': 'Odisha',
            'lat': 20.4625,
            'lon': 85.8830,
            'imd_station': 'CUTTACK',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Mahanadi delta, hot humid, cyclone-prone'
        },
        {
            'id': 'udaipur',
            'name': 'Udaipur',
            'state': 'Rajasthan',
            'lat': 24.5854,
            'lon': 73.7125,
            'imd_station': 'UDAIPUR',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Aravalli range, hot summers, lake city'
        },
        {
            'id': 'kota',
            'name': 'Kota',
            'state': 'Rajasthan',
            'lat': 25.2138,
            'lon': 75.8648,
            'imd_station': 'KOTA',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'SE Rajasthan, extreme heat, coaching hub'
        },
        {
            'id': 'bareilly',
            'name': 'Bareilly',
            'state': 'Uttar Pradesh',
            'lat': 28.3670,
            'lon': 79.4304,
            'imd_station': 'BAREILLY',
            'demand_zone': 'Indo-Gangetic Heat Zone',
            'zone_icon': '🌾',
            'zone_traits': 'Rohilkhand region, hot humid summers'
        },
        {
            'id': 'guntur',
            'name': 'Guntur',
            'state': 'Andhra Pradesh',
            'lat': 16.3067,
            'lon': 80.4365,
            'imd_station': 'GUNTUR',
            'demand_zone': 'Dry Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'AP interior, extreme heat, chili capital'
        },
    ]
