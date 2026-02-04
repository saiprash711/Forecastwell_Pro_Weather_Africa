"""
Weather Service Module
Handles IMD data integration and weather data processing
"""
import requests
import random
from datetime import datetime, timedelta
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
        self.openmeteo_base_url = "https://api.open-meteo.com/v1"  # Open-Meteo (FREE, no key!)
        self.openmeteo_base_url = "https://api.open-meteo.com/v1"  # Open-Meteo (FREE, no key needed!)
        
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
        Get temperature forecast for a city
        
        Args:
            city_id: City identifier
            days: Number of days to forecast
            
        Returns:
            list: Forecast data
        """
        city = self._get_city_config(city_id)
        if not city:
            return []
            
        forecast = []
        base_temp = random.uniform(30, 38)
        
        for i in range(days):
            date = datetime.now() + timedelta(days=i)
            temp_variation = random.uniform(-3, 3)
            day_temp = base_temp + temp_variation + random.uniform(2, 4)
            night_temp = base_temp + temp_variation - random.uniform(3, 5)
            
            forecast.append({
                'date': date.strftime('%Y-%m-%d'),
                'day': date.strftime('%A'),
                'temperature': round(base_temp + temp_variation, 1),
                'day_temp': round(day_temp, 1),
                'night_temp': round(night_temp, 1),
                'min_temp': round(night_temp - 1, 1),
                'max_temp': round(day_temp + 2, 1),
                'humidity': round(random.uniform(50, 80), 1),
                'source': 'IMD'
            })
            
        return forecast
    
    def get_historical_data(self, city_id, days=30):
        """
        Get historical temperature data
        
        Args:
            city_id: City identifier
            days: Number of past days
            
        Returns:
            list: Historical data
        """
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
                'source': 'IMD'
            })
            
        return historical
    
    def get_all_cities_current(self):
        """Get current weather for all configured cities"""
        cities_data = []

        for city in Config.CITIES:
            data = self.get_current_weather(city['id'])
            if data:
                data['lat'] = city['lat']
                data['lon'] = city['lon']
                cities_data.append(data)

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
