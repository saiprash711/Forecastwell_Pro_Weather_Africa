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
    
    # Tropical Coastal Special: Purple alert for hot humid nights
    TROPICAL_COASTAL_NIGHT_THRESHOLD = 24  # Tropical coastal cities with night temp ≥24°C
    TROPICAL_COASTAL_CITIES = ['lagos', 'abidjan', 'conakry', 'freetown', 'cotonou', 'lome', 'douala', 'libreville', 'luanda', 'mombasa', 'dar_es_salaam', 'mogadishu', 'port_louis', 'monrovia', 'accra']  # Cities eligible for tropical coastal special alert
    
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
    
    # African wet season typical dates (West Africa)
    MONSOON_ONSET = {'month': 6, 'day': 1, 'label': 'West African Rainy Season Onset'}
    MONSOON_WITHDRAWAL = {'month': 10, 'day': 1, 'label': 'Rainy Season Withdrawal'}
    
    # Refresh cadence
    REFRESH_WEATHER_HOURS = 24     # Daily weather refresh
    REFRESH_DEMAND_DAYS = 7        # Weekly demand forecast
    REFRESH_ACCURACY_DAYS = 30     # Monthly accuracy validation
    FORECAST_ACCURACY = 87         # Validated forecast accuracy %

    # Alert webhooks: list of URLs to POST JSON to when Amber/Red/Tropical Coastal special alerts are raised
    ALERT_WEBHOOK_URLS = []  # e.g. ['https://hooks.example.com/alerts']
    ALERT_WEBHOOK_HEADERS = {}  # optional additional headers
    ALERT_WEBHOOK_TIMEOUT = 5  # seconds per webhook request
    
    # Cities configuration - Major African cities by region
    CITIES = [
        # ---- North Africa ----
        {
            'id': 'cairo',
            'name': 'Cairo',
            'state': 'Egypt',
            'lat': 30.0444,
            'lon': 31.2357,
            'imd_station': 'CAIRO',
            'demand_zone': 'Saharan Arid Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Extreme dry heat, 40°C+ summers, very low humidity'
        },
        {
            'id': 'alexandria',
            'name': 'Alexandria',
            'state': 'Egypt',
            'lat': 31.2001,
            'lon': 29.9187,
            'imd_station': 'ALEXANDRIA',
            'demand_zone': 'Mediterranean Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Mediterranean coast, humid summers, major port city'
        },
        {
            'id': 'casablanca',
            'name': 'Casablanca',
            'state': 'Morocco',
            'lat': 33.5731,
            'lon': -7.5898,
            'imd_station': 'CASABLANCA',
            'demand_zone': 'Mediterranean Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Atlantic coast, mild climate, commercial capital'
        },
        {
            'id': 'algiers',
            'name': 'Algiers',
            'state': 'Algeria',
            'lat': 36.7538,
            'lon': 3.0588,
            'imd_station': 'ALGIERS',
            'demand_zone': 'Mediterranean Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Mediterranean climate, hot dry summers, coastal capital'
        },
        {
            'id': 'tunis',
            'name': 'Tunis',
            'state': 'Tunisia',
            'lat': 36.8065,
            'lon': 10.1815,
            'imd_station': 'TUNIS',
            'demand_zone': 'Mediterranean Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Mediterranean climate, warm summers, cultural hub'
        },
        {
            'id': 'tripoli',
            'name': 'Tripoli',
            'state': 'Libya',
            'lat': 32.8872,
            'lon': 13.1913,
            'imd_station': 'TRIPOLI',
            'demand_zone': 'Saharan Arid Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Arid coastal, hot dry summers, desert influence'
        },
        {
            'id': 'marrakech',
            'name': 'Marrakech',
            'state': 'Morocco',
            'lat': 31.6295,
            'lon': -7.9811,
            'imd_station': 'MARRAKECH',
            'demand_zone': 'Saharan Arid Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Semi-arid, extreme summer heat, tourist hub'
        },
        # ---- West Africa ----
        {
            'id': 'lagos',
            'name': 'Lagos',
            'state': 'Nigeria',
            'lat': 6.5244,
            'lon': 3.3792,
            'imd_station': 'LAGOS',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': "Africa's largest city, high humidity, year-round heat"
        },
        {
            'id': 'abuja',
            'name': 'Abuja',
            'state': 'Nigeria',
            'lat': 9.0765,
            'lon': 7.3986,
            'imd_station': 'ABUJA',
            'demand_zone': 'Savanna Zone',
            'zone_icon': '🌿',
            'zone_traits': 'Guinea savanna, hot dry season, federal capital'
        },
        {
            'id': 'kano',
            'name': 'Kano',
            'state': 'Nigeria',
            'lat': 12.0022,
            'lon': 8.5920,
            'imd_station': 'KANO',
            'demand_zone': 'Sahel Semi-Arid Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Sahel fringe, extreme dry heat, 42°C+ peaks'
        },
        {
            'id': 'ibadan',
            'name': 'Ibadan',
            'state': 'Nigeria',
            'lat': 7.3776,
            'lon': 3.9470,
            'imd_station': 'IBADAN',
            'demand_zone': 'Tropical Savanna Zone',
            'zone_icon': '🌿',
            'zone_traits': 'Tropical savanna, hot humid, growing commercial hub'
        },
        {
            'id': 'accra',
            'name': 'Accra',
            'state': 'Ghana',
            'lat': 5.6037,
            'lon': -0.1870,
            'imd_station': 'ACCRA',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Coastal Atlantic, hot year-round, economic hub'
        },
        {
            'id': 'abidjan',
            'name': 'Abidjan',
            'state': "Côte d'Ivoire",
            'lat': 5.3600,
            'lon': -4.0083,
            'imd_station': 'ABIDJAN',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Equatorial coast, high humidity, year-round warmth'
        },
        {
            'id': 'dakar',
            'name': 'Dakar',
            'state': 'Senegal',
            'lat': 14.7167,
            'lon': -17.4677,
            'imd_station': 'DAKAR',
            'demand_zone': 'Sahel Semi-Arid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Atlantic Sahel coast, hot dry season, regional hub'
        },
        {
            'id': 'bamako',
            'name': 'Bamako',
            'state': 'Mali',
            'lat': 12.6392,
            'lon': -8.0029,
            'imd_station': 'BAMAKO',
            'demand_zone': 'Sahel Semi-Arid Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Sahel, extreme dry heat, one of hottest capitals'
        },
        {
            'id': 'ouagadougou',
            'name': 'Ouagadougou',
            'state': 'Burkina Faso',
            'lat': 12.3647,
            'lon': -1.5332,
            'imd_station': 'OUAGADOUGOU',
            'demand_zone': 'Sahel Semi-Arid Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Sahel climate, 40°C+ dry season, landlocked capital'
        },
        {
            'id': 'conakry',
            'name': 'Conakry',
            'state': 'Guinea',
            'lat': 9.5370,
            'lon': -13.6773,
            'imd_station': 'CONAKRY',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Tropical coastal, extreme humidity, heavy rainfall'
        },
        {
            'id': 'freetown',
            'name': 'Freetown',
            'state': 'Sierra Leone',
            'lat': 8.4840,
            'lon': -13.2299,
            'imd_station': 'FREETOWN',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Tropical coast, one of wettest cities, hot and humid'
        },
        {
            'id': 'monrovia',
            'name': 'Monrovia',
            'state': 'Liberia',
            'lat': 6.3005,
            'lon': -10.7969,
            'imd_station': 'MONROVIA',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Equatorial coast, tropical humid, high rainfall'
        },
        {
            'id': 'cotonou',
            'name': 'Cotonou',
            'state': 'Benin',
            'lat': 6.3654,
            'lon': 2.4183,
            'imd_station': 'COTONOU',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Coastal tropical, hot humid, major port city'
        },
        {
            'id': 'lome',
            'name': 'Lomé',
            'state': 'Togo',
            'lat': 6.1228,
            'lon': 1.2255,
            'imd_station': 'LOME',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Atlantic coast, tropical humid, port capital'
        },
        {
            'id': 'niamey',
            'name': 'Niamey',
            'state': 'Niger',
            'lat': 13.5137,
            'lon': 2.1098,
            'imd_station': 'NIAMEY',
            'demand_zone': 'Sahel Semi-Arid Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Sahel, extreme 45°C+ heat, low humidity'
        },
        {
            'id': 'douala',
            'name': 'Douala',
            'state': 'Cameroon',
            'lat': 4.0511,
            'lon': 9.7679,
            'imd_station': 'DOUALA',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Equatorial coast, very high humidity, commercial hub'
        },
        {
            'id': 'ndjamena',
            'name': "N'Djamena",
            'state': 'Chad',
            'lat': 12.1048,
            'lon': 15.0445,
            'imd_station': 'NDJAMENA',
            'demand_zone': 'Sahel Semi-Arid Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Sahel, extreme dry heat 45°C+, low humidity capital'
        },
        # ---- Central Africa ----
        {
            'id': 'kinshasa',
            'name': 'Kinshasa',
            'state': 'DR Congo',
            'lat': -4.4419,
            'lon': 15.2663,
            'imd_station': 'KINSHASA',
            'demand_zone': 'Tropical Wet Zone',
            'zone_icon': '🌴',
            'zone_traits': 'Equatorial, hot and humid year-round, megacity'
        },
        {
            'id': 'brazzaville',
            'name': 'Brazzaville',
            'state': 'Congo',
            'lat': -4.2694,
            'lon': 15.2714,
            'imd_station': 'BRAZZAVILLE',
            'demand_zone': 'Tropical Wet Zone',
            'zone_icon': '🌴',
            'zone_traits': 'Equatorial, high humidity, twin city to Kinshasa'
        },
        {
            'id': 'yaounde',
            'name': 'Yaoundé',
            'state': 'Cameroon',
            'lat': 3.8480,
            'lon': 11.5021,
            'imd_station': 'YAOUNDE',
            'demand_zone': 'Tropical Wet Zone',
            'zone_icon': '🌴',
            'zone_traits': 'Equatorial highland, cooler than coast, political capital'
        },
        {
            'id': 'libreville',
            'name': 'Libreville',
            'state': 'Gabon',
            'lat': 0.3901,
            'lon': 9.4544,
            'imd_station': 'LIBREVILLE',
            'demand_zone': 'Tropical Wet Zone',
            'zone_icon': '🌴',
            'zone_traits': 'Equatorial Atlantic coast, high humidity, oil capital'
        },
        {
            'id': 'luanda',
            'name': 'Luanda',
            'state': 'Angola',
            'lat': -8.8368,
            'lon': 13.2343,
            'imd_station': 'LUANDA',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Atlantic coast, tropical, fastest growing African city'
        },
        # ---- East Africa ----
        {
            'id': 'nairobi',
            'name': 'Nairobi',
            'state': 'Kenya',
            'lat': -1.2921,
            'lon': 36.8219,
            'imd_station': 'NAIROBI',
            'demand_zone': 'Highland Moderate Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'High altitude, mild climate year-round, East Africa hub'
        },
        {
            'id': 'addis_ababa',
            'name': 'Addis Ababa',
            'state': 'Ethiopia',
            'lat': 8.9806,
            'lon': 38.7578,
            'imd_station': 'ADDIS ABABA',
            'demand_zone': 'Highland Moderate Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'High plateau, cool nights, largest highland city in Africa'
        },
        {
            'id': 'dar_es_salaam',
            'name': 'Dar es Salaam',
            'state': 'Tanzania',
            'lat': -6.7924,
            'lon': 39.2083,
            'imd_station': 'DAR ES SALAAM',
            'demand_zone': 'Subtropical Coastal Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Indian Ocean coast, tropical humid, major port'
        },
        {
            'id': 'kampala',
            'name': 'Kampala',
            'state': 'Uganda',
            'lat': 0.3476,
            'lon': 32.5825,
            'imd_station': 'KAMPALA',
            'demand_zone': 'Savanna Zone',
            'zone_icon': '🌿',
            'zone_traits': 'Equatorial highland, warm year-round, two rainy seasons'
        },
        {
            'id': 'khartoum',
            'name': 'Khartoum',
            'state': 'Sudan',
            'lat': 15.5007,
            'lon': 32.5599,
            'imd_station': 'KHARTOUM',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'Desert climate, one of hottest capitals, 45°C+ peaks'
        },
        {
            'id': 'mogadishu',
            'name': 'Mogadishu',
            'state': 'Somalia',
            'lat': 2.0469,
            'lon': 45.3182,
            'imd_station': 'MOGADISHU',
            'demand_zone': 'Coastal Humid Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Indian Ocean coast, hot tropical, semi-arid'
        },
        {
            'id': 'mombasa',
            'name': 'Mombasa',
            'state': 'Kenya',
            'lat': -4.0435,
            'lon': 39.6682,
            'imd_station': 'MOMBASA',
            'demand_zone': 'Subtropical Coastal Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Indian Ocean coast, tropical humid, major port'
        },
        {
            'id': 'asmara',
            'name': 'Asmara',
            'state': 'Eritrea',
            'lat': 15.3229,
            'lon': 38.9251,
            'imd_station': 'ASMARA',
            'demand_zone': 'Highland Moderate Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'High plateau, mild climate, unique highland capital'
        },
        {
            'id': 'djibouti',
            'name': 'Djibouti City',
            'state': 'Djibouti',
            'lat': 11.8251,
            'lon': 42.5903,
            'imd_station': 'DJIBOUTI',
            'demand_zone': 'Extreme Heat Zone',
            'zone_icon': '🔥',
            'zone_traits': 'One of the hottest cities on Earth, 45°C+ summers'
        },
        {
            'id': 'juba',
            'name': 'Juba',
            'state': 'South Sudan',
            'lat': 4.8594,
            'lon': 31.5713,
            'imd_station': 'JUBA',
            'demand_zone': 'Tropical Savanna Zone',
            'zone_icon': '🌿',
            'zone_traits': 'Tropical savanna, hot year-round, young capital city'
        },
        # ---- Southern Africa ----
        {
            'id': 'johannesburg',
            'name': 'Johannesburg',
            'state': 'South Africa',
            'lat': -26.2041,
            'lon': 28.0473,
            'imd_station': 'JOHANNESBURG',
            'demand_zone': 'Highland Moderate Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'Highveld plateau, warm summers, cool winters, economic hub'
        },
        {
            'id': 'cape_town',
            'name': 'Cape Town',
            'state': 'South Africa',
            'lat': -33.9249,
            'lon': 18.4241,
            'imd_station': 'CAPE TOWN',
            'demand_zone': 'Mediterranean Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Mediterranean climate, mild year-round, tourism capital'
        },
        {
            'id': 'durban',
            'name': 'Durban',
            'state': 'South Africa',
            'lat': -29.8587,
            'lon': 31.0218,
            'imd_station': 'DURBAN',
            'demand_zone': 'Subtropical Coastal Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Subtropical coast, humid, warm year-round, major port'
        },
        {
            'id': 'pretoria',
            'name': 'Pretoria',
            'state': 'South Africa',
            'lat': -25.7479,
            'lon': 28.2293,
            'imd_station': 'PRETORIA',
            'demand_zone': 'Highland Moderate Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'Highveld, warm summers, administrative capital'
        },
        {
            'id': 'harare',
            'name': 'Harare',
            'state': 'Zimbabwe',
            'lat': -17.8292,
            'lon': 31.0522,
            'imd_station': 'HARARE',
            'demand_zone': 'Highland Moderate Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'Subtropical highland, mild climate, Zimbabwe capital'
        },
        {
            'id': 'lusaka',
            'name': 'Lusaka',
            'state': 'Zambia',
            'lat': -15.3875,
            'lon': 28.3228,
            'imd_station': 'LUSAKA',
            'demand_zone': 'Savanna Zone',
            'zone_icon': '🌿',
            'zone_traits': 'Subtropical plateau, warm dry season, landlocked capital'
        },
        {
            'id': 'maputo',
            'name': 'Maputo',
            'state': 'Mozambique',
            'lat': -25.9692,
            'lon': 32.5732,
            'imd_station': 'MAPUTO',
            'demand_zone': 'Subtropical Coastal Zone',
            'zone_icon': '🌊',
            'zone_traits': 'Indian Ocean coast, subtropical, Mozambique capital'
        },
        {
            'id': 'antananarivo',
            'name': 'Antananarivo',
            'state': 'Madagascar',
            'lat': -18.8792,
            'lon': 47.5079,
            'imd_station': 'ANTANANARIVO',
            'demand_zone': 'Highland Moderate Zone',
            'zone_icon': '🏔️',
            'zone_traits': 'Central highland, mild climate, Indian Ocean island capital'
        },
        {
            'id': 'lilongwe',
            'name': 'Lilongwe',
            'state': 'Malawi',
            'lat': -13.9626,
            'lon': 33.7741,
            'imd_station': 'LILONGWE',
            'demand_zone': 'Savanna Zone',
            'zone_icon': '🌿',
            'zone_traits': 'Tropical highland, warm wet season, landlocked capital'
        },
        {
            'id': 'windhoek',
            'name': 'Windhoek',
            'state': 'Namibia',
            'lat': -22.5597,
            'lon': 17.0832,
            'imd_station': 'WINDHOEK',
            'demand_zone': 'Saharan Arid Zone',
            'zone_icon': '🏜️',
            'zone_traits': 'Semi-arid plateau, hot dry summers, cool nights'
        },
        {
            'id': 'gaborone',
            'name': 'Gaborone',
            'state': 'Botswana',
            'lat': -24.6282,
            'lon': 25.9231,
            'imd_station': 'GABORONE',
            'demand_zone': 'Savanna Zone',
            'zone_icon': '🌿',
            'zone_traits': 'Semi-arid savanna, hot summers, diamond-rich economy'
        },
        {
            'id': 'port_louis',
            'name': 'Port Louis',
            'state': 'Mauritius',
            'lat': -20.1609,
            'lon': 57.4989,
            'imd_station': 'PORT LOUIS',
            'demand_zone': 'Island Tropical Zone',
            'zone_icon': '🌴',
            'zone_traits': 'Tropical island, high humidity, Indian Ocean cyclone risk'
        },
    ]
