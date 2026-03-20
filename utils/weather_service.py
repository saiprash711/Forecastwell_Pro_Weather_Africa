"""
Weather Service Module
Handles IMD data integration and weather data processing
"""
import requests
import random
import time
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from config import Config

# Global variable to hold imported Excel data
EXCEL_IMPORTED_DATA = None

def _create_retry_session(retries=2, backoff_factor=1.0, status_forcelist=(500, 502, 503, 504)):
    """
    Create a requests session with automatic retry and exponential backoff.
    Note: 429 (rate limit) is NOT in status_forcelist - we handle it separately with longer delays.
    """
    session = requests.Session()
    retry = Retry(
        total=retries,
        read=retries,
        connect=retries,
        backoff_factor=backoff_factor,
        status_forcelist=status_forcelist,
        allowed_methods=['GET'],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount('https://', adapter)
    session.mount('http://', adapter)
    return session

# Global session for connection pooling and retries
_SHARED_SESSION = _create_retry_session()

def _get_session():
    return _SHARED_SESSION

class WeatherService:
    """Service for fetching and processing weather data from IMD"""
    
    def __init__(self):
        self.imd_api_key = Config.IMD_API_KEY
        self.openweather_api_key = Config.OPENWEATHER_API_KEY
        self.imd_base_url = "https://api.imd.gov.in/v1"  # IMD API endpoint
        self.openweather_base_url = "https://api.openweathermap.org/data/2.5"  # OpenWeatherMap API
        self.openmeteo_base_url = "https://api.open-meteo.com/v1"  # Open-Meteo (FREE, no key needed!)
        self.openmeteo_seasonal_url = "https://seasonal-api.open-meteo.com/v1/seasonal"  # Seasonal forecast (up to 7 months!)
        
    def get_current_weather(self, city_id):
        """
        Get current weather data for a specific city using ONLY Open-Meteo API.
        No Excel, OpenWeatherMap, or IMD fallback.
        """
        city = self._get_city_config(city_id)
        if not city:
            return None

        # Only use Open-Meteo API
        weather_data = self._fetch_openmeteo_current(city)
        if weather_data:
            return weather_data

        # If Open-Meteo fails, raise error
        raise Exception(f"Weather API unavailable for city {city['name']} (Open-Meteo failed)")
    
    def get_forecast(self, city_id, days=7):
        """
        Get temperature forecast for a city from Open-Meteo API
        
        Args:
            city_id: City identifier
            days: Number of days to forecast
                  - Up to 16 days: Uses standard Open-Meteo forecast API
                  - Up to 210 days (~7 months): Uses Open-Meteo Seasonal Forecast API
            
        Returns:
            list: Forecast data from API
        """
        city = self._get_city_config(city_id)
        if not city:
            return []
        
        # For short-term forecasts (up to 16 days), use standard forecast API
        if days <= 16:
            forecast = self._fetch_openmeteo_forecast(city, days)
            if forecast:
                return forecast
        else:
            # Try Seasonal Forecast API first; fall back to standard API + climate extension
            try:
                forecast = self._fetch_openmeteo_seasonal_forecast(city, days)
                if forecast:
                    return forecast
            except Exception:
                pass

            # Fallback: 16-day standard forecast extended with climate normals
            base = self._fetch_openmeteo_forecast(city, 16)
            if base:
                return self._extend_with_climate_normals(base, days)

        # CRITICAL: API failed - raise error instead of returning empty list
        raise Exception(f"Forecast API failed for {city['name']}")
    
    def _fetch_openmeteo_seasonal_forecast(self, city, days):
        """
        Fetch long-range seasonal forecast from Open-Meteo Seasonal Forecast API
        FREE - No API key required!
        Provides up to 7 months (210 days) forecast using ECMWF SEAS5 model
        """
        try:
            # Calculate forecast months needed (4 months = ~120 days)
            forecast_days = min(days, 210)  # Max 7 months (210 days)
            
            params = {
                'latitude': city['lat'],
                'longitude': city['lon'],
                'daily': 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_max',
                'timezone': 'Asia/Kolkata',
                'forecast_days': forecast_days
            }
            
            # Use retry session
            response = _get_session().get(
                self.openmeteo_seasonal_url,
                params=params,
                timeout=30  # Longer timeout for seasonal data
            )
            
            if response.status_code == 200:
                data = response.json()
                daily = data.get('daily', {})
                
                if not daily or 'time' not in daily:
                    print(f"Seasonal API returned no daily data")
                    return None
                
                forecast = []
                for i, date_str in enumerate(daily['time']):
                    date = datetime.strptime(date_str, '%Y-%m-%d')
                    
                    # Get temperature values (may be None for some ensemble members)
                    day_temp = daily.get('temperature_2m_max', [None])[i] if i < len(daily.get('temperature_2m_max', [])) else None
                    night_temp = daily.get('temperature_2m_min', [None])[i] if i < len(daily.get('temperature_2m_min', [])) else None
                    
                    # Skip days with no data
                    if day_temp is None or night_temp is None:
                        continue
                    
                    humidity = daily.get('relative_humidity_2m_mean', [65])[i] if i < len(daily.get('relative_humidity_2m_mean', [])) else 65
                    wind = daily.get('wind_speed_10m_max', [10])[i] if i < len(daily.get('wind_speed_10m_max', [])) else 10
                    
                    forecast.append({
                        'date': date_str,
                        'day': date.strftime('%A'),
                        'temperature': round((day_temp + night_temp) / 2, 1),
                        'day_temp': round(day_temp, 1),
                        'night_temp': round(night_temp, 1),
                        'min_temp': round(night_temp, 1),
                        'max_temp': round(day_temp, 1),
                        'humidity': round(humidity, 1) if humidity else 65,
                        'wind_speed': round(wind, 1) if wind else 10,
                        'source': 'Open-Meteo Seasonal (ECMWF SEAS5)',
                        'is_forecast': True
                    })
                
                if forecast:
                    # Extend with climate normal estimates if more days requested than API provides
                    if days > len(forecast):
                        from datetime import timedelta
                        # India-wide monthly climate normals (day_temp, night_temp)
                        monthly_climate = {
                            1: (29, 15), 2: (32, 17), 3: (36, 21), 4: (39, 25),
                            5: (41, 27), 6: (36, 25), 7: (32, 24), 8: (32, 23),
                            9: (33, 23), 10: (33, 21), 11: (30, 17), 12: (28, 14)
                        }
                        last_date = datetime.strptime(forecast[-1]['date'], '%Y-%m-%d')
                        for i in range(1, days - len(forecast) + 1):
                            extra_date = last_date + timedelta(days=i)
                            m = extra_date.month
                            avg_day, avg_night = monthly_climate.get(m, (32, 22))
                            forecast.append({
                                'date': extra_date.strftime('%Y-%m-%d'),
                                'day': extra_date.strftime('%A'),
                                'temperature': round((avg_day + avg_night) / 2, 1),
                                'day_temp': round(float(avg_day), 1),
                                'night_temp': round(float(avg_night), 1),
                                'min_temp': round(float(avg_night), 1),
                                'max_temp': round(float(avg_day), 1),
                                'humidity': 65,
                                'wind_speed': 10,
                                'source': 'Climate Normal Estimate',
                                'is_forecast': True,
                                'is_climate_estimate': True
                            })
                    return forecast
                else:
                    raise Exception("Seasonal API returned no daily data")
            elif response.status_code == 429:
                # Rate limit - raise error instead of returning None
                raise Exception("API rate limit exceeded - too many requests")
            else:
                # Suppress verbose error logging
                raise Exception(f"Seasonal API returned status code {response.status_code}")
                
        except Exception as e:
            error_str = str(e)
            # Suppress verbose logging for rate limit errors
            if '429' not in error_str and 'too many' not in error_str.lower():
                pass  # Log other errors if needed
            raise
    
    def _extend_with_climate_normals(self, forecast, target_days):
        """Extend a forecast list to target_days using India-wide monthly climate normals."""
        monthly_climate = {
            1: (29, 15), 2: (32, 17), 3: (36, 21), 4: (39, 25),
            5: (41, 27), 6: (36, 25), 7: (32, 24), 8: (32, 23),
            9: (33, 23), 10: (33, 21), 11: (30, 17), 12: (28, 14)
        }
        last_date = datetime.strptime(forecast[-1]['date'], '%Y-%m-%d')
        for i in range(1, target_days - len(forecast) + 1):
            extra_date = last_date + timedelta(days=i)
            m = extra_date.month
            avg_day, avg_night = monthly_climate.get(m, (32, 22))
            forecast.append({
                'date': extra_date.strftime('%Y-%m-%d'),
                'day': extra_date.strftime('%A'),
                'temperature': round((avg_day + avg_night) / 2, 1),
                'day_temp': round(float(avg_day), 1),
                'night_temp': round(float(avg_night), 1),
                'min_temp': round(float(avg_night), 1),
                'max_temp': round(float(avg_day), 1),
                'humidity': 65,
                'wind_speed': 10,
                'source': 'Climate Normal Estimate',
                'is_forecast': True,
                'is_climate_estimate': True
            })
        return forecast

    def _fetch_openmeteo_forecast(self, city, days):
        """
        Fetch forecast from Open-Meteo API
        FREE - No API key required!
        """
        try:
            params = {
                'latitude': city['lat'],
                'longitude': city['lon'],
                'daily': 'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_mean,wind_speed_10m_max',
                'timezone': 'Asia/Kolkata',
                'forecast_days': days
            }
            
            # Use retry session
            response = _get_session().get(
                f"{self.openmeteo_base_url}/forecast",
                params=params,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                daily = data['daily']
                
                forecast = []
                for i, date_str in enumerate(daily['time']):
                    date = datetime.strptime(date_str, '%Y-%m-%d')
                    day_temp = daily['temperature_2m_max'][i]
                    night_temp = daily['temperature_2m_min'][i]
                    
                    forecast.append({
                        'date': date_str,
                        'day': date.strftime('%A'),
                        'temperature': round((day_temp + night_temp) / 2, 1),
                        'day_temp': round(day_temp, 1),
                        'night_temp': round(night_temp, 1),
                        'min_temp': round(night_temp, 1),
                        'max_temp': round(day_temp, 1),
                        'humidity': round(daily['relative_humidity_2m_mean'][i], 1) if daily.get('relative_humidity_2m_mean') else 65,
                        'wind_speed': round(daily['wind_speed_10m_max'][i], 1) if daily.get('wind_speed_10m_max') else 10,
                        'source': 'Open-Meteo API',
                        'is_forecast': True
                    })
                
                return forecast
            elif response.status_code == 429:
                # Rate limit - raise error instead of returning None
                raise Exception("API rate limit exceeded - too many requests")
            else:
                # Only log non-429 errors if needed
                raise Exception(f"API returned status code {response.status_code}")
                
        except Exception as e:
            error_str = str(e)
            # Suppress verbose logging for rate limit errors
            if '429' not in error_str and 'too many' not in error_str.lower():
                pass  # Log other errors if needed
            raise
    
    def _generate_fallback_forecast(self, city_id, days):
        """Fallback forecast generation if API fails - now raises error instead of simulating"""
        raise Exception("Forecast API unavailable - cannot generate simulated data")
    
    def get_historical_data(self, city_id, days=30):
        """
        Get historical temperature data from Open-Meteo Archive API
        
        Args:
            city_id: City identifier
            days: Number of past days
            
        Returns:
            list: Historical data from API
        """
        city = self._get_city_config(city_id)
        if not city:
            return []
        
        # Try Open-Meteo Archive API (FREE historical data!)
        historical = self._fetch_openmeteo_historical(city, days)
        if historical:
            return historical
        
        # CRITICAL: API failed - raise error instead of returning empty list
        raise Exception(f"Historical API failed for {city['name']}")
    
    def _fetch_openmeteo_historical(self, city, days):
        """
        Fetch historical data from Open-Meteo Archive API
        FREE - No API key required!
        """
        try:
            end_date = datetime.now() - timedelta(days=1)  # Yesterday
            start_date = end_date - timedelta(days=days)
            
            params = {
                'latitude': city['lat'],
                'longitude': city['lon'],
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'daily': 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,relative_humidity_2m_mean',
                'timezone': 'Asia/Kolkata'
            }
            
            # Use retry session
            response = _get_session().get(
                "https://archive-api.open-meteo.com/v1/archive",
                params=params,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                daily = data['daily']
                
                historical = []
                for i, date_str in enumerate(daily['time']):
                    day_temp = daily['temperature_2m_max'][i]
                    night_temp = daily['temperature_2m_min'][i]
                    mean_temp = daily['temperature_2m_mean'][i] if daily.get('temperature_2m_mean') else (day_temp + night_temp) / 2
                    
                    historical.append({
                        'date': date_str,
                        'temperature': round(mean_temp, 1),
                        'day_temp': round(day_temp, 1),
                        'night_temp': round(night_temp, 1),
                        'min_temp': round(night_temp, 1),
                        'max_temp': round(day_temp, 1),
                        'humidity': round(daily['relative_humidity_2m_mean'][i], 1) if daily.get('relative_humidity_2m_mean') else 65,
                        'source': 'Open-Meteo Archive'
                    })
                
                return historical
            elif response.status_code == 429:
                # Rate limit - raise error instead of returning None
                raise Exception("API rate limit exceeded - too many requests")
            else:
                # Suppress verbose error logging
                raise Exception(f"Historical API returned status code {response.status_code}")
                
        except Exception as e:
            error_str = str(e)
            # Suppress verbose logging for rate limit errors
            if '429' not in error_str and 'too many' not in error_str.lower():
                pass  # Log other errors if needed
            raise
    
    def _generate_fallback_historical(self, city_id, days):
        """Fallback historical data if API fails - now raises error instead of simulating"""
        raise Exception("Historical API unavailable - cannot generate simulated data")
    
    def get_monthly_averages(self, city_id, year):
        """
        Get monthly temperature averages for a specific year from Open-Meteo Archive API
        OPTIMIZED: Fetches entire year's data in a single API call
        
        Args:
            city_id: City identifier
            year: Year to get data for (e.g., 2024, 2025)
            
        Returns:
            list: Monthly averages with day/night temps
        """
        city = self._get_city_config(city_id)
        if not city:
            return []
        
        current_date = datetime.now()
        current_year = current_date.year
        current_month = current_date.month
        
        # For future years, return empty data
        if year > current_year:
            return [{
                'month': month,
                'month_name': datetime(year, month, 1).strftime('%b'),
                'avg_day_temp': None,
                'avg_night_temp': None,
                'source': None,
                'is_forecast': False
            } for month in range(1, 13)]
        
        # Calculate date range for the year
        start_date = f"{year}-01-01"
        if year == current_year:
            # For current year, fetch up to yesterday
            end_date = (current_date - timedelta(days=1)).strftime('%Y-%m-%d')
        else:
            end_date = f"{year}-12-31"
        
        # Fetch entire year's data in ONE API call
        try:
            params = {
                'latitude': city['lat'],
                'longitude': city['lon'],
                'start_date': start_date,
                'end_date': end_date,
                'daily': 'temperature_2m_max,temperature_2m_min',
                'timezone': 'Asia/Kolkata'
            }
            
            # Use retry session
            response = _get_session().get(
                "https://archive-api.open-meteo.com/v1/archive",
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                daily = data.get('daily', {})
                
                if not daily or 'time' not in daily:
                    return [] # No data
                
                # Group data by month
                monthly_temps = {}
                for i, date_str in enumerate(daily['time']):
                    month = int(date_str.split('-')[1])
                    if month not in monthly_temps:
                        monthly_temps[month] = {'day_temps': [], 'night_temps': []}
                    
                    day_temp = daily['temperature_2m_max'][i]
                    night_temp = daily['temperature_2m_min'][i]
                    
                    if day_temp is not None:
                        monthly_temps[month]['day_temps'].append(day_temp)
                    if night_temp is not None:
                        monthly_temps[month]['night_temps'].append(night_temp)
                
                # Build monthly data
                monthly_data = []
                for month in range(1, 13):
                    if year == current_year and month > current_month:
                        # Future month in current year
                        monthly_data.append({
                            'month': month,
                            'month_name': datetime(year, month, 1).strftime('%b'),
                            'avg_day_temp': None,
                            'avg_night_temp': None,
                            'source': None,
                            'is_forecast': False
                        })
                    elif month in monthly_temps and monthly_temps[month]['day_temps']:
                        temps = monthly_temps[month]
                        monthly_data.append({
                            'month': month,
                            'month_name': datetime(year, month, 1).strftime('%b'),
                            'avg_day_temp': round(sum(temps['day_temps']) / len(temps['day_temps']), 1),
                            'avg_night_temp': round(sum(temps['night_temps']) / len(temps['night_temps']), 1),
                            'source': 'Open-Meteo Archive',
                            'is_forecast': False
                        })
                    else:
                        monthly_data.append({
                            'month': month,
                            'month_name': datetime(year, month, 1).strftime('%b'),
                            'avg_day_temp': None,
                            'avg_night_temp': None,
                            'source': None,
                            'is_forecast': False
                        })
                
                return monthly_data
            else:
                raise Exception(f"Open-Meteo Archive API Error for {year}: {response.status_code}")
                
        except Exception as e:
            raise Exception(f"Error fetching yearly data for {year}: {str(e)}")
    
    def _generate_fallback_monthly(self, year, current_year, current_month):
        """Generate fallback monthly data when API fails - now raises error instead of simulating"""
        raise Exception("Monthly data API unavailable - cannot generate simulated data")
    
    def get_all_cities_current(self):
        """
        Get current weather for all configured cities using Open-Meteo batch API.
        OPTIMIZED: Single HTTP request for all 60 cities instead of 60 individual calls.
        Open-Meteo supports comma-separated lat/lon for multi-location queries.
        Falls back to parallel individual calls if batch fails.
        """
        cities = Config.CITIES
        t_start = time.time()

        # Try batch API first (single request for all cities)
        cities_data = self._fetch_batch_current(cities)

        if cities_data and len(cities_data) >= len(cities) * 0.5:
            elapsed = time.time() - t_start
            print(f"[Weather] Batch fetched {len(cities_data)}/{len(cities)} cities in {elapsed:.1f}s")
            return cities_data

        # Fallback: parallel individual calls if batch failed
        print("[Weather] Batch failed, falling back to parallel individual calls...")
        cities_data = []

        def fetch_city(city):
            try:
                time.sleep(random.uniform(0.02, 0.08))
                data = self.get_current_weather(city['id'])
                if data:
                    data['lat'] = city['lat']
                    data['lon'] = city['lon']
                return data
            except Exception:
                return None

        with ThreadPoolExecutor(max_workers=15) as executor:
            future_to_city = {executor.submit(fetch_city, city): city for city in cities}
            for future in as_completed(future_to_city, timeout=90):
                try:
                    data = future.result(timeout=15)
                    if data:
                        cities_data.append(data)
                except Exception:
                    continue

        elapsed = time.time() - t_start
        print(f"[Weather] Fallback fetched {len(cities_data)}/{len(cities)} cities in {elapsed:.1f}s")
        return cities_data

    def _fetch_batch_current(self, cities):
        """
        Fetch current weather for multiple cities in a single Open-Meteo API call.
        Open-Meteo supports comma-separated latitude/longitude for batch queries.
        Returns list of city weather dicts, or None on failure.
        """
        try:
            # Build comma-separated lat/lon strings
            lats = ','.join(str(c['lat']) for c in cities)
            lons = ','.join(str(c['lon']) for c in cities)

            params = {
                'latitude': lats,
                'longitude': lons,
                'current': 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m',
                'daily': 'temperature_2m_max,temperature_2m_min',
                'timezone': 'Asia/Kolkata',
                'forecast_days': 1
            }

            response = _get_session().get(
                f"{self.openmeteo_base_url}/forecast",
                params=params,
                timeout=30
            )

            if response.status_code != 200:
                print(f"[Weather] Batch API returned {response.status_code}")
                return None

            results = response.json()

            # Single city returns a dict, multiple cities returns a list
            if isinstance(results, dict) and 'current' in results:
                # Single result — wrap in list
                results = [results]

            if not isinstance(results, list):
                print(f"[Weather] Unexpected batch response type: {type(results)}")
                return None

            cities_data = []
            for i, data in enumerate(results):
                if i >= len(cities):
                    break
                city = cities[i]
                try:
                    current = data.get('current', {})
                    daily = data.get('daily', {})

                    if not current or not daily:
                        continue

                    current_temp = current.get('temperature_2m')
                    day_temp = daily.get('temperature_2m_max', [None])[0]
                    night_temp = daily.get('temperature_2m_min', [None])[0]

                    if current_temp is None:
                        continue

                    cities_data.append({
                        'city_id': city['id'],
                        'city_name': city['name'],
                        'state': city['state'],
                        'lat': city['lat'],
                        'lon': city['lon'],
                        'temperature': round(current_temp, 1),
                        'day_temp': round(day_temp, 1) if day_temp is not None else round(current_temp + 2, 1),
                        'night_temp': round(night_temp, 1) if night_temp is not None else round(current_temp - 5, 1),
                        'humidity': round(current.get('relative_humidity_2m', 60), 1),
                        'feels_like': round(current.get('apparent_temperature', current_temp), 1),
                        'wind_speed': round(current.get('wind_speed_10m', 0), 1),
                        'timestamp': datetime.now().isoformat(),
                        'source': 'Open-Meteo'
                    })
                except Exception as e:
                    print(f"[Weather] Batch parse error for {city['name']}: {e}")
                    continue

            return cities_data if cities_data else None

        except Exception as e:
            print(f"[Weather] Batch API error: {e}")
            return None
    
    def _get_city_config(self, city_id):
        """Get city configuration by ID"""
        for city in Config.CITIES:
            if city['id'] == city_id:
                return city
        return None

    def get_daily_temp(self, city_id, date_str):
        """
        Get temperature for a specific date from Open-Meteo Archive API.
        Uses the shared retry session for reliability.

        Args:
            city_id: City identifier
            date_str: Date in YYYY-MM-DD format (must be a past date)

        Returns:
            dict with avg_temp, day_temp, night_temp or None on failure
        """
        city = self._get_city_config(city_id)
        if not city:
            return None
        try:
            params = {
                'latitude': city['lat'],
                'longitude': city['lon'],
                'start_date': date_str,
                'end_date': date_str,
                'daily': 'temperature_2m_max,temperature_2m_min,temperature_2m_mean',
                'timezone': 'Asia/Kolkata'
            }
            response = _get_session().get(
                "https://archive-api.open-meteo.com/v1/archive",
                params=params,
                timeout=20
            )
            if response.status_code == 200:
                data = response.json()
                daily = data.get('daily', {})
                if daily.get('time'):
                    day_t = daily['temperature_2m_max'][0]
                    night_t = daily['temperature_2m_min'][0]
                    mean_t = (daily.get('temperature_2m_mean') or [None])[0]
                    if mean_t is None and day_t is not None and night_t is not None:
                        mean_t = (day_t + night_t) / 2
                    return {
                        'avg_temp': round(mean_t, 1) if mean_t is not None else None,
                        'day_temp': round(day_t, 1) if day_t is not None else None,
                        'night_temp': round(night_t, 1) if night_t is not None else None,
                    }
        except Exception:
            pass
        return None

    def _fetch_openmeteo_current(self, city):
        """
        Fetch current weather from Open-Meteo API
        FREE - No API key required, unlimited calls!
        Uses retry session with exponential backoff for reliability
        Handles 429 rate limit errors gracefully with longer delays
        Adds detailed logging for debugging failures.
        """
        max_retries = 2
        base_delay = 2.0
        for attempt in range(max_retries + 1):
            try:
                session = _get_session()
                params = {
                    'latitude': city['lat'],
                    'longitude': city['lon'],
                    'current': 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m',
                    'daily': 'temperature_2m_max,temperature_2m_min',
                    'timezone': 'Asia/Kolkata',
                    'forecast_days': 1
                }
                if attempt > 0:
                    print(f"[Open-Meteo] Retry {attempt+1} for {city['name']}")
                response = session.get(
                    f"{self.openmeteo_base_url}/forecast",
                    params=params,
                    timeout=15
                )
                # Only log non-200 status codes
                if response.status_code != 200:
                    print(f"[Open-Meteo] Status {response.status_code} for {city['name']}")
                if response.status_code == 429:
                    print(f"[Open-Meteo] 429 Rate limit for {city['name']} (attempt {attempt+1})")
                    if attempt < max_retries:
                        wait_time = base_delay * (2 ** attempt)
                        print(f"[Open-Meteo] Waiting {wait_time}s before retry...")
                        time.sleep(wait_time)
                        continue
                    else:
                        print(f"[Open-Meteo] Max retries reached for {city['name']}")
                        raise Exception("API rate limit exceeded - too many requests")
                if response.status_code == 200:
                    try:
                        data = response.json()
                        # Success — logged in summary by get_all_cities_current
                        current = data['current']
                        daily = data['daily']
                        current_temp = current['temperature_2m']
                        day_temp = daily['temperature_2m_max'][0]
                        night_temp = daily['temperature_2m_min'][0]
                        return {
                            'city_id': city['id'],
                            'city_name': city['name'],
                            'state': city['state'],
                            'temperature': round(current_temp, 1),
                            'day_temp': round(day_temp, 1),
                            'night_temp': round(night_temp, 1),
                            'humidity': round(current['relative_humidity_2m'], 1),
                            'feels_like': round(current['apparent_temperature'], 1),
                            'wind_speed': round(current['wind_speed_10m'], 1),
                            'timestamp': datetime.now().isoformat(),
                            'source': 'Open-Meteo'
                        }
                    except Exception as parse_exc:
                        print(f"[Open-Meteo] JSON parse error for {city['name']}: {parse_exc}")
                        print(f"[Open-Meteo] Raw response: {response.text}")
                        raise
                else:
                    print(f"[Open-Meteo] Non-200 status for {city['name']}: {response.status_code}")
                    print(f"[Open-Meteo] Response text: {response.text}")
                    raise Exception(f"Open-Meteo API returned status code {response.status_code}")
            except Exception as e:
                print(f"[Open-Meteo] Exception for {city['name']}: {e}")
                if attempt < max_retries:
                    wait_time = base_delay * (2 ** attempt)
                    print(f"[Open-Meteo] Retrying {city['name']} in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                print(f"[Open-Meteo] All attempts failed for {city['name']}")
                return None
        return None
    
    def _fetch_openweather_current(self, city):
        """
        Fetch current weather from OpenWeatherMap API (FREE)
        Get your free API key: https://openweathermap.org/api
        Free tier: 1000 calls/day, 60 calls/minute
        """
        try:
            params = {
                'lat': city['lat'],
                'lon': city['lon'],
                'appid': self.openweather_api_key,
                'units': 'metric'  # Celsius
            }
            
            response = requests.get(
                f"{self.openweather_base_url}/weather",
                params=params,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                current_temp = data['main']['temp']
                
                # Get forecast for day/night temps
                forecast_data = self._fetch_openweather_forecast(city)
                day_temp = current_temp + 2  # Default estimate
                night_temp = current_temp - 3  # Default estimate
                
                if forecast_data:
                    day_temp = forecast_data.get('day_temp', day_temp)
                    night_temp = forecast_data.get('night_temp', night_temp)
                
                return {
                    'city_id': city['id'],
                    'city_name': city['name'],
                    'state': city['state'],
                    'temperature': round(current_temp, 1),
                    'day_temp': round(day_temp, 1),
                    'night_temp': round(night_temp, 1),
                    'humidity': data['main']['humidity'],
                    'feels_like': round(data['main']['feels_like'], 1),
                    'wind_speed': round(data['wind']['speed'] * 3.6, 1),  # m/s to km/h
                    'timestamp': datetime.now().isoformat(),
                    'source': 'OpenWeatherMap'
                }
            else:
                raise Exception(f"OpenWeatherMap API Error: {response.status_code} - {response.text}")
                
        except Exception as e:
            raise Exception(f"Error fetching OpenWeatherMap data: {str(e)}")
    
    def _fetch_openweather_forecast(self, city):
        """
        Fetch forecast to get accurate day/night temperatures
        """
        try:
            params = {
                'lat': city['lat'],
                'lon': city['lon'],
                'appid': self.openweather_api_key,
                'units': 'metric',
                'cnt': 8  # Next 24 hours (3-hour intervals)
            }
            
            response = requests.get(
                f"{self.openweather_base_url}/forecast",
                params=params,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                temps = [item['main']['temp'] for item in data['list']]
                return {
                    'day_temp': max(temps),
                    'night_temp': min(temps)
                }
                
        except Exception as e:
            print(f"Error fetching forecast: {str(e)}")
            return None
    
    # NOTE: Duplicate _fetch_openmeteo_current removed — single implementation above (with retry session)
    
    def _fetch_imd_current(self, city):
        """
        Fetch weather from IMD API (if you have access)
        """
        if not self.imd_api_key:
            raise Exception("IMD API key not configured")
            
        try:
            headers = {'Authorization': f'Bearer {self.imd_api_key}'}
            params = {
                'lat': city['lat'],
                'lon': city['lon'],
                'station': city.get('imd_station', '')
            }
            
            response = requests.get(
                f"{self.imd_base_url}/weather/current",
                headers=headers,
                params=params,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'city_id': city['id'],
                    'city_name': city['name'],
                    'state': city['state'],
                    'temperature': round(data.get('temp', 0), 1),
                    'day_temp': round(data.get('max_temp', 0), 1),
                    'night_temp': round(data.get('min_temp', 0), 1),
                    'humidity': data.get('humidity', 0),
                    'feels_like': round(data.get('feels_like', 0), 1),
                    'wind_speed': round(data.get('wind_speed', 0), 1),
                    'timestamp': datetime.now().isoformat(),
                    'source': 'IMD'
                }
            else:
                raise Exception(f"IMD API Error: {response.status_code}")
                
        except Exception as e:
            raise Exception(f"Error calling IMD API: {str(e)}")
