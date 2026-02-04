"""
Data Processor Module
Handles data processing, Excel file operations, and AC hours calculation
Enhanced for ForecastWell Dashboard per guide specifications
"""
import pandas as pd
from datetime import datetime
from config import Config

# Global variable to store imported Excel data
EXCEL_IMPORTED_DATA = None

class DataProcessor:
    """Processor for handling data operations"""
    
    def __init__(self):
        pass
    
    def load_excel_data(self, filepath):
        """
        Load data from Excel file (6-City IMD Forecast format)
        
        Args:
            filepath: Path to Excel file
            
        Returns:
            pandas.DataFrame: Loaded data
        """
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
        Determine season status based on temperatures
        
        Returns:
            str: Season status (e.g., "Peak Season", "Building", "Off Season")
        """
        # Night temp is primary indicator
        if avg_night_temp >= 23:
            return "🔥 Peak Season"
        elif avg_night_temp >= 20:
            return "📈 Building Season"
        elif avg_night_temp >= 18:
            return "🌡️ Moderate Season"
        else:
            return "❄️ Off Season"
    
    def calculate_days_to_peak(self, forecast_data):
        """
        Calculate days until peak temperature season
        
        Args:
            forecast_data: List of forecast data
            
        Returns:
            int: Days to peak, or 0 if already at peak
        """
        if not forecast_data:
            return 0
        
        for idx, day in enumerate(forecast_data):
            night_temp = day.get('night_temp', 0)
            if night_temp >= Config.THRESHOLD_RED_NIGHT:
                return idx
        
        return len(forecast_data)  # Beyond forecast period
    
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
                if pd.isna(date_val): continue
                
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
                if pd.isna(humidity): humidity = 50 # default

                # Find the city in config to get its ID
                city_id = self._get_city_id_from_name(city_name)
                if not city_id:
                    # Optional: Print unknown city
                    continue

                # Validate numeric data
                if pd.isna(day_temp) or pd.isna(night_temp):
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
