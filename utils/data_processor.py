"""
Data Processor Module
Handles data processing, Excel file operations, and AC hours calculation
Enhanced for ForecastWell Dashboard per guide specifications
Includes: Wet bulb temp, consecutive hot days, demand correlation, service demand prediction
"""
import math
try:
    import pandas as pd
except Exception:
    pd = None

# Safe is-na helper (falls back to None-check when pandas is absent)
def _isna(val):
    if pd is not None:
        return pd.isna(val)
    return val is None

from datetime import datetime
from config import Config

# Global variable to store imported Excel data
EXCEL_IMPORTED_DATA = None

class DataProcessor:
    """Processor for handling data operations"""
    
    def __init__(self):
        pass
    
    # ─── Advanced Weather Parameters ──────────────────────────────────────
    
    def calculate_wet_bulb(self, temp_c, humidity):
        """
        Calculate wet bulb temperature using the Stull (2011) formula.
        Wet bulb > 32°C → danger (human body cannot cool)
        Wet bulb > 28°C → caution (heat stress risk)
        
        Args:
            temp_c: Air temperature in Celsius
            humidity: Relative humidity (0-100)
        Returns:
            dict: {value, level, label, color}
        """
        if temp_c is None or humidity is None:
            return {'value': None, 'level': 'unknown', 'label': 'N/A', 'color': 'gray'}
        
        # Stull (2011) approximation
        try:
            tw = temp_c * math.atan(0.151977 * math.sqrt(humidity + 8.313659)) \
                 + math.atan(temp_c + humidity) \
                 - math.atan(humidity - 1.676331) \
                 + 0.00391838 * (humidity ** 1.5) * math.atan(0.023101 * humidity) \
                 - 4.686035
            tw = round(tw, 1)
        except Exception:
            tw = round(temp_c - ((100 - humidity) / 5), 1)  # Simple fallback
        
        if tw >= Config.WET_BULB_DANGER:
            return {'value': tw, 'level': 'danger', 'label': 'Dangerous — body cannot cool', 'color': '#dc3545'}
        elif tw >= Config.WET_BULB_CAUTION:
            return {'value': tw, 'level': 'caution', 'label': 'Heat stress risk', 'color': '#fd7e14'}
        else:
            return {'value': tw, 'level': 'safe', 'label': 'Acceptable', 'color': '#28a745'}
    
    def detect_consecutive_hot_days(self, forecast_or_historical):
        """
        Detect consecutive days above heatwave threshold.
        Heatwave = day ≥ 40°C AND night ≥ 28°C for ≥ 3 consecutive days.
        
        Args:
            forecast_or_historical: list of dicts with day_temp, night_temp
        Returns:
            dict: {is_heatwave, consecutive_days, peak_day_temp, peak_night_temp, start_date, end_date}
        """
        if not forecast_or_historical:
            return {'is_heatwave': False, 'consecutive_days': 0, 'peak_day_temp': None, 'peak_night_temp': None}
        
        streak = 0
        max_streak = 0
        peak_day = 0
        peak_night = 0
        streak_start = None
        best_start = None
        best_end = None
        
        for i, day in enumerate(forecast_or_historical):
            dt = day.get('day_temp', 0)
            nt = day.get('night_temp', 0)
            
            if dt >= Config.HEATWAVE_DAY_THRESHOLD and nt >= Config.HEATWAVE_NIGHT_THRESHOLD:
                if streak == 0:
                    streak_start = day.get('date', f'day_{i}')
                streak += 1
                peak_day = max(peak_day, dt)
                peak_night = max(peak_night, nt)
                
                if streak > max_streak:
                    max_streak = streak
                    best_start = streak_start
                    best_end = day.get('date', f'day_{i}')
            else:
                streak = 0
        
        return {
            'is_heatwave': max_streak >= Config.HEATWAVE_CONSECUTIVE_DAYS,
            'consecutive_days': max_streak,
            'peak_day_temp': round(peak_day, 1) if peak_day else None,
            'peak_night_temp': round(peak_night, 1) if peak_night else None,
            'start_date': best_start,
            'end_date': best_end,
            'threshold': f'≥{Config.HEATWAVE_DAY_THRESHOLD}°C day & ≥{Config.HEATWAVE_NIGHT_THRESHOLD}°C night for {Config.HEATWAVE_CONSECUTIVE_DAYS}+ days'
        }
    
    def get_monsoon_status(self):
        """
        Get current monsoon status relative to typical SW monsoon dates.
        Returns:
            dict: {phase, days_to_onset, days_since_withdrawal, label, icon}
        """
        today = datetime.now()
        year = today.year
        onset = datetime(year, Config.MONSOON_ONSET['month'], Config.MONSOON_ONSET['day'])
        withdrawal = datetime(year, Config.MONSOON_WITHDRAWAL['month'], Config.MONSOON_WITHDRAWAL['day'])
        
        if today < onset:
            days_to = (onset - today).days
            return {'phase': 'pre_monsoon', 'days_to_onset': days_to, 'label': f'{days_to} days to monsoon onset', 'icon': '☀️'}
        elif today <= withdrawal:
            days_since = (today - onset).days
            days_left = (withdrawal - today).days
            return {'phase': 'active', 'days_active': days_since, 'days_remaining': days_left, 'label': f'Monsoon active — {days_left} days remaining', 'icon': '🌧️'}
        else:
            days_since = (today - withdrawal).days
            return {'phase': 'post_monsoon', 'days_since_withdrawal': days_since, 'label': f'{days_since} days since withdrawal', 'icon': '🌤️'}
    
    def get_dsb_zone(self, demand_index):
        """
        Map demand index to DSB methodology zone (Green / Amber / Red).
        
        Args:
            demand_index: 0-100 demand score
        Returns:
            dict: {zone, label, color, action, icon}
        """
        if demand_index is None:
            demand_index = 0
        
        if demand_index >= Config.DSB_AMBER['demand_max']:  # > 70
            return {
                'zone': 'red',
                'label': Config.DSB_RED['label'],
                'color': '#dc3545',
                'action': Config.DSB_RED['action'],
                'icon': '🔴'
            }
        elif demand_index >= Config.DSB_GREEN['demand_max']:  # > 40
            return {
                'zone': 'amber',
                'label': Config.DSB_AMBER['label'],
                'color': '#fd7e14',
                'action': Config.DSB_AMBER['action'],
                'icon': '🟡'
            }
        else:
            return {
                'zone': 'green',
                'label': Config.DSB_GREEN['label'],
                'color': '#28a745',
                'action': Config.DSB_GREEN['action'],
                'icon': '🟢'
            }
    
    # ─── Demand Correlation Layer ─────────────────────────────────────────
    
    def calculate_demand_correlation(self, weather_data_list, city_id):
        """
        Calculate demand correlation between weather and simulated historical sales.
        Generates synthetic sales data correlated with temperature patterns.
        
        Args:
            weather_data_list: list of dicts with day_temp, night_temp, humidity, date
            city_id: city identifier
        Returns:
            dict with correlation_score, chart_data, insight
        """
        if not weather_data_list:
            return {'correlation_score': 0, 'chart_data': [], 'insight': 'Insufficient data'}
        
        import random as rng
        chart_data = []
        
        for entry in weather_data_list:
            dt = entry.get('day_temp', 32)
            nt = entry.get('night_temp', 22)
            hum = entry.get('humidity', 60)
            
            # Simulated sales index correlated with temperature
            demand = self.calculate_demand_index(dt, nt, hum)
            # Sales = demand * factor + noise
            rng.seed(f"{city_id}_{entry.get('date', '')}")
            sales_index = max(5, min(100, demand + rng.uniform(-8, 8)))
            
            chart_data.append({
                'date': entry.get('date', ''),
                'day_temp': round(dt, 1),
                'night_temp': round(nt, 1),
                'demand_index': round(demand, 1),
                'sales_index': round(sales_index, 1)
            })
        
        # Calculate Pearson correlation coefficient
        demands = [d['demand_index'] for d in chart_data]
        sales = [d['sales_index'] for d in chart_data]
        n = len(demands)
        if n < 2:
            r = 0
        else:
            sum_d = sum(demands)
            sum_s = sum(sales)
            sum_ds = sum(d * s for d, s in zip(demands, sales))
            sum_d2 = sum(d ** 2 for d in demands)
            sum_s2 = sum(s ** 2 for s in sales)
            numerator = n * sum_ds - sum_d * sum_s
            denominator = math.sqrt((n * sum_d2 - sum_d ** 2) * (n * sum_s2 - sum_s ** 2))
            r = round(numerator / denominator, 3) if denominator != 0 else 0
        
        if r >= 0.8:
            insight = 'Very strong correlation — weather is primary demand driver'
        elif r >= 0.6:
            insight = 'Strong correlation — weather significantly influences demand'
        elif r >= 0.4:
            insight = 'Moderate correlation — weather is one of several demand factors'
        else:
            insight = 'Weak correlation — other factors dominate demand'
        
        return {
            'correlation_score': r,
            'correlation_label': f'{r:.2f} ({"Strong" if r >= 0.6 else "Moderate" if r >= 0.4 else "Weak"})',
            'chart_data': chart_data[-60:],  # Last 60 data points for chart
            'insight': insight
        }
    
    # ─── Service Demand Prediction ────────────────────────────────────────
    
    def predict_service_demand(self, city_id, day_temp, night_temp, humidity):
        """
        Predict service demand: compressor failures, gas refills, warranty claims.
        Based on weather severity and monsoon phase.
        
        Args:
            city_id: city identifier
            day_temp, night_temp, humidity: current weather
        Returns:
            dict with service predictions
        """
        monsoon = self.get_monsoon_status()
        demand_idx = self.calculate_demand_index(day_temp, night_temp, humidity)
        wet_bulb = self.calculate_wet_bulb(day_temp, humidity)
        
        # Compressor failure risk (higher in post-monsoon + high humidity)
        compressor_base = 15
        if monsoon['phase'] == 'post_monsoon':
            compressor_base += 25
        if humidity and humidity > 75:
            compressor_base += 15
        if day_temp and day_temp >= 40:
            compressor_base += 20
        compressor_risk = min(100, compressor_base)
        
        # Gas refill demand (pre-summer surge)
        gas_base = 10
        if monsoon['phase'] == 'pre_monsoon':
            gas_base += 30
        if demand_idx >= 60:
            gas_base += 25
        if day_temp and day_temp >= 36:
            gas_base += 15
        gas_demand = min(100, gas_base)
        
        # Warranty claims (peak usage = peak failures)
        warranty_base = 10
        if demand_idx >= 80:
            warranty_base += 30
        elif demand_idx >= 60:
            warranty_base += 15
        if humidity and humidity > 80:
            warranty_base += 10
        if wet_bulb.get('level') == 'danger':
            warranty_base += 15
        warranty_risk = min(100, warranty_base)
        
        # Installation demand
        install_base = 20
        if monsoon['phase'] == 'pre_monsoon' and demand_idx >= 50:
            install_base += 40
        elif demand_idx >= 70:
            install_base += 25
        install_demand = min(100, install_base)
        
        predictions = {
            'compressor_failure': {
                'risk': compressor_risk,
                'level': 'High' if compressor_risk >= 60 else ('Medium' if compressor_risk >= 35 else 'Low'),
                'icon': '🔧',
                'label': 'Compressor Failures',
                'detail': 'Post-monsoon humidity corrodes units' if monsoon['phase'] == 'post_monsoon' else 'Heat stress on compressors'
            },
            'gas_refill': {
                'risk': gas_demand,
                'level': 'High' if gas_demand >= 60 else ('Medium' if gas_demand >= 35 else 'Low'),
                'icon': '⛽',
                'label': 'Gas Refill Demand',
                'detail': 'Pre-summer servicing rush expected' if monsoon['phase'] == 'pre_monsoon' else 'Normal refill cadence'
            },
            'warranty_claims': {
                'risk': warranty_risk,
                'level': 'High' if warranty_risk >= 60 else ('Medium' if warranty_risk >= 35 else 'Low'),
                'icon': '📋',
                'label': 'Warranty Claims',
                'detail': 'Extended runtime increases failure rates' if demand_idx >= 70 else 'Standard claim levels expected'
            },
            'installation': {
                'risk': install_demand,
                'level': 'High' if install_demand >= 60 else ('Medium' if install_demand >= 35 else 'Low'),
                'icon': '🔨',
                'label': 'New Installations',
                'detail': 'Pre-season installation surge' if monsoon['phase'] == 'pre_monsoon' else 'Steady installation demand'
            },
            'monsoon_phase': monsoon,
            'overall_service_load': round((compressor_risk + gas_demand + warranty_risk + install_demand) / 4, 1)
        }
        
        return predictions
    
    # ─── Refresh Cadence ──────────────────────────────────────────────────
    
    def get_refresh_status(self):
        """
        Get current refresh cadence status: daily weather, weekly demand, monthly accuracy.
        Returns:
            dict with next refresh times and status
        """
        now = datetime.now()
        
        # Daily weather refresh
        next_weather = now.replace(hour=6, minute=0, second=0)
        if now >= next_weather:
            next_weather = next_weather.replace(day=now.day + 1) if now.day < 28 else next_weather
        
        # Weekly demand forecast (every Monday)
        days_to_monday = (7 - now.weekday()) % 7 or 7
        next_demand = now + __import__('datetime').timedelta(days=days_to_monday)
        
        # Monthly accuracy validation (1st of each month)
        if now.month < 12:
            next_accuracy = now.replace(month=now.month + 1, day=1)
        else:
            next_accuracy = now.replace(year=now.year + 1, month=1, day=1)
        
        return {
            'weather': {
                'cadence': 'Daily',
                'hours': Config.REFRESH_WEATHER_HOURS,
                'next_refresh': next_weather.strftime('%Y-%m-%d %H:%M'),
                'icon': '☁️'
            },
            'demand': {
                'cadence': 'Weekly',
                'days': Config.REFRESH_DEMAND_DAYS,
                'next_refresh': next_demand.strftime('%Y-%m-%d'),
                'icon': '📊'
            },
            'accuracy': {
                'cadence': 'Monthly',
                'days': Config.REFRESH_ACCURACY_DAYS,
                'next_refresh': next_accuracy.strftime('%Y-%m-%d'),
                'validated_accuracy': f'{Config.FORECAST_ACCURACY}%',
                'icon': '✅'
            }
        }
    
    def load_excel_data(self, filepath):
        """
        Load data from Excel file (6-City IMD Forecast format)
        
        Args:
            filepath: Path to Excel file
            
        Returns:
            pandas.DataFrame or None: Loaded data (None on error or if pandas missing)
        """
        if pd is None:
            print("pandas not installed — Excel import unavailable")
            return None
        try:
            df = pd.read_excel(filepath)
            # Expected columns: City, Date, Day_Temp, Night_Temp, Humidity, etc.
            return df
        except Exception as e:
            print(f"Error loading Excel file: {str(e)}")
            return None
    
    def process_temperature_data(self, data):
        """
        Process raw temperature data
        
        Args:
            data: Raw temperature data
            
        Returns:
            dict: Processed statistics
        """
        if not data:
            return None
            
        temps = [d['temperature'] for d in data]
        day_temps = [d.get('day_temp', d['temperature']) for d in data]
        night_temps = [d.get('night_temp', d['temperature'] - 5) for d in data]
        
        return {
            'avg': round(sum(temps) / len(temps), 1),
            'avg_day': round(sum(day_temps) / len(day_temps), 1),
            'avg_night': round(sum(night_temps) / len(night_temps), 1),
            'min': round(min(temps), 1),
            'max': round(max(temps), 1),
            'hottest_day': round(max(day_temps), 1),
            'hottest_night': round(max(night_temps), 1),
            'trend': self._calculate_trend(temps)
        }
    
    def export_to_excel(self, data, filename):
        """
        Export data to Excel file with proper formatting

        Args:
            data: Data to export (list of dicts or DataFrame)
            filename: Output filename

        Returns:
            bool: Success status
        """
        if pd is None:
            print("pandas not installed — Excel export unavailable")
            return False
        try:
            if isinstance(data, list):
                df = pd.DataFrame(data)
            else:
                df = data

            # Add metadata sheet
            with pd.ExcelWriter(filename, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='ForecastWell Data', index=False)

                # Add metadata
                metadata = pd.DataFrame({
                    'Parameter': ['Generated', 'Source', 'Cities', 'Dashboard'],
                    'Value': [
                        datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'IMD (India Meteorological Department)',
                        ', '.join([c['name'] for c in Config.CITIES]),
                        'ForecastWell Dashboard v1.0'
                    ]
                })
                metadata.to_excel(writer, sheet_name='Metadata', index=False)

            return True
        except Exception as e:
            print(f"Error exporting to Excel: {str(e)}")
            return False

    def calculate_demand_index(self, day_temp=None, night_temp=None, humidity=None):
        """
        Calculate demand index based on day/night temperature and humidity
        CRITICAL: Night temperature weighted MORE heavily!
        
        Args:
            day_temp: Daytime temperature
            night_temp: Nighttime temperature (MORE IMPORTANT!)
            humidity: Humidity percentage (optional)
            
        Returns:
            float: Demand index (0-100)
        """
        # If only one temp provided, use it as average
        if day_temp and not night_temp:
            night_temp = day_temp - 5
        elif night_temp and not day_temp:
            day_temp = night_temp + 5
        elif not day_temp and not night_temp:
            return 0
        
        # Night temperature base index (60% weight)
        night_index = self._temp_to_index(night_temp, is_night=True)
        
        # Day temperature base index (40% weight)
        day_index = self._temp_to_index(day_temp, is_night=False)
        
        # Combined weighted index
        base_index = (night_index * 0.6) + (day_index * 0.4)
        
        # Adjust for humidity if available
        if humidity:
            if humidity > 70:
                base_index = min(100, base_index * 1.15)
            elif humidity < 40:
                base_index = base_index * 0.9
        
        return round(base_index, 1)
    
    def _temp_to_index(self, temp, is_night=False):
        """Convert temperature to demand index"""
        if is_night:
            # Night temperature thresholds
            if temp >= 24:
                return 95  # Extreme demand
            elif temp >= 22:
                return 85  # Strong demand
            elif temp >= 20:
                return 60  # Warm demand
            elif temp >= 18:
                return 30  # Normal
            else:
                return 10  # Cool/off-season
        else:
            # Day temperature thresholds
            if temp >= 38:
                return 95  # Extreme demand
            elif temp >= 36:
                return 85  # Strong demand
            elif temp >= 34:
                return 60  # Warm demand
            elif temp >= 32:
                return 30  # Normal
            else:
                return 10  # Cool/off-season
    
    def calculate_ac_hours(self, day_temp, night_temp):
        """
        Calculate estimated AC usage hours
        Per Guide: Night temp is MORE important than day temp!
        
        Example from guide:
        - Day 35°C + Night 21°C = 4-6 hours (afternoon only) = MEDIUM
        - Day 32°C + Night 25°C = 12-16 hours (evening + overnight) = HIGH
        
        Args:
            day_temp: Daytime temperature
            night_temp: Nighttime temperature
            
        Returns:
            int: Estimated AC hours per day
        """
        ac_hours = 0
        
        # Daytime AC usage (typically 4-6 hours max in afternoon)
        if day_temp >= 38:
            ac_hours += 6
        elif day_temp >= 36:
            ac_hours += 5
        elif day_temp >= 34:
            ac_hours += 4
        elif day_temp >= 32:
            ac_hours += 2
        
        # Nighttime AC usage (can be 8-12 hours!)
        # This is MORE IMPORTANT for total demand
        if night_temp >= 24:
            ac_hours += 12  # All night usage!
        elif night_temp >= 22:
            ac_hours += 10
        elif night_temp >= 20:
            ac_hours += 6
        elif night_temp >= 18:
            ac_hours += 3
        
        return min(ac_hours, 24)  # Cap at 24 hours
    
    def get_season_status(self, avg_day_temp, avg_night_temp):
        """
        Determine season status based on temperatures AND calendar month.
        
        Returns:
            str: Season status (e.g., "Peak Season", "Building", "Off Season")
        """
        month = datetime.now().month
        
        # Use both temperature and calendar for accurate status
        if avg_night_temp >= 24 or month in (4, 5):
            return "🔥 Peak Season"
        elif avg_night_temp >= 22 or month == 3:
            return "📈 High Season"
        elif avg_night_temp >= 20 or (month == 2 and avg_night_temp >= 18):
            return "🌤️ Building"
        elif month in (6, 7, 8, 9):
            return "🌧️ Monsoon"
        elif month in (11, 12, 1):
            return "❄️ Off Season"
        else:
            return "🌡️ Moderate Season"
    
    def calculate_days_to_peak(self, forecast_data=None):
        """
        Calculate days until peak temperature day using actual forecast data.
        Finds the date with the highest day temperature in the forecast.
        Falls back to calendar-based estimate if no forecast data available.

        Args:
            forecast_data: List of forecast dicts with 'date' and 'day_temp'/'max_temp' fields

        Returns:
            int: Days to peak, or 0 if already at/past peak
        """
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Use actual forecast data to find the hottest day
        if forecast_data:
            peak_temp = -999
            peak_date = None
            for entry in forecast_data:
                # Support multiple field name conventions
                day_t = entry.get('day_temp') or entry.get('max_temp') or entry.get('temperature_max')
                date_str = entry.get('date')
                if day_t is None or date_str is None:
                    continue
                try:
                    entry_date = datetime.strptime(str(date_str)[:10], '%Y-%m-%d')
                except (ValueError, TypeError):
                    continue
                if entry_date >= today and day_t > peak_temp:
                    peak_temp = day_t
                    peak_date = entry_date

            if peak_date is not None:
                days = (peak_date - today).days
                return max(0, days)

        # Fallback: calendar-based estimate (May 30 is typical hottest for South India)
        year = today.year
        peak_date = datetime(year, 5, 30)
        if today > peak_date:
            peak_end = datetime(year, 6, 30)
            if today < peak_end:
                return 0
            peak_date = datetime(year + 1, 5, 30)

        days = (peak_date - today).days
        return max(0, days)
    
    def find_hottest_city(self, cities_data, by_night=True):
        """
        Find hottest city by day or night temperature
        
        Args:
            cities_data: List of city weather data
            by_night: If True, find by night temp (MORE IMPORTANT!), else by day
            
        Returns:
            dict: Hottest city data
        """
        if not cities_data:
            return None
        
        if by_night:
            return max(cities_data, key=lambda x: x.get('night_temp', 0))
        else:
            return max(cities_data, key=lambda x: x.get('day_temp', 0))
    
    def prepare_export_data(self, cities_data, alerts_data, wave_data):
        """
        Prepare comprehensive data for Excel/PDF export
        
        Args:
            cities_data: City weather data
            alerts_data: Alerts data
            wave_data: Wave sequence data
            
        Returns:
            dict: Organized export data
        """
        export_data = {
            'summary': {
                'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'total_cities': len(cities_data),
                'data_source': 'IMD (India Meteorological Department)'
            },
            'cities': cities_data,
            'alerts': alerts_data,
            'waves': wave_data
        }
        
        return export_data

    def load_and_process_excel_data(self, filepath):
        """
        Load and process Excel data, updating internal data structures
        Supports both "List Format" (City, Date, Temp...) and "Matrix Format" (Date, City1_Max, City1_Min...)

        Args:
            filepath: Path to Excel file

        Returns:
            tuple: (bool, str) - Success status and message
        """
        if pd is None:
            return False, "pandas not installed — cannot process Excel files"
        try:
            # Load the Excel file generic read
            df = pd.read_excel(filepath)
            
            # --- Strategy 1: Check for Matrix Format (Voltas Style) ---
            # Look for "DATE" and city columns like "CHN Max", "BLR Min" in first 20 rows
            matrix_header_row = -1
            
            for i, row in df.head(20).iterrows():
                row_str = " ".join([str(v).upper() for v in row.values])
                if "DATE" in row_str and ("MAX" in row_str or "MIN" in row_str):
                    matrix_header_row = i + 1 # +1 because df is already 0-indexed without header
                    break
            
            if matrix_header_row != -1:
                print(f"Detected Matrix Format at row {matrix_header_row}")
                return self._process_matrix_format_excel(filepath, matrix_header_row)

            # --- Strategy 2: Check for List Format (Standard) ---
            # Helper to allow flexible column matching
            def get_col_map(columns):
                col_map = {}
                columns_lower = [str(c).strip().lower() for c in columns]
                
                # Check for City
                for i, col in enumerate(columns_lower):
                    if 'city' in col:
                        col_map['city'] = columns[i]
                    elif 'date' in col:
                        col_map['date'] = columns[i]
                    elif 'humidity' in col:
                        col_map['humidity'] = columns[i]
                    # Check for Day Temp variants
                    elif 'day' in col and 'temp' in col:
                        col_map['day_temp'] = columns[i]
                    elif 'max' in col and 'temp' in col:
                        col_map['day_temp'] = columns[i]
                    # Check for Night Temp variants
                    elif 'night' in col and 'temp' in col:
                        col_map['night_temp'] = columns[i]
                    elif 'min' in col and 'temp' in col:
                        col_map['night_temp'] = columns[i]
                return col_map

            # Check if headers are in the first row
            required_keys = ['city', 'date', 'day_temp', 'night_temp']
            col_map = get_col_map(df.columns)
            missing_keys = [k for k in required_keys if k not in col_map]
            
            # If missing keys, try to find the header row by scanning first 20 rows
            header_found_row = -1
            if missing_keys:
                print(f"List Header not found at row 0 (Missing: {missing_keys}). Scanning...")
                for i, row in df.head(20).iterrows():
                    row_values = [str(v) for v in row.values]
                    row_map = get_col_map(row_values)
                    row_missing = [k for k in required_keys if k not in row_map]
                    
                    if not row_missing:
                        header_found_row = i + 1
                        break
            else:
                header_found_row = 0

            if header_found_row != -1:
                if header_found_row > 0:
                    df = pd.read_excel(filepath, header=header_found_row)
                    col_map = get_col_map(df.columns) # Re-map with new headers

                # Apply the mapping to normalize column names
                rename_dict = {}
                for k, v in col_map.items():
                    if k == 'city': rename_dict[v] = 'City'
                    elif k == 'date': rename_dict[v] = 'Date'
                    elif k == 'day_temp': rename_dict[v] = 'Day_Temp'
                    elif k == 'night_temp': rename_dict[v] = 'Night_Temp'
                    elif k == 'humidity': rename_dict[v] = 'Humidity'
                
                df = df.rename(columns=rename_dict)
                return self._process_list_format_dataframe(df)
            
            msg = f"Could not recognize file format. missing columns: {missing_keys}"
            return False, msg

        except Exception as e:
            return False, f"Error processing file: {str(e)}"

    def _process_matrix_format_excel(self, filepath, header_row):
        """Process the 'Matrix' styled Excel (City columns)"""
        if pd is None:
            return False, "pandas not installed — cannot process Matrix Excel files"
        try:
            df = pd.read_excel(filepath, header=header_row)
            
            # Identify columns
            # Expected pattern: "CHN Max", "CHN Min", "HYD Max", "HYD Min"
            # Or "CHN\nMax"
            
            excel_data_cache = {}
            current_year = datetime.now().year
            
            # Map standard city codes to our config IDs
            city_code_map = {
                'CHN': 'chennai',
                'BLR': 'bangalore',
                'HYD': 'hyderabad',
                'KOCHI': 'kochi',
                'CBE': 'coimbatore',
                'VTZ': 'visakhapatnam',
                'VJW': 'visakhapatnam', # Assuming mapping for now based on available data
                'MDU': 'coimbatore' # Assuming mapping or just ignore
            }
            
            row_count = 0
            
            # Iterate through rows
            for _, row in df.iterrows():
                date_val = row.get('DATE')
                if _isna(date_val): continue
                
                # Parse date
                date_str = str(date_val)
                # Handle "Jan 30" format
                try:
                    # If it's already a datetime object
                    if hasattr(date_val, 'strftime'):
                        date_parsed = date_val
                    else:
                        # Try parsing "Jan 30"
                        # We assume current year or next year
                        date_parsed = datetime.strptime(f"{date_str} {current_year}", "%b %d %Y")
                        # Handle year wrapping? If Dec data in Jan? Assuming not for now.
                    
                    final_date_str = date_parsed.strftime('%Y-%m-%d')
                except Exception as e:
                    # Keep as is or skip
                    # print(f"Date parse error: {e}")
                    continue
                
                # Iterate columns to find city data
                # We group by city code
                city_data_temp = {} # { 'CHN': {'max': 30, 'min': 22} }
                
                for col in df.columns:
                    col_str = str(col).upper()
                    if 'MAX' in col_str or 'MIN' in col_str:
                         # Extract city code
                         # e.g. "CHN\nMax" -> CHN
                         code = col_str.split('\n')[0].strip()
                         if ' ' in code: code = code.split(' ')[0].strip()
                         
                         if code not in city_data_temp:
                             city_data_temp[code] = {}
                         
                         val = row[col]
                         if pd.isna(val): continue
                         
                         if 'MAX' in col_str:
                             city_data_temp[code]['max'] = float(val)
                         elif 'MIN' in col_str:
                             city_data_temp[code]['min'] = float(val)
                
                # Now convert captured data to our structure
                for code, temps in city_data_temp.items():
                    if 'max' in temps and 'min' in temps:
                        # Map code to city_id
                        city_id = city_code_map.get(code)
                        if not city_id: continue # specific unknown city
                        
                        if city_id not in excel_data_cache:
                            excel_data_cache[city_id] = []
                            
                        excel_data_cache[city_id].append({
                            'date': final_date_str,
                            'day_temp': temps['max'],
                            'night_temp': temps['min'],
                            'humidity': 50, # Default or calc? Matrix doesn't seem to have humidity
                            'temperature': (temps['max'] + temps['min']) / 2,
                            'timestamp': datetime.now().isoformat()
                        })
                        row_count += 1

            if row_count == 0:
                return False, "Found Matrix headers but extracted 0 valid data rows."
                
            global EXCEL_IMPORTED_DATA
            EXCEL_IMPORTED_DATA = excel_data_cache
            return True, f"Successfully processed {row_count} records (Matrix Format)."

        except Exception as e:
             return False, f"Matrix processing error: {str(e)}"

    def _process_list_format_dataframe(self, df):
        """Process the cleaned 'List' styled dataframe"""
        try:
            from datetime import datetime
            excel_data_cache = {}

            row_count = 0
            for _, row in df.iterrows():
                city_name = row['City']
                date = row['Date']
                day_temp = row['Day_Temp']
                night_temp = row['Night_Temp']
                # Humidity optional
                humidity = row.get('Humidity')
                if _isna(humidity): humidity = 50 # default

                # Find the city in config to get its ID
                city_id = self._get_city_id_from_name(city_name)
                if not city_id:
                    # Optional: Print unknown city
                    continue

                # Validate numeric data
                if _isna(day_temp) or _isna(night_temp):
                    continue

                # Convert date if it's a pandas timestamp
                if hasattr(date, 'date'):
                    date_str = date.date().strftime('%Y-%m-%d')
                else:
                    date_str = str(date)

                # Create city data entry
                if city_id not in excel_data_cache:
                    excel_data_cache[city_id] = []

                excel_data_cache[city_id].append({
                    'date': date_str,
                    'day_temp': float(day_temp),
                    'night_temp': float(night_temp),
                    'humidity': float(humidity),
                    'temperature': (float(day_temp) + float(night_temp)) / 2,  # average
                    'timestamp': datetime.now().isoformat()
                })
                row_count += 1
            
            if row_count == 0:
                return False, "No valid data rows processed. Check city names and data formats."

            global EXCEL_IMPORTED_DATA
            EXCEL_IMPORTED_DATA = excel_data_cache

            return True, f"Successfully processed {row_count} records."
        except Exception as e:
            return False, f"List processing error: {str(e)}"



    def _get_city_id_from_name(self, city_name):
        """Helper method to get city ID from name"""
        city_mapping = {
            'Chennai': 'chennai',
            'Bangalore': 'bangalore',
            'Hyderabad': 'hyderabad',
            'Kochi': 'kochi',
            'Coimbatore': 'coimbatore',
            'Visakhapatnam': 'visakhapatnam'
        }
        return city_mapping.get(city_name.title())

    def _calculate_trend(self, values):
        """Calculate trend from values"""
        if len(values) < 2:
            return 'stable'

        recent = values[-5:] if len(values) >= 5 else values
        avg_recent = sum(recent) / len(recent)
        avg_previous = sum(values[:-5]) / len(values[:-5]) if len(values) > 5 else avg_recent

        diff = avg_recent - avg_previous

        if diff > 1:
            return 'increasing'
        elif diff < -1:
            return 'decreasing'
        else:
            return 'stable'
