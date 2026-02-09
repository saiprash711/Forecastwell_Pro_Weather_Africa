"""
Weather Service Module
Handles IMD data integration and weather data processing
"""
import requests
import random
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from config import Config

# Global variable to hold imported Excel data
EXCEL_IMPORTED_DATA = None

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
        Get current weather data for a specific city

        Args:
            city_id: City identifier

        Returns:
            dict: Current weather data
        """
        # Check if we have imported Excel data for this city
        try:
            from .data_processor import EXCEL_IMPORTED_DATA as excel_data
            if excel_data and city_id in excel_data:
                # Use the most recent data from Excel import
                city_data_list = excel_data[city_id]
                if city_data_list:
                    latest_data = city_data_list[-1]  # Most recent
                    city = self._get_city_config(city_id)
                    if city:  # Make sure city exists
                        return {
                            'city_id': city_id,
                            'city_name': city['name'],
                            'state': city['state'],
                            'temperature': latest_data['temperature'],
                            'day_temp': latest_data['day_temp'],
                            'night_temp': latest_data['night_temp'],
                            'humidity': latest_data.get('humidity', round(random.uniform(45, 85), 1)),
                            'feels_like': round(latest_data['temperature'] + random.uniform(1, 3), 1),
                            'wind_speed': round(random.uniform(5, 25), 1),
                            'timestamp': latest_data['timestamp'],
                            'source': 'Excel Import'
                        }
        except ImportError:
            # If import fails, continue with default behavior
            pass
        except Exception:
            # If any other error occurs, continue with default behavior
            pass

        # Get city configuration
        city = self._get_city_config(city_id)
        if not city:
            return None

        # Try Open-Meteo API first (FREE, no key needed!)
        weather_data = self._fetch_openmeteo_current(city)
        if weather_data:
            return weather_data

        # Try OpenWeatherMap API (FREE, needs key)
        if self.openweather_api_key:
            weather_data = self._fetch_openweather_current(city)
            if weather_data:
                return weather_data
        
        # Fallback to IMD API if available
        if self.imd_api_key:
            weather_data = self._fetch_imd_current(city)
            if weather_data:
                return weather_data

        # Fallback to simulated data if all APIs unavailable
        base_temp = random.uniform(28, 42)
        return {
            'city_id': city_id,
            'city_name': city['name'],
            'state': city['state'],
            'temperature': round(base_temp, 1),
            'day_temp': round(base_temp + random.uniform(1, 3), 1),
            'night_temp': round(base_temp - random.uniform(3, 5), 1),
            'humidity': round(random.uniform(45, 85), 1),
            'feels_like': round(base_temp + random.uniform(1, 3), 1),
            'wind_speed': round(random.uniform(5, 25), 1),
            'timestamp': datetime.now().isoformat(),
            'source': 'Simulated'
        }
    
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
            # For longer forecasts (up to 4+ months), use Seasonal Forecast API
            forecast = self._fetch_openmeteo_seasonal_forecast(city, days)
            if forecast:
                return forecast
        
        # Fallback to simulated data only if API fails
        return self._generate_fallback_forecast(city_id, days)
    
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
            
            response = requests.get(
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
                    print(f"Seasonal forecast: {len(forecast)} days fetched for {city['name']}")
                    return forecast
                else:
                    print(f"Seasonal API returned empty forecast")
                    return None
            else:
                print(f"Open-Meteo Seasonal API Error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"Error fetching Open-Meteo seasonal forecast: {str(e)}")
            return None
    
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
            
            response = requests.get(
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
            else:
                print(f"Open-Meteo Forecast API Error: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Error fetching Open-Meteo forecast: {str(e)}")
            return None
    
    def _generate_fallback_forecast(self, city_id, days):
        """Fallback forecast generation if API fails"""
        city = self._get_city_config(city_id)
        if not city:
            return []
            
        # City-specific base temperatures (used only as fallback)
        city_base_temps = {
            'chennai': {'day': 33, 'night': 25},
            'hyderabad': {'day': 32, 'night': 22},
            'bangalore': {'day': 28, 'night': 19},
            'visakhapatnam': {'day': 31, 'night': 24},
            'vijayawada': {'day': 34, 'night': 25},
            'tirupati': {'day': 33, 'night': 24},
            'madurai': {'day': 34, 'night': 26},
            'coimbatore': {'day': 30, 'night': 21},
            'trichy': {'day': 35, 'night': 26},
            'nellore': {'day': 33, 'night': 24},
            'guntur': {'day': 34, 'night': 24},
            'kurnool': {'day': 35, 'night': 23},
            'warangal': {'day': 33, 'night': 22},
            'rajahmundry': {'day': 33, 'night': 24},
            'kakinada': {'day': 32, 'night': 24},
            'vijayawada': {'day': 34, 'night': 25}
        }
        
        monthly_variations = {
            1: {'day': -4, 'night': -5}, 2: {'day': -2, 'night': -3},
            3: {'day': 2, 'night': 0}, 4: {'day': 5, 'night': 3},
            5: {'day': 8, 'night': 5}, 6: {'day': 6, 'night': 4},
            7: {'day': 2, 'night': 2}, 8: {'day': 1, 'night': 1},
            9: {'day': 1, 'night': 1}, 10: {'day': 0, 'night': 0},
            11: {'day': -2, 'night': -2}, 12: {'day': -4, 'night': -4}
        }
        
        base = city_base_temps.get(city_id, {'day': 32, 'night': 23})
        forecast = []
        
        for i in range(days):
            date = datetime.now() + timedelta(days=i)
            month = date.month
            variation = monthly_variations[month]
            
            random.seed(f"{city_id}_{date.strftime('%Y%m%d')}")
            daily_noise = random.uniform(-1.5, 1.5)
            
            day_temp = base['day'] + variation['day'] + daily_noise
            night_temp = base['night'] + variation['night'] + daily_noise * 0.7
            
            forecast.append({
                'date': date.strftime('%Y-%m-%d'),
                'day': date.strftime('%A'),
                'temperature': round((day_temp + night_temp) / 2, 1),
                'day_temp': round(day_temp, 1),
                'night_temp': round(night_temp, 1),
                'min_temp': round(night_temp - 1, 1),
                'max_temp': round(day_temp + 2, 1),
                'humidity': round(random.uniform(50, 80), 1),
                'source': 'Simulated (API Fallback)',
                'is_forecast': True
            })
        
        random.seed()
        return forecast
    
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
        
        # Fallback to simulated data only if API fails
        return self._generate_fallback_historical(city_id, days)
    
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
            
            response = requests.get(
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
            else:
                print(f"Open-Meteo Archive API Error: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Error fetching Open-Meteo historical: {str(e)}")
            return None
    
    def _generate_fallback_historical(self, city_id, days):
        """Fallback historical data if API fails"""
        city = self._get_city_config(city_id)
        if not city:
            return []
            
        historical = []
        base_temp = random.uniform(30, 36)
        
        for i in range(days, 0, -1):
            date = datetime.now() - timedelta(days=i)
            temp_variation = random.uniform(-4, 4)
            day_temp = base_temp + temp_variation + random.uniform(2, 4)
            night_temp = base_temp + temp_variation - random.uniform(3, 5)
            
            historical.append({
                'date': date.strftime('%Y-%m-%d'),
                'temperature': round(base_temp + temp_variation, 1),
                'day_temp': round(day_temp, 1),
                'night_temp': round(night_temp, 1),
                'min_temp': round(night_temp - 1, 1),
                'max_temp': round(day_temp + 2, 1),
                'source': 'Simulated (API Fallback)'
            })
            
        return historical
    
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
            
            response = requests.get(
                "https://archive-api.open-meteo.com/v1/archive",
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                daily = data.get('daily', {})
                
                if not daily or 'time' not in daily:
                    return self._generate_fallback_monthly(year, current_year, current_month)
                
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
                print(f"Open-Meteo Archive API Error for {year}: {response.status_code}")
                return self._generate_fallback_monthly(year, current_year, current_month)
                
        except Exception as e:
            print(f"Error fetching yearly data for {year}: {str(e)}")
            return self._generate_fallback_monthly(year, current_year, current_month)
    
    def _generate_fallback_monthly(self, year, current_year, current_month):
        """Generate fallback monthly data when API fails"""
        # South India climate-based estimates
        base_temps = {
            1: {'day': 29, 'night': 21}, 2: {'day': 31, 'night': 22},
            3: {'day': 33, 'night': 24}, 4: {'day': 35, 'night': 26},
            5: {'day': 38, 'night': 28}, 6: {'day': 36, 'night': 27},
            7: {'day': 34, 'night': 25}, 8: {'day': 33, 'night': 25},
            9: {'day': 33, 'night': 24}, 10: {'day': 32, 'night': 24},
            11: {'day': 30, 'night': 23}, 12: {'day': 29, 'night': 21}
        }
        
        monthly_data = []
        for month in range(1, 13):
            if year == current_year and month > current_month:
                monthly_data.append({
                    'month': month,
                    'month_name': datetime(year, month, 1).strftime('%b'),
                    'avg_day_temp': None,
                    'avg_night_temp': None,
                    'source': None,
                    'is_forecast': False
                })
            else:
                temps = base_temps[month]
                monthly_data.append({
                    'month': month,
                    'month_name': datetime(year, month, 1).strftime('%b'),
                    'avg_day_temp': temps['day'],
                    'avg_night_temp': temps['night'],
                    'source': 'Climate Estimate',
                    'is_forecast': False
                })
        return monthly_data
    
    def get_all_cities_current(self):
        """Get current weather for all configured cities (parallel fetching)"""
        cities_data = []

        def fetch_city(city):
            data = self.get_current_weather(city['id'])
            if data:
                data['lat'] = city['lat']
                data['lon'] = city['lon']
            return data

        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = {executor.submit(fetch_city, city): city for city in Config.CITIES}
            for future in as_completed(futures):
                try:
                    data = future.result()
                    if data:
                        cities_data.append(data)
                except Exception as e:
                    print(f"Error fetching city weather: {e}")

        return cities_data
    
    def _get_city_config(self, city_id):
        """Get city configuration by ID"""
        for city in Config.CITIES:
            if city['id'] == city_id:
                return city
        return None
    
    def _fetch_openmeteo_current(self, city):
        """
        Fetch current weather from Open-Meteo API
        FREE - No API key required, unlimited calls!
        Best coverage for global data
        """
        try:
            params = {
                'latitude': city['lat'],
                'longitude': city['lon'],
                'current': 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m',
                'daily': 'temperature_2m_max,temperature_2m_min',
                'timezone': 'Asia/Kolkata',
                'forecast_days': 1
            }
            
            response = requests.get(
                f"{self.openmeteo_base_url}/forecast",
                params=params,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
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
            else:
                print(f"Open-Meteo API Error: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Error fetching Open-Meteo data: {str(e)}")
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
                print(f"OpenWeatherMap API Error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"Error fetching OpenWeatherMap data: {str(e)}")
            return None
    
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
    
    def _fetch_openmeteo_current(self, city):
        """
        Fetch current weather from Open-Meteo API (FREE, NO API KEY!)
        Unlimited calls, no registration required
        """
        try:
            params = {
                'latitude': city['lat'],
                'longitude': city['lon'],
                'current': 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m',
                'daily': 'temperature_2m_max,temperature_2m_min',
                'timezone': 'Asia/Kolkata',
                'forecast_days': 1
            }
            
            response = requests.get(
                f"{self.openmeteo_base_url}/forecast",
                params=params,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
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
            else:
                print(f"Open-Meteo API Error: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Error fetching Open-Meteo data: {str(e)}")
            return None
    
    def _fetch_imd_current(self, city):
        """
        Fetch weather from IMD API (if you have access)
        """
        if not self.imd_api_key:
            return None
            
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
                print(f"IMD API Error: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Error calling IMD API: {str(e)}")
            return None
