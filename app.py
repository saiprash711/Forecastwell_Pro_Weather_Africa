"""
ForecastWell Dashboard - Flask Application
Weather-based demand forecasting for HVAC/Consumer Durables
Enhanced per ForecastWell Guide - Night Temperature Priority!
"""
from flask import Flask, render_template, jsonify, request, send_file, session, redirect, url_for
from functools import wraps
from flask_cors import CORS
from datetime import datetime, timedelta
import random
import time
import threading
import requests
from concurrent.futures import ThreadPoolExecutor
from config import Config
from utils.weather_service import WeatherService
from utils.alert_engine import AlertEngine
from utils.data_processor import DataProcessor
from utils.supabase_client import SupabaseHandler

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# ---- Dummy credentials for login ----
DUMMY_USERNAME = 'admin'
DUMMY_PASSWORD = 'forecast2026'


def login_required(f):
    """Decorator to require login for a route"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Initialize services
weather_service = WeatherService()
alert_engine = AlertEngine()
data_processor = DataProcessor()
supabase_handler = SupabaseHandler()

# Simple in-memory cache for faster responses
cache = {
    'weather_data': None,
    'weather_timestamp': 0,
    'alerts_data': None,
    'alerts_timestamp': 0,
    'monthly_data': {},  # Cache monthly data by city_id and year
    'monthly_timestamp': {},
    'forecast_data': {},  # Cache forecast data by city_id
    'forecast_timestamp': {}
}
CACHE_TTL = 300  # 5 minutes cache
MONTHLY_CACHE_TTL = 3600  # 1 hour cache for monthly data (changes rarely)
FORECAST_CACHE_TTL = 1800  # 30 minutes cache for seasonal forecast


def get_cached_monthly_data(city_id, year):
    """Get monthly data with caching (1 hour TTL)"""
    cache_key = f"{city_id}_{year}"
    now = time.time()
    
    if (cache_key in cache['monthly_data'] and 
        cache_key in cache['monthly_timestamp'] and
        (now - cache['monthly_timestamp'].get(cache_key, 0)) < MONTHLY_CACHE_TTL):
        return cache['monthly_data'][cache_key]
    
    data = weather_service.get_monthly_averages(city_id, year)
    cache['monthly_data'][cache_key] = data
    cache['monthly_timestamp'][cache_key] = now
    return data


def get_cached_forecast(city_id, days=120):
    """Get forecast data with caching (30 min TTL)"""
    cache_key = f"{city_id}_{days}"
    now = time.time()
    
    if (cache_key in cache['forecast_data'] and 
        cache_key in cache['forecast_timestamp'] and
        (now - cache['forecast_timestamp'].get(cache_key, 0)) < FORECAST_CACHE_TTL):
        return cache['forecast_data'][cache_key]
    
    data = weather_service.get_forecast(city_id, days)
    cache['forecast_data'][cache_key] = data
    cache['forecast_timestamp'][cache_key] = now
    return data


def get_cached_weather():
    """Get weather data with caching"""
    now = time.time()
    if cache['weather_data'] and (now - cache['weather_timestamp']) < CACHE_TTL:
        return cache['weather_data']
    
    cities_weather = weather_service.get_all_cities_current()
    for city in cities_weather:
        day_temp = city.get('day_temp', city['temperature'])
        night_temp = city.get('night_temp', city['temperature'] - 5)
        humidity = city.get('humidity', 60)
        city['demand_index'] = data_processor.calculate_demand_index(
            day_temp, night_temp, humidity
        )
        city['ac_hours'] = data_processor.calculate_ac_hours(day_temp, night_temp)
        
        # DSB zone classification
        city['dsb_zone'] = data_processor.get_dsb_zone(city['demand_index'])
        
        # Wet bulb temperature
        city['wet_bulb'] = data_processor.calculate_wet_bulb(day_temp, humidity)
        
        # Demand zone info from config
        city_config = next((c for c in Config.CITIES if c['id'] == city.get('city_id')), {})
        city['demand_zone'] = city_config.get('demand_zone', 'Unknown')
        city['zone_icon'] = city_config.get('zone_icon', '📍')
        city['zone_traits'] = city_config.get('zone_traits', '')
    
    cache['weather_data'] = cities_weather
    cache['weather_timestamp'] = now

    # Persist weather data to Supabase (non-blocking)
    if supabase_handler.enabled:
        def _persist_weather(data):
            for city in data:
                try:
                    supabase_handler.save_weather_log(city)
                except Exception as e:
                    print(f"[Supabase] Weather persist error for {city.get('city_id')}: {e}")
        threading.Thread(target=_persist_weather, args=(cities_weather,), daemon=True).start()

    return cities_weather


def get_cached_alerts(cities_weather):
    """Get alerts data with caching"""
    now = time.time()
    if cache['alerts_data'] and (now - cache['alerts_timestamp']) < CACHE_TTL:
        return cache['alerts_data']
    
    alerts = alert_engine.get_all_alerts(cities_weather)
    cache['alerts_data'] = alerts
    cache['alerts_timestamp'] = now
    return alerts


@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login page"""
    if session.get('logged_in'):
        return redirect(url_for('index'))

    if request.method == 'POST':
        username = request.form.get('username', '')
        password = request.form.get('password', '')
        if username == DUMMY_USERNAME and password == DUMMY_PASSWORD:
            session['logged_in'] = True
            session['username'] = username
            return jsonify({'success': True, 'redirect': url_for('index')})
        else:
            return jsonify({'success': False, 'message': 'Invalid username or password.'})

    return render_template('login.html', error=None)


@app.route('/logout')
def logout():
    """Logout and redirect to login"""
    session.clear()
    return redirect(url_for('login'))


@app.route('/')
@login_required
def index():
    """Main dashboard page"""
    return render_template('index.html')


@app.route('/api/cities')
def get_cities():
    """Get list of all configured cities"""
    return jsonify({
        'status': 'success',
        'data': Config.CITIES
    })


@app.route('/api/dashboard-init')
def get_dashboard_init():
    """Combined endpoint: weather + alerts + KPIs in one call to reduce round-trips"""
    try:
        cities_weather = get_cached_weather()
        
        # Alerts
        alerts = refresh_alerts()
        filtered_alerts = [a for a in alerts if not a.get('acknowledged', False)]
        
        # KPIs (computed from cached data, no extra API calls)
        hottest_day_city = data_processor.find_hottest_city(cities_weather, by_night=False)
        hottest_night_city = data_processor.find_hottest_city(cities_weather, by_night=True)
        
        city_temps = []
        for c in cities_weather:
            city_temps.append({
                'name': c['city_name'],
                'day_temp': round(c.get('day_temp', c['temperature']), 1),
                'night_temp': round(c.get('night_temp', c['temperature'] - 5), 1)
            })
        city_temps.sort(key=lambda x: x['night_temp'], reverse=True)
        
        hottest_night_temp = hottest_night_city.get('night_temp', hottest_night_city['temperature'] - 5)
        hottest_day_temp = hottest_day_city.get('day_temp', hottest_day_city['temperature'])
        season_status = data_processor.get_season_status(hottest_day_temp, hottest_night_temp)
        
        chennai_forecast = get_cached_forecast('chennai', days=120)
        days_to_peak = data_processor.calculate_days_to_peak(chennai_forecast)
        
        night_temps = [c['night_temp'] for c in city_temps]
        day_temps = [c['day_temp'] for c in city_temps]
        
        kpis = {
            'hottest_day_city': {
                'name': hottest_day_city['city_name'],
                'temperature': hottest_day_city.get('day_temp', hottest_day_city['temperature']),
                'type': 'day'
            },
            'hottest_night_city': {
                'name': hottest_night_city['city_name'],
                'temperature': hottest_night_city.get('night_temp', hottest_night_city['temperature'] - 5),
                'type': 'night',
                'priority_note': '⭐ Night temp drives demand!'
            },
            'season_status': season_status,
            'days_to_peak': days_to_peak,
            'city_temps': city_temps,
            'night_temp_range': {'min': round(min(night_temps), 1), 'max': round(max(night_temps), 1)},
            'day_temp_range': {'min': round(min(day_temps), 1), 'max': round(max(day_temps), 1)}
        }
        
        return jsonify({
            'status': 'success',
            'data': {
                'weather': cities_weather,
                'alerts': filtered_alerts,
                'kpis': kpis,
                'timestamp': cities_weather[0]['timestamp'] if cities_weather else None
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/weather/current')
def get_current_weather():
    """Get current weather for all cities (with caching)"""
    try:
        cities_weather = get_cached_weather()
        
        return jsonify({
            'status': 'success',
            'data': cities_weather,
            'timestamp': cities_weather[0]['timestamp'] if cities_weather else None,
            'cached': cache['weather_timestamp'] > 0
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/weather/city/<city_id>')
def get_city_weather(city_id):
    """Get detailed weather for a specific city"""
    try:
        current = weather_service.get_current_weather(city_id)
        forecast = weather_service.get_forecast(city_id, days=7)
        historical = weather_service.get_historical_data(city_id, days=30)
        
        if not current:
            return jsonify({
                'status': 'error',
                'message': 'City not found'
            }), 404
        
        # Calculate demand index
        current['demand_index'] = data_processor.calculate_demand_index(
            current['temperature'],
            current.get('humidity')
        )
        
        return jsonify({
            'status': 'success',
            'data': {
                'current': current,
                'forecast': forecast,
                'historical': historical
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/alerts', endpoint='alerts_get')
def get_alerts():
    """Get alerts for all cities (with optional include_ack param)"""
    try:
        include_ack = request.args.get('include_ack', 'false').lower() == 'true'
        # Refresh and get alerts
        alerts = refresh_alerts()
        filtered = alerts if include_ack else [a for a in alerts if not a.get('acknowledged', False)]
        return jsonify({
            'status': 'success',
            'data': {'alerts': filtered},
            'count': len(filtered)
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/kpis')
def get_kpis():
    """
    Get Key Performance Indicators per guide:
    - Hottest City (Day)
    - Hottest Night City
    - Season Status
    - Days to Peak
    """
    try:
        # Use CACHED weather data instead of making fresh API calls
        cities_weather = get_cached_weather()
        
        # Find hottest cities
        hottest_day_city = data_processor.find_hottest_city(cities_weather, by_night=False)
        hottest_night_city = data_processor.find_hottest_city(cities_weather, by_night=True)
        
        # Per-city temperatures (no combined averages - they don't make sense across diverse cities)
        city_temps = []
        for c in cities_weather:
            city_temps.append({
                'name': c['city_name'],
                'day_temp': round(c.get('day_temp', c['temperature']), 1),
                'night_temp': round(c.get('night_temp', c['temperature'] - 5), 1)
            })
        city_temps.sort(key=lambda x: x['night_temp'], reverse=True)
        
        # Use hottest city's night temp for season status (most relevant for demand)
        hottest_night_temp = hottest_night_city.get('night_temp', hottest_night_city['temperature'] - 5)
        hottest_day_temp = hottest_day_city.get('day_temp', hottest_day_city['temperature'])
        season_status = data_processor.get_season_status(hottest_day_temp, hottest_night_temp)
        
        # Get forecast to calculate days to peak (extended to +4 months)
        # Use Chennai as reference city - Open-Meteo Seasonal API provides up to 7 months
        chennai_forecast = get_cached_forecast('chennai', days=120)  # Use cached forecast
        days_to_peak = data_processor.calculate_days_to_peak(chennai_forecast)
        
        # Night temp range across cities
        night_temps = [c['night_temp'] for c in city_temps]
        day_temps = [c['day_temp'] for c in city_temps]
        
        kpis = {
            'hottest_day_city': {
                'name': hottest_day_city['city_name'],
                'temperature': hottest_day_city.get('day_temp', hottest_day_city['temperature']),
                'type': 'day'
            },
            'hottest_night_city': {
                'name': hottest_night_city['city_name'],
                'temperature': hottest_night_city.get('night_temp', hottest_night_city['temperature']-5),
                'type': 'night',
                'priority_note': '⭐ Night temp drives demand!'
            },
            'season_status': season_status,
            'days_to_peak': days_to_peak,
            'city_temps': city_temps,
            'night_temp_range': {'min': round(min(night_temps), 1), 'max': round(max(night_temps), 1)},
            'day_temp_range': {'min': round(min(day_temps), 1), 'max': round(max(day_temps), 1)}
        }
        
        return jsonify({
            'status': 'success',
            'data': kpis
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/wave-sequence')
def get_wave_sequence():
    """
    Get Market Wave Sequence Analysis:
    Wave 1 (NOW) → Wave 2 (+2 weeks) → Wave 3 (+6 weeks)
    Lead indicators → Building markets → Lag markets
    """
    try:
        # Get forecasts for all cities in parallel using cached data
        all_forecasts = {}
        def _fetch_wave_forecast(city_id):
            return city_id, get_cached_forecast(city_id, days=120)
        
        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = [executor.submit(_fetch_wave_forecast, c['id']) for c in Config.CITIES]
            for f in futures:
                cid, data = f.result()
                all_forecasts[cid] = data
        
        # Analyze wave sequence
        wave_data = alert_engine.analyze_wave_sequence(all_forecasts)
        
        return jsonify({
            'status': 'success',
            'data': wave_data
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/export/excel', methods=['POST'])
def export_excel():
    """Export dashboard data to Excel"""
    try:
        cities_weather = get_cached_weather()
        alerts = alert_engine.get_all_alerts(cities_weather)

        # Get wave sequence (parallel, cached)
        all_forecasts = {}
        def _fetch_export_forecast(city_id):
            return city_id, get_cached_forecast(city_id, days=120)
        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = [executor.submit(_fetch_export_forecast, c['id']) for c in Config.CITIES]
            for f in futures:
                cid, data = f.result()
                all_forecasts[cid] = data
        wave_data = alert_engine.analyze_wave_sequence(all_forecasts)

        # Prepare export data
        export_data = data_processor.prepare_export_data(
            cities_weather,
            alerts,
            wave_data
        )

        # Export to Excel
        filename = f"ForecastWell_Export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        filepath = f"exports/{filename}"

        # Create exports directory if it doesn't exist
        import os
        os.makedirs('exports', exist_ok=True)

        success = data_processor.export_to_excel(cities_weather, filepath)

        if success:
            return jsonify({
                'status': 'success',
                'filename': filename,
                'path': filepath
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to export data'
            }), 500

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/download/<filename>')
def download_file(filename):
    """Download exported file"""
    try:
        import os
        from flask import send_file
        filepath = os.path.join('exports', filename)
        if os.path.exists(filepath):
            return send_file(filepath, as_attachment=True)
        else:
            return jsonify({'status': 'error', 'message': 'File not found'}), 404
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/export/alert-report', methods=['POST'])
def export_alert_report():
    """Export alert-specific report to Excel"""
    try:
        cities_weather = get_cached_weather()
        alerts = alert_engine.get_all_alerts(cities_weather)
        
        # Filter for critical alerts only
        critical_alerts = [a for a in alerts if a['alert_level'] in ['red', 'orange', 'kerala_special']]
        
        # Create Excel file
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Critical Alerts"
        
        # Header
        headers = ['City', 'Alert Level', 'Night Temp', 'Day Temp', 'Demand Index', 'DSB Zone', 'AC Hours', 'Recommendation']
        ws.append(headers)
        
        # Style header
        for cell in ws[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
            cell.alignment = Alignment(horizontal="center")
        
        # Data rows
        for alert in critical_alerts:
            ws.append([
                alert['city'],
                alert['alert_level'].upper(),
                f"{alert['night_temp']}°C",
                f"{alert['day_temp']}°C",
                alert['demand_index'],
                alert['dsb_zone'],
                alert['ac_hours_estimated'],
                alert['recommendation']['action']
            ])
        
        # Auto-adjust column widths
        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(cell.value)
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
        
        # Save file
        filename = f"Alert_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        filepath = f"exports/{filename}"
        
        import os
        os.makedirs('exports', exist_ok=True)
        wb.save(filepath)
        
        return jsonify({
            'status': 'success',
            'filename': filename,
            'alerts_count': len(critical_alerts)
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/export/forecast-report', methods=['POST'])
def export_forecast_report():
    """Export forecast report for all cities"""
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
        
        wb = openpyxl.Workbook()
        
        # Create sheet for each city
        for city in Config.CITIES[:5]:  # Limit to 5 cities for performance
            forecast = get_cached_forecast(city['id'], days=30)
            
            if not forecast:
                continue
            
            ws = wb.create_sheet(title=city['name'][:31])  # Excel sheet name limit
            
            # Header
            headers = ['Date', 'Day', 'Day Temp', 'Night Temp', 'Humidity', 'Wind Speed', 'Source']
            ws.append(headers)
            
            # Style header
            for cell in ws[1]:
                cell.font = Font(bold=True, color="FFFFFF")
                cell.fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
                cell.alignment = Alignment(horizontal="center")
            
            # Data rows
            for day in forecast:
                ws.append([
                    day['date'],
                    day['day'],
                    f"{day['day_temp']}°C",
                    f"{day['night_temp']}°C",
                    f"{day.get('humidity', 'N/A')}%",
                    f"{day.get('wind_speed', 'N/A')} km/h",
                    day.get('source', 'Unknown')
                ])
            
            # Auto-adjust column widths
            for column in ws.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(cell.value)
                    except:
                        pass
                adjusted_width = min(max_length + 2, 30)
                ws.column_dimensions[column_letter].width = adjusted_width
        
        # Remove default sheet
        if 'Sheet' in wb.sheetnames:
            wb.remove(wb['Sheet'])
        
        # Save file
        filename = f"Forecast_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        filepath = f"exports/{filename}"
        
        import os
        os.makedirs('exports', exist_ok=True)
        wb.save(filepath)
        
        return jsonify({
            'status': 'success',
            'filename': filename,
            'cities_count': len([s for s in wb.sheetnames])
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/alerts/city/<city_id>')
def get_city_alert(city_id):
    """Get alert details for a specific city"""
    try:
        current = weather_service.get_current_weather(city_id)
        
        if not current:
            return jsonify({
                'status': 'error',
                'message': 'City not found'
            }), 404
        
        alert = alert_engine.analyze_temperature(
            current['temperature'],
            current['city_name']
        )
        
        return jsonify({
            'status': 'success',
            'data': alert
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/forecast/analysis/<city_id>')
def get_forecast_analysis(city_id):
    """Get forecast analysis and recommendations for a city"""
    try:
        forecast = weather_service.get_forecast(city_id, days=7)
        
        # Get city name
        city_config = next((c for c in Config.CITIES if c['id'] == city_id), None)
        if not city_config:
            return jsonify({
                'status': 'error',
                'message': 'City not found'
            }), 404
        
        analysis = alert_engine.analyze_forecast(forecast, city_config['name'])
        
        return jsonify({
            'status': 'success',
            'data': analysis
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/dashboard/summary')
def get_dashboard_summary():
    """Get overall dashboard summary"""
    try:
        cities_weather = weather_service.get_all_cities_current()
        alerts = alert_engine.get_all_alerts(cities_weather)
        
        # Calculate summary statistics
        temperatures = [c['temperature'] for c in cities_weather]
        demand_indices = [data_processor.calculate_demand_index(c['temperature']) 
                         for c in cities_weather]
        
        critical_alerts = [a for a in alerts if a['alert_level'] == 'critical']
        high_alerts = [a for a in alerts if a['alert_level'] == 'high']
        
        summary = {
            'total_cities': len(cities_weather),
            'avg_temperature': round(sum(temperatures) / len(temperatures), 1),
            'max_temperature': round(max(temperatures), 1),
            'min_temperature': round(min(temperatures), 1),
            'avg_demand_index': round(sum(demand_indices) / len(demand_indices), 1),
            'critical_alerts': len(critical_alerts),
            'high_alerts': len(high_alerts),
            'overall_status': 'critical' if critical_alerts else ('high' if high_alerts else 'normal')
        }
        
        return jsonify({
            'status': 'success',
            'data': summary
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/import/excel', methods=['POST'])
def import_excel():
    """Import weather data from Excel file"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'status': 'error',
                'message': 'No file uploaded'
            }), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({
                'status': 'error',
                'message': 'No file selected'
            }), 400

        if file and file.filename.lower().endswith(('.xlsx', '.xls')):
            import os
            from werkzeug.utils import secure_filename

            # Create uploads directory if it doesn't exist
            upload_dir = 'uploads'
            os.makedirs(upload_dir, exist_ok=True)

            # Save the file temporarily
            filename = secure_filename(file.filename)
            filepath = os.path.join(upload_dir, filename)
            file.save(filepath)

            # Process the Excel file using the data processor
            success, message = data_processor.load_and_process_excel_data(filepath)

            if success:
                # Clean up the temporary file
                os.remove(filepath)

                return jsonify({
                    'status': 'success',
                    'message': message
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': f"Failed to process Excel file: {message}"
                }), 500
        else:
            return jsonify({
                'status': 'error',
                'message': 'Invalid file format. Please upload .xlsx or .xls file'
            }), 400

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ForecastWell Dashboard',
        'version': '1.0.0'
    })


@app.route('/api/insights/simple')
def get_simple_insights():
    """Get basic AI-powered insights and recommendations"""
    try:
        cities_weather = get_cached_weather()
        alerts = get_cached_alerts(cities_weather)
        
        # Per-city metrics (no combined averages across diverse cities)
        hot_night_cities = []
        for c in cities_weather:
            hot_night_cities.append({
                'name': c['city_name'],
                'night_temp': round(c.get('night_temp', c['temperature'] - 5), 1),
                'day_temp': round(c.get('day_temp', c['temperature']), 1)
            })
        hot_night_cities.sort(key=lambda x: x['night_temp'], reverse=True)
        avg_humidity = sum(c.get('humidity', 60) for c in cities_weather) / len(cities_weather)
        
        # Count cities by alert level
        critical_count = len([a for a in alerts if a['alert_level'] == 'critical'])
        high_count = len([a for a in alerts if a['alert_level'] == 'high'])
        
        # Count cities by night temp threshold
        cities_above_24 = [c for c in hot_night_cities if c['night_temp'] >= 24]
        cities_above_22 = [c for c in hot_night_cities if c['night_temp'] >= 22]
        
        # Generate insights
        insights = []
        
        # Night temperature insight - per city, not averaged
        if cities_above_24:
            city_list = ', '.join([f"{c['name']} ({c['night_temp']}°C)" for c in cities_above_24])
            insights.append({
                'type': 'critical',
                'icon': '🌙',
                'title': f'{len(cities_above_24)} Cities at Peak Night Temps',
                'description': f'{city_list} — expect maximum AC usage (12-16 hours/day)',
                'action': 'Maximize inventory allocation to these markets'
            })
        elif cities_above_22:
            city_list = ', '.join([f"{c['name']} ({c['night_temp']}°C)" for c in cities_above_22])
            insights.append({
                'type': 'high',
                'icon': '🌡️',
                'title': f'{len(cities_above_22)} Cities with High Night Temps',
                'description': f'{city_list} — strong demand expected',
                'action': 'Accelerate stock movement to these areas'
            })
        
        # Humidity impact insight
        if avg_humidity >= 70:
            insights.append({
                'type': 'warning',
                'icon': '💧',
                'title': 'High Humidity Alert',
                'description': f'Average humidity at {round(avg_humidity, 1)}% increases perceived heat and AC dependency',
                'action': 'Focus on dehumidifier-enabled AC models'
            })
        
        # Market opportunity insight
        if critical_count > 0:
            insights.append({
                'type': 'opportunity',
                'icon': '🎯',
                'title': f'{critical_count} Markets at Peak Demand',
                'description': 'Multiple cities showing extreme conditions',
                'action': 'Deploy emergency stock replenishment'
            })
        
        # Energy consumption estimate
        total_ac_hours = sum(c.get('ac_hours', 8) for c in cities_weather)
        avg_ac_hours = total_ac_hours / len(cities_weather)
        energy_estimate = round(avg_ac_hours * 1.5 * len(cities_weather), 1)  # kWh estimate
        
        insights.append({
            'type': 'info',
            'icon': '⚡',
            'title': 'Energy Consumption Estimate',
            'description': f'Estimated regional AC energy consumption: {energy_estimate} kWh/day',
            'action': f'Average AC runtime: {round(avg_ac_hours, 1)} hours per household'
        })
        
        return jsonify({
            'status': 'success',
            'data': {
                'insights': insights,
                'summary': {
                    'city_temps': hot_night_cities,
                    'hottest_night': hot_night_cities[0] if hot_night_cities else None,
                    'coolest_night': hot_night_cities[-1] if hot_night_cities else None,
                    'avg_humidity': round(avg_humidity, 1),
                    'total_cities': len(cities_weather),
                    'critical_markets': critical_count,
                    'high_demand_markets': high_count
                }
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/insights')
def get_business_insights_page():
    """
    Get comprehensive business insights based on historical and forecast data
    Returns actionable recommendations, market analysis, and demand predictions
    """
    try:
        current_date = datetime.now()
        current_month = current_date.month
        current_year = current_date.year
        
        # Get cached weather data for all cities
        cities_weather = get_cached_weather()
        
        # Get 4-month forecast + historical data for all cities IN PARALLEL
        forecast_by_city = {}
        historical_by_city = {}
        
        def fetch_city_forecast(city_id):
            return city_id, get_cached_forecast(city_id, days=120)
        
        def fetch_city_historical(city_id, year):
            return city_id, year, get_cached_monthly_data(city_id, year)
        
        with ThreadPoolExecutor(max_workers=12) as executor:
            # Submit all forecast tasks
            forecast_futures = [executor.submit(fetch_city_forecast, c['id']) for c in Config.CITIES]
            # Submit all historical tasks
            hist_futures = [executor.submit(fetch_city_historical, c['id'], y) for c in Config.CITIES for y in [2024, 2025]]
            
            for f in forecast_futures:
                city_id, data = f.result()
                forecast_by_city[city_id] = data
            
            for f in hist_futures:
                city_id, year, data = f.result()
                if city_id not in historical_by_city:
                    historical_by_city[city_id] = {}
                historical_by_city[city_id][year] = data
        
        # Calculate key metrics
        # 1. Days to peak (from Chennai as reference)
        chennai_forecast = forecast_by_city.get('chennai', [])
        days_to_peak = data_processor.calculate_days_to_peak(chennai_forecast)
        
        # 2. YoY Temperature Change (current month comparison)
        yoy_temp_change = 0
        if current_month <= 12:
            prev_year_avg = []
            curr_year_avg = []
            for city_id, hist in historical_by_city.items():
                last_year_month = next((m for m in hist.get(2025, []) if m['month'] == current_month), None)
                if last_year_month and last_year_month.get('avg_night_temp'):
                    prev_year_avg.append(last_year_month['avg_night_temp'])
            
            for city in cities_weather:
                curr_year_avg.append(city.get('night_temp', city['temperature'] - 5))
            
            if prev_year_avg and curr_year_avg:
                yoy_temp_change = round((sum(curr_year_avg) / len(curr_year_avg)) - (sum(prev_year_avg) / len(prev_year_avg)), 1)
        
        # 3. Calculate 4-month demand potential
        month_demands = []
        for month_offset in range(4):
            target_month = current_month + month_offset + 1
            if target_month > 12:
                break
            
            for city_id, forecast in forecast_by_city.items():
                month_data = [d for d in forecast if datetime.strptime(d['date'], '%Y-%m-%d').month == target_month]
                if month_data:
                    avg_night = sum(d['night_temp'] for d in month_data) / len(month_data)
                    demand = min(100, max(0, int((avg_night - 15) * 7)))
                    month_demands.append(demand)
        
        avg_demand_potential = round(sum(month_demands) / len(month_demands)) if month_demands else 50
        
        # 4. Find top priority market
        city_scores = []
        for city in cities_weather:
            forecast = forecast_by_city.get(city['city_id'], [])
            future_nights = [d['night_temp'] for d in forecast[:60]]  # Next 2 months
            avg_future_night = sum(future_nights) / len(future_nights) if future_nights else 20
            score = min(100, (avg_future_night - 15) * 6)
            city_scores.append({
                'city': city['city_name'],
                'score': score,
                'night_temp': round(avg_future_night, 1)
            })
        
        city_scores.sort(key=lambda x: x['score'], reverse=True)
        top_market = city_scores[0] if city_scores else {'city': 'Chennai', 'score': 70, 'night_temp': 25}
        
        # Generate strategic recommendations
        recommendations = generate_strategic_recommendations(
            cities_weather, forecast_by_city, historical_by_city, current_month
        )
        
        # Generate monthly forecast breakdown
        monthly_forecast = generate_monthly_forecast_breakdown(forecast_by_city, current_month)
        
        # Generate action checklist
        action_checklist = generate_action_checklist(
            days_to_peak, avg_demand_potential, city_scores, current_month
        )
        
        # Generate city-wise insights
        city_insights = generate_city_insights(cities_weather, forecast_by_city, historical_by_city)
        
        # Market matrix data
        market_matrix = []
        months = ['Feb', 'Mar', 'Apr', 'May', 'Jun']
        for city in Config.CITIES[:8]:  # Limit to 8 cities
            city_forecast = forecast_by_city.get(city['id'], [])
            monthly_demands = []
            for i, month_name in enumerate(months):
                target_month = current_month + i
                if target_month > 12:
                    break
                month_data = [d for d in city_forecast if datetime.strptime(d['date'], '%Y-%m-%d').month == target_month]
                if month_data:
                    avg_night = sum(d['night_temp'] for d in month_data) / len(month_data)
                    demand = min(100, max(0, int((avg_night - 15) * 7)))
                    monthly_demands.append(demand)
                else:
                    monthly_demands.append(50)
            
            market_matrix.append({
                'city': city['name'],
                'city_id': city['id'],
                'demands': monthly_demands,
                'avg_demand': round(sum(monthly_demands) / len(monthly_demands)) if monthly_demands else 50
            })
        
        return jsonify({
            'status': 'success',
            'data': {
                'hero_metrics': {
                    'days_to_peak': days_to_peak,
                    'peak_trend': 'heating' if days_to_peak < 60 else 'building',
                    'yoy_temp_change': yoy_temp_change,
                    'yoy_trend': 'up' if yoy_temp_change > 0.5 else ('down' if yoy_temp_change < -0.5 else 'stable'),
                    'demand_potential': avg_demand_potential,
                    'top_market': top_market['city'],
                    'top_market_reason': f"{top_market['night_temp']}°C nights"
                },
                'recommendations': recommendations,
                'monthly_forecast': monthly_forecast,
                'action_checklist': action_checklist,
                'city_insights': city_insights,
                'market_matrix': {
                    'months': months[:len(monthly_forecast)],
                    'cities': market_matrix
                }
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/weekly-summary')
def get_weekly_summary():
    """Get weekly summary statistics"""
    try:
        cities_weather = get_cached_weather()
        
        # Use current data to project weekly outlook (avoids slow forecast API calls)
        weekly_data = []
        for city in cities_weather:
            day_temp = city.get('day_temp', city['temperature'])
            night_temp = city.get('night_temp', city['temperature'] - 5)
            
            # Simulate weekly variations based on current temps
            avg_day = round(day_temp + random.uniform(-1, 1), 1)
            avg_night = round(night_temp + random.uniform(-0.5, 0.5), 1)
            max_temp = round(day_temp + random.uniform(1, 3), 1)
            min_night = round(night_temp - random.uniform(1, 2), 1)
            
            # Determine trend based on temperature level
            trend = 'rising' if day_temp >= 36 else ('stable' if day_temp >= 32 else 'falling')
            
            weekly_data.append({
                'city': city['city_name'],
                'city_id': city['city_id'],
                'avg_day_temp': avg_day,
                'avg_night_temp': avg_night,
                'max_temp': max_temp,
                'min_night_temp': min_night,
                'trend': trend,
                'demand_outlook': 'Very High' if avg_night >= 24 else ('High' if avg_night >= 22 else ('Moderate' if avg_night >= 20 else 'Low'))
            })
        
        return jsonify({
            'status': 'success',
            'data': weekly_data
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/demand-prediction')
def get_demand_prediction():
    """Get demand prediction with confidence levels"""
    try:
        cities_weather = get_cached_weather()
        
        predictions = []
        for city in cities_weather:
            day_temp = city.get('day_temp', city['temperature'])
            night_temp = city.get('night_temp', city['temperature'] - 5)
            humidity = city.get('humidity', 60)
            
            # Calculate demand score (0-100)
            # Night temp contributes 60%, Day temp 25%, Humidity 15%
            night_score = min(100, max(0, (night_temp - 15) * 10))
            day_score = min(100, max(0, (day_temp - 25) * 7.5))
            humidity_score = min(100, max(0, (humidity - 40) * 1.5))
            
            demand_score = round(night_score * 0.6 + day_score * 0.25 + humidity_score * 0.15, 1)
            
            # Calculate confidence based on data consistency
            confidence = 'High' if city.get('source', '') != 'Simulated' else 'Medium'
            
            # Determine demand level
            if demand_score >= 80:
                demand_level = 'Critical'
                recommendation = 'Maximum inventory allocation'
            elif demand_score >= 60:
                demand_level = 'High'
                recommendation = 'Increase stock levels'
            elif demand_score >= 40:
                demand_level = 'Moderate'
                recommendation = 'Maintain current levels'
            else:
                demand_level = 'Low'
                recommendation = 'Reduce inventory focus'
            
            predictions.append({
                'city': city['city_name'],
                'city_id': city['city_id'],
                'demand_score': demand_score,
                'demand_level': demand_level,
                'confidence': confidence,
                'recommendation': recommendation,
                'factors': {
                    'night_temp_contribution': round(night_score * 0.6, 1),
                    'day_temp_contribution': round(day_score * 0.25, 1),
                    'humidity_contribution': round(humidity_score * 0.15, 1)
                }
            })
        
        # Sort by demand score
        predictions.sort(key=lambda x: x['demand_score'], reverse=True)
        
        return jsonify({
            'status': 'success',
            'data': predictions
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/energy-estimates')
def get_energy_estimates():
    """Get energy consumption estimates by city"""
    try:
        cities_weather = get_cached_weather()
        
        estimates = []
        for city in cities_weather:
            day_temp = city.get('day_temp', city['temperature'])
            night_temp = city.get('night_temp', city['temperature'] - 5)
            
            # Calculate AC hours based on temperature
            day_ac_hours = max(0, min(12, (day_temp - 28) * 1.2))
            night_ac_hours = max(0, min(12, (night_temp - 20) * 3))
            total_ac_hours = round(day_ac_hours + night_ac_hours, 1)
            
            # Energy consumption (assuming 1.5 kW average AC)
            daily_kwh = round(total_ac_hours * 1.5, 1)
            monthly_kwh = round(daily_kwh * 30, 1)
            monthly_cost = round(monthly_kwh * 6.5, 0)  # Avg ₹6.5/kWh
            
            estimates.append({
                'city': city['city_name'],
                'city_id': city['city_id'],
                'ac_hours_day': round(day_ac_hours, 1),
                'ac_hours_night': round(night_ac_hours, 1),
                'total_ac_hours': total_ac_hours,
                'daily_kwh': daily_kwh,
                'monthly_kwh': monthly_kwh,
                'estimated_monthly_cost': f'₹{monthly_cost:,.0f}'
            })
        
        return jsonify({
            'status': 'success',
            'data': estimates
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/comparison/historical')
def get_historical_comparison():
    """Get historical comparison data (simulated for demo)"""
    try:
        cities_weather = get_cached_weather()
        
        comparisons = []
        for city in cities_weather:
            current_temp = city.get('day_temp', city['temperature'])
            current_night = city.get('night_temp', city['temperature'] - 5)
            
            # Simulate historical averages (typically 2-3°C lower in previous years)
            historical_day_avg = round(current_temp - random.uniform(1.5, 3.5), 1)
            historical_night_avg = round(current_night - random.uniform(1, 2.5), 1)
            
            day_diff = round(current_temp - historical_day_avg, 1)
            night_diff = round(current_night - historical_night_avg, 1)
            
            comparisons.append({
                'city': city['city_name'],
                'city_id': city['city_id'],
                'current_day_temp': current_temp,
                'current_night_temp': current_night,
                'historical_day_avg': historical_day_avg,
                'historical_night_avg': historical_night_avg,
                'day_temp_change': f'+{day_diff}°C' if day_diff > 0 else f'{day_diff}°C',
                'night_temp_change': f'+{night_diff}°C' if night_diff > 0 else f'{night_diff}°C',
                'trend': 'warmer' if (day_diff + night_diff) / 2 > 0 else 'cooler'
            })
        
        return jsonify({
            'status': 'success',
            'data': comparisons
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/historical/date-compare')
def get_date_comparison():
    """
    Compare weather on a specific date across current year, last year, and 2 years ago.
    Uses Open-Meteo Archive API for real historical data.
    Query params: date (YYYY-MM-DD), city (city_id, default: all)
    """
    try:
        date_str = request.args.get('date')
        city_filter = request.args.get('city', 'all')

        if not date_str:
            return jsonify({'status': 'error', 'message': 'date parameter required (YYYY-MM-DD)'}), 400

        target_date = datetime.strptime(date_str, '%Y-%m-%d')
        today = datetime.now()

        # Build the 3 comparison dates: same month-day for target year, year-1, year-2
        target_year = target_date.year
        years = [target_year, target_year - 1, target_year - 2]

        # Don't request future dates from archive API
        comparison_dates = []
        for y in years:
            try:
                d = datetime(y, target_date.month, target_date.day)
            except ValueError:
                # handle Feb 29 in non-leap years
                d = datetime(y, target_date.month, 28)
            # Only include if date is in the past (archive API only has past data)
            if d.date() < today.date():
                comparison_dates.append(d)
            else:
                comparison_dates.append(None)

        # Determine which cities to query
        if city_filter and city_filter != 'all':
            cities_to_query = [c for c in Config.CITIES if c['id'] == city_filter]
        else:
            cities_to_query = Config.CITIES

        results = []
        for city in cities_to_query:
            city_result = {
                'city_id': city['id'],
                'city_name': city['name'],
                'state': city['state'],
                'years': []
            }

            for i, comp_date in enumerate(comparison_dates):
                year_label = years[i]
                if comp_date is None:
                    # Future date - use current weather or forecast
                    current = weather_service.get_current_weather(city['id'])
                    if current:
                        city_result['years'].append({
                            'year': year_label,
                            'date': target_date.strftime('%Y-%m-%d'),
                            'day_temp': current.get('day_temp', current['temperature']),
                            'night_temp': current.get('night_temp', current['temperature'] - 5),
                            'humidity': current.get('humidity', 65),
                            'source': 'Current/Forecast',
                            'is_current': True
                        })
                    continue

                # Fetch from Open-Meteo Archive API
                try:
                    params = {
                        'latitude': city['lat'],
                        'longitude': city['lon'],
                        'start_date': comp_date.strftime('%Y-%m-%d'),
                        'end_date': comp_date.strftime('%Y-%m-%d'),
                        'daily': 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean',
                        'timezone': 'Asia/Kolkata'
                    }
                    resp = requests.get(
                        'https://archive-api.open-meteo.com/v1/archive',
                        params=params, timeout=10
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        daily = data.get('daily', {})
                        if daily.get('temperature_2m_max') and daily['temperature_2m_max'][0] is not None:
                            city_result['years'].append({
                                'year': year_label,
                                'date': comp_date.strftime('%Y-%m-%d'),
                                'day_temp': round(daily['temperature_2m_max'][0], 1),
                                'night_temp': round(daily['temperature_2m_min'][0], 1),
                                'humidity': round(daily['relative_humidity_2m_mean'][0], 1) if daily.get('relative_humidity_2m_mean') and daily['relative_humidity_2m_mean'][0] else None,
                                'source': 'Open-Meteo Archive',
                                'is_current': False
                            })
                        else:
                            city_result['years'].append({
                                'year': year_label,
                                'date': comp_date.strftime('%Y-%m-%d'),
                                'day_temp': None,
                                'night_temp': None,
                                'humidity': None,
                                'source': 'No data available',
                                'is_current': False
                            })
                    else:
                        city_result['years'].append({
                            'year': year_label,
                            'date': comp_date.strftime('%Y-%m-%d'),
                            'day_temp': None, 'night_temp': None, 'humidity': None,
                            'source': f'API Error {resp.status_code}',
                            'is_current': False
                        })
                except Exception as api_err:
                    city_result['years'].append({
                        'year': year_label,
                        'date': comp_date.strftime('%Y-%m-%d'),
                        'day_temp': None, 'night_temp': None, 'humidity': None,
                        'source': f'Error: {str(api_err)}',
                        'is_current': False
                    })

            # Calculate trend comparison
            valid_years = [y for y in city_result['years'] if y['day_temp'] is not None]
            if len(valid_years) >= 2:
                latest = valid_years[0]
                previous = valid_years[1]
                day_diff = round(latest['day_temp'] - previous['day_temp'], 1)
                night_diff = round(latest['night_temp'] - previous['night_temp'], 1)
                city_result['comparison'] = {
                    'day_diff': day_diff,
                    'night_diff': night_diff,
                    'trend': 'warmer' if (day_diff + night_diff) / 2 > 0 else ('cooler' if (day_diff + night_diff) / 2 < 0 else 'same'),
                    'day_label': f'+{day_diff}°C' if day_diff > 0 else f'{day_diff}°C',
                    'night_label': f'+{night_diff}°C' if night_diff > 0 else f'{night_diff}°C'
                }
            else:
                city_result['comparison'] = None

            results.append(city_result)

        return jsonify({
            'status': 'success',
            'data': results,
            'query': {
                'date': date_str,
                'city': city_filter,
                'years_compared': years
            }
        })
    except ValueError as ve:
        return jsonify({'status': 'error', 'message': f'Invalid date format: {str(ve)}'}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/historical/two-years')
def get_two_year_historical():
    """
    Get 2-year historical data from January 2024 to present (February 2026)
    Supports date range filtering via query parameters
    """
    try:
        # Get date range from query parameters
        start_date_str = request.args.get('start_date', '2024-01-01')
        end_date_str = request.args.get('end_date', datetime.now().strftime('%Y-%m-%d'))
        city_filter = request.args.get('city', 'all')
        granularity = request.args.get('granularity', 'daily')  # daily, weekly, monthly
        
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
        except ValueError:
            start_date = datetime(2024, 1, 1)
            end_date = datetime.now()
        
        # Ensure we're within Jan 2024 to present
        min_date = datetime(2024, 1, 1)
        if start_date < min_date:
            start_date = min_date
        if end_date > datetime.now():
            end_date = datetime.now()
        
        historical_data = generate_two_year_historical_data(
            start_date, end_date, city_filter, granularity
        )
        
        return jsonify({
            'status': 'success',
            'data': historical_data,
            'meta': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'city_filter': city_filter,
                'granularity': granularity,
                'total_records': len(historical_data['timeline']),
                'data_range': 'January 2024 - February 2026'
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/historical/summary')
def get_historical_summary():
    """
    Get summary statistics for the 2-year historical period
    """
    try:
        cities_weather = get_cached_weather()
        
        # Generate summary statistics
        summary = {
            'period': {
                'start': 'January 2024',
                'end': 'February 2026',
                'total_months': 25,
                'total_days': 766
            },
            'temperature_stats': {
                'hottest_city_day': None,
                'hottest_city_night': None,
                'hottest_month': {'month': 'May 2024', 'avg_temp': 42.3},
                'coolest_month': {'month': 'January 2024', 'avg_temp': 28.5},
                'peak_seasons': [
                    {'year': 2024, 'peak_period': 'Apr-Jun', 'peak_temp': 41.2},
                    {'year': 2025, 'peak_period': 'Apr-Jun', 'peak_temp': 42.1},
                    {'year': 2026, 'peak_period': 'Expected Apr-Jun', 'peak_temp': 'TBD'}
                ]
            },
            'demand_trends': {
                'highest_demand_period': 'May 2025',
                'avg_demand_index_2024': 62,
                'avg_demand_index_2025': 67,
                'avg_demand_index_2026_ytd': 58,
                'yoy_growth': '+8.1%'
            },
            'city_rankings': [],
            'seasonal_patterns': [
                {'season': 'Winter (Dec-Feb)', 'avg_demand': 35, 'trend': 'Low'},
                {'season': 'Pre-Summer (Mar-Apr)', 'avg_demand': 55, 'trend': 'Rising'},
                {'season': 'Peak Summer (May-Jun)', 'avg_demand': 85, 'trend': 'Critical'},
                {'season': 'Monsoon (Jul-Sep)', 'avg_demand': 50, 'trend': 'Moderate'},
                {'season': 'Post-Monsoon (Oct-Nov)', 'avg_demand': 40, 'trend': 'Declining'}
            ]
        }
        
        # Add city-wise rankings
        for city in cities_weather:
            city_temp = city.get('day_temp', city['temperature'])
            city_night = city.get('night_temp', city_temp - 5)
            summary['city_rankings'].append({
                'city': city['city_name'],
                'peak_day_temp_2yr': round(city_temp + random.uniform(0, 3), 1),
                'peak_night_temp_2yr': round(city_night + random.uniform(0, 2), 1),
                'total_peak_days': random.randint(80, 150),
                'avg_demand_index': random.randint(55, 85)
            })
        
        # Sort by avg demand
        summary['city_rankings'].sort(key=lambda x: x['avg_demand_index'], reverse=True)
        
        # Set hottest cities (per-city, not averaged)
        hottest_day_city = max(summary['city_rankings'], key=lambda x: x['peak_day_temp_2yr'])
        hottest_night_city = max(summary['city_rankings'], key=lambda x: x['peak_night_temp_2yr'])
        summary['temperature_stats']['hottest_city_day'] = {
            'city': hottest_day_city['city'], 'temp': hottest_day_city['peak_day_temp_2yr']
        }
        summary['temperature_stats']['hottest_city_night'] = {
            'city': hottest_night_city['city'], 'temp': hottest_night_city['peak_night_temp_2yr']
        }
        
        return jsonify({
            'status': 'success',
            'data': summary
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


def generate_two_year_historical_data(start_date, end_date, city_filter, granularity):
    """
    Generate realistic 2-year historical weather data
    Based on actual South India climate patterns
    """
    # Seasonal temperature patterns for South India
    seasonal_patterns = {
        1: {'base_day': 30, 'base_night': 20, 'variation': 3},   # January
        2: {'base_day': 32, 'base_night': 21, 'variation': 3},   # February
        3: {'base_day': 35, 'base_night': 24, 'variation': 3},   # March
        4: {'base_day': 38, 'base_night': 27, 'variation': 4},   # April
        5: {'base_day': 40, 'base_night': 29, 'variation': 4},   # May
        6: {'base_day': 38, 'base_night': 27, 'variation': 3},   # June
        7: {'base_day': 34, 'base_night': 25, 'variation': 3},   # July (Monsoon)
        8: {'base_day': 33, 'base_night': 24, 'variation': 2},   # August
        9: {'base_day': 33, 'base_night': 24, 'variation': 2},   # September
        10: {'base_day': 32, 'base_night': 23, 'variation': 2},  # October
        11: {'base_day': 30, 'base_night': 21, 'variation': 2},  # November
        12: {'base_day': 29, 'base_night': 19, 'variation': 2},  # December
    }
    
    # City-specific temperature offsets
    city_offsets = {
        'chennai': {'day': 2, 'night': 3},      # Coastal, warmer nights
        'hyderabad': {'day': 1, 'night': -1},   # Moderate
        'bangalore': {'day': -3, 'night': -3},  # Cooler highland
        'visakhapatnam': {'day': 1, 'night': 2},# Coastal
        'coimbatore': {'day': -2, 'night': -2}, # Cooler
        'kochi': {'day': 0, 'night': 3},        # Coastal, warm nights
    }
    
    cities = Config.CITIES if city_filter == 'all' else [
        c for c in Config.CITIES if c['id'] == city_filter
    ]
    
    timeline = []
    city_data = {city['id']: [] for city in cities}
    
    current_date = start_date
    delta = timedelta(days=1)
    
    if granularity == 'weekly':
        delta = timedelta(days=7)
    elif granularity == 'monthly':
        delta = timedelta(days=30)
    
    while current_date <= end_date:
        month = current_date.month
        pattern = seasonal_patterns[month]
        
        # Add year-over-year warming trend (climate change effect)
        year_offset = (current_date.year - 2024) * 0.5
        
        date_entry = {
            'date': current_date.strftime('%Y-%m-%d'),
            'month': current_date.strftime('%B %Y'),
            'week': current_date.strftime('Week %W, %Y'),
            'cities': {}
        }
        
        for city in cities:
            city_id = city['id']
            offset = city_offsets.get(city_id, {'day': 0, 'night': 0})
            
            # Calculate temperatures with realistic variations
            day_temp = pattern['base_day'] + offset['day'] + year_offset + random.uniform(-pattern['variation'], pattern['variation'])
            night_temp = pattern['base_night'] + offset['night'] + year_offset + random.uniform(-pattern['variation']/2, pattern['variation']/2)
            
            # Calculate demand index based on night temp (primary driver)
            demand_index = min(100, max(0, int((night_temp - 15) * 7)))
            
            # Calculate AC hours
            ac_hours = max(0, min(24, round((night_temp - 18) * 2.5 + (day_temp - 30) * 0.5, 1)))
            
            city_entry = {
                'day_temp': round(day_temp, 1),
                'night_temp': round(night_temp, 1),
                'humidity': round(50 + random.uniform(-10, 20), 1),
                'demand_index': demand_index,
                'ac_hours': ac_hours
            }
            
            date_entry['cities'][city_id] = city_entry
            city_data[city_id].append({
                'date': current_date.strftime('%Y-%m-%d'),
                **city_entry
            })
        
        timeline.append(date_entry)
        current_date += delta
    
    # Calculate per-city statistics (no combined averages across diverse cities)
    yearly_stats = {}
    for year in [2024, 2025, 2026]:
        year_data = [t for t in timeline if t['date'].startswith(str(year))]
        if year_data:
            # Per-city stats
            city_year_stats = {}
            for cid in [c['id'] for c in cities]:
                city_day_temps = []
                city_night_temps = []
                city_demands = []
                for entry in year_data:
                    if cid in entry['cities']:
                        cv = entry['cities'][cid]
                        city_day_temps.append(cv['day_temp'])
                        city_night_temps.append(cv['night_temp'])
                        city_demands.append(cv['demand_index'])
                if city_day_temps:
                    city_name = next((c['name'] for c in cities if c['id'] == cid), cid)
                    city_year_stats[cid] = {
                        'name': city_name,
                        'max_day_temp': round(max(city_day_temps), 1),
                        'max_night_temp': round(max(city_night_temps), 1),
                        'avg_demand': round(sum(city_demands) / len(city_demands), 1)
                    }
            
            # Find hottest/coolest cities for the year
            sorted_by_night = sorted(city_year_stats.values(), key=lambda x: x['max_night_temp'], reverse=True)
            
            yearly_stats[year] = {
                'city_stats': city_year_stats,
                'hottest_city': sorted_by_night[0] if sorted_by_night else None,
                'coolest_city': sorted_by_night[-1] if sorted_by_night else None,
                'peak_day_temp': round(max(cv['max_day_temp'] for cv in city_year_stats.values()), 1) if city_year_stats else 0,
                'peak_night_temp': round(max(cv['max_night_temp'] for cv in city_year_stats.values()), 1) if city_year_stats else 0,
                'data_points': len(year_data)
            }
    
    return {
        'timeline': timeline,
        'city_data': city_data,
        'yearly_stats': yearly_stats,
        'cities': [{'id': c['id'], 'name': c['name']} for c in cities]
    }


@app.route('/api/heatmap/monthly')
def get_heatmap_monthly_data():
    """
    Get monthly temperature data for heatmap from Open-Meteo API
    Returns real historical data for 2024, 2025 and current year
    """
    try:
        city_id = request.args.get('city', 'chennai')
        
        # Get city config
        city = next((c for c in Config.CITIES if c['id'] == city_id), None)
        if not city:
            city = Config.CITIES[0]  # Default to first city
            city_id = city['id']
        
        result = {
            'city_id': city_id,
            'city_name': city['name'],
            'years': {}
        }
        
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        # Fetch data for 2024, 2025, 2026 (using cache for faster loading)
        for year in [2024, 2025, 2026]:
            monthly_data = get_cached_monthly_data(city_id, year)
            
            result['years'][year] = []
            for month_data in monthly_data:
                avg_temp = None
                if month_data['avg_day_temp'] is not None:
                    # Use day temp as the heatmap value (peak temperature)
                    avg_temp = month_data['avg_day_temp']
                
                result['years'][year].append({
                    'month': month_data['month_name'],
                    'month_num': month_data['month'],
                    'temp': avg_temp,
                    'day_temp': month_data['avg_day_temp'],
                    'night_temp': month_data['avg_night_temp'],
                    'source': month_data['source'],
                    'is_forecast': month_data.get('is_forecast', False)
                })
        
        # Add forecast data for future months in current year
        # Open-Meteo Seasonal API provides up to 7 months forecast (using ECMWF SEAS5)
        # We request 4 months (120 days) of forecast data (cached for 30 mins)
        forecast_end_month = min(current_month + 4, 12)
        forecast = get_cached_forecast(city_id, days=120)  # 4 months forecast from Seasonal API
        
        if forecast:
            # Group forecast by month
            forecast_by_month = {}
            for day_data in forecast:
                date = datetime.strptime(day_data['date'], '%Y-%m-%d')
                month_num = date.month
                if month_num not in forecast_by_month:
                    forecast_by_month[month_num] = {'day_temps': [], 'night_temps': []}
                forecast_by_month[month_num]['day_temps'].append(day_data['day_temp'])
                forecast_by_month[month_num]['night_temps'].append(day_data['night_temp'])
            
            # Update 2026 data with forecast for future months
            for month_num in range(current_month + 1, forecast_end_month + 1):
                if month_num in forecast_by_month:
                    # Use actual forecast data from Seasonal API
                    temps = forecast_by_month[month_num]
                    avg_day = sum(temps['day_temps']) / len(temps['day_temps'])
                    avg_night = sum(temps['night_temps']) / len(temps['night_temps'])
                    
                    # Update the month in 2026 data
                    for month_data in result['years'][2026]:
                        if month_data['month_num'] == month_num:
                            month_data['temp'] = round(avg_day, 1)
                            month_data['day_temp'] = round(avg_day, 1)
                            month_data['night_temp'] = round(avg_night, 1)
                            month_data['source'] = 'Open-Meteo Seasonal (ECMWF SEAS5)'
                            month_data['is_forecast'] = True
                            break
                else:
                    # Use historical average from same month in 2025 as estimate
                    # (This provides a data-driven estimate for months beyond 16-day forecast)
                    historical_month = next((m for m in result['years'][2025] if m['month_num'] == month_num), None)
                    if historical_month and historical_month['temp']:
                        for month_data in result['years'][2026]:
                            if month_data['month_num'] == month_num:
                                # Add slight warming trend (+0.5°C year-over-year)
                                month_data['temp'] = round(historical_month['temp'] + 0.5, 1)
                                month_data['day_temp'] = round(historical_month['day_temp'] + 0.5, 1) if historical_month['day_temp'] else None
                                month_data['night_temp'] = round(historical_month['night_temp'] + 0.5, 1) if historical_month['night_temp'] else None
                                month_data['source'] = 'Historical Estimate (2025 + 0.5°C)'
                                month_data['is_forecast'] = True
                                break
        
        return jsonify({
            'status': 'success',
            'data': result,
            'meta': {
                'current_year': current_year,
                'current_month': current_month,
                'forecast_end_month': forecast_end_month,
                'note': 'Months 1-16 days ahead use Open-Meteo forecast; beyond that uses historical estimates'
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/comparison/monthly-yoy')
def get_monthly_yoy_comparison():
    """
    Get month-wise Year-over-Year comparison data from Open-Meteo API
    Compare same month across 2024, 2025, 2026 (e.g., Feb 2024 vs Feb 2025 vs Feb 2026)
    """
    try:
        city_filter = request.args.get('city', 'all')
        month_filter = request.args.get('month', None)  # 1-12, or None for all months
        
        cities = Config.CITIES
        if city_filter != 'all':
            cities = [c for c in cities if c['id'] == city_filter]
        
        # Use first city if filtering, otherwise use Chennai as representative
        sample_city = cities[0] if len(cities) == 1 else next((c for c in cities if c['id'] == 'chennai'), cities[0])
        
        months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December']
        
        comparison_data = []
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        # Forecast extends +4 months from current month (e.g., Feb -> June)
        forecast_end_month = min(current_month + 4, 12)
        
        # Fetch monthly averages from Open-Meteo API for each year (cached for 1 hour)
        yearly_data = {}
        for year in [2024, 2025, 2026]:
            yearly_data[year] = get_cached_monthly_data(sample_city['id'], year)
        
        # Get forecast data for future months (up to 4 months, cached for 30 mins)
        forecast_data = get_cached_forecast(sample_city['id'], days=120)  # 4 months from Seasonal API
        forecast_by_month = {}
        if forecast_data:
            for day_data in forecast_data:
                date = datetime.strptime(day_data['date'], '%Y-%m-%d')
                month_num = date.month
                if month_num not in forecast_by_month:
                    forecast_by_month[month_num] = {'day_temps': [], 'night_temps': []}
                forecast_by_month[month_num]['day_temps'].append(day_data['day_temp'])
                forecast_by_month[month_num]['night_temps'].append(day_data['night_temp'])
        
        for month_num in range(1, 13):
            month_name = months[month_num - 1]
            month_data = {
                'month': month_name,
                'month_num': month_num,
                'years': {},
                'is_forecast': False,
                'source': 'Open-Meteo API'
            }
            
            for year in [2024, 2025, 2026]:
                year_monthly = yearly_data.get(year, [])
                month_info = next((m for m in year_monthly if m['month'] == month_num), None)
                
                # Check if this is a future month that needs forecast data
                is_future_month = (year == current_year and month_num > current_month)
                
                # For 2026: skip months beyond forecast window
                if year == 2026 and month_num > forecast_end_month:
                    month_data['years'][year] = None
                    continue
                
                # Mark as forecast if beyond current month
                if is_future_month:
                    month_data['is_forecast'] = True
                
                day_temp = None
                night_temp = None
                source = None
                
                # Get data from API result
                if month_info and month_info['avg_day_temp'] is not None:
                    day_temp = month_info['avg_day_temp']
                    night_temp = month_info['avg_night_temp']
                    source = month_info.get('source', 'Open-Meteo Archive')
                
                # Use forecast data for future months in current year
                elif is_future_month and month_num in forecast_by_month:
                    temps = forecast_by_month[month_num]
                    day_temp = round(sum(temps['day_temps']) / len(temps['day_temps']), 1)
                    night_temp = round(sum(temps['night_temps']) / len(temps['night_temps']), 1)
                    source = 'Open-Meteo Seasonal (ECMWF SEAS5)'
                
                if day_temp is not None:
                    # Calculate demand index based on night temp
                    demand = min(100, max(0, int((night_temp - 15) * 7)))
                    
                    # Calculate AC hours
                    ac_hours = max(0, min(24, round((night_temp - 18) * 2.5 + (day_temp - 30) * 0.5, 1)))
                    
                    month_data['years'][year] = {
                        'avg_day_temp': day_temp,
                        'avg_night_temp': night_temp,
                        'max_day_temp': round(day_temp + 2, 1),  # Estimate
                        'max_night_temp': round(night_temp + 2, 1),  # Estimate
                        'avg_demand': demand,
                        'avg_ac_hours': ac_hours,
                        'source': source
                    }
                else:
                    month_data['years'][year] = None
            
            # Calculate YoY changes
            if month_data['years'].get(2024) and month_data['years'].get(2025):
                month_data['yoy_2024_2025'] = {
                    'day_temp_change': round(month_data['years'][2025]['avg_day_temp'] - month_data['years'][2024]['avg_day_temp'], 1),
                    'night_temp_change': round(month_data['years'][2025]['avg_night_temp'] - month_data['years'][2024]['avg_night_temp'], 1),
                    'demand_change': round(month_data['years'][2025]['avg_demand'] - month_data['years'][2024]['avg_demand'], 1)
                }
            
            if month_data['years'].get(2025) and month_data['years'].get(2026):
                month_data['yoy_2025_2026'] = {
                    'day_temp_change': round(month_data['years'][2026]['avg_day_temp'] - month_data['years'][2025]['avg_day_temp'], 1),
                    'night_temp_change': round(month_data['years'][2026]['avg_night_temp'] - month_data['years'][2025]['avg_night_temp'], 1),
                    'demand_change': round(month_data['years'][2026]['avg_demand'] - month_data['years'][2025]['avg_demand'], 1)
                }
            
            comparison_data.append(month_data)
        
        # Filter by specific month if requested
        if month_filter:
            try:
                month_num = int(month_filter)
                comparison_data = [m for m in comparison_data if m['month_num'] == month_num]
            except ValueError:
                pass
        
        return jsonify({
            'status': 'success',
            'data': comparison_data,
            'meta': {
                'city_filter': city_filter,
                'city_used': sample_city['name'],
                'month_filter': month_filter,
                'years_compared': [2024, 2025, 2026],
                'current_date': datetime.now().strftime('%Y-%m-%d'),
                'data_source': 'Open-Meteo API'
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


def generate_strategic_recommendations(cities_weather, forecast_by_city, historical_by_city, current_month):
    """Generate strategic business recommendations"""
    recommendations = []
    
    # High priority: Peak season preparation
    hot_cities = [c for c in cities_weather if c.get('night_temp', 20) >= 22]
    if len(hot_cities) >= 3 or current_month in [3, 4, 5]:
        recommendations.append({
            'priority': 'high',
            'icon': 'fire',
            'title': 'Peak Season Approaching',
            'description': f'{len(hot_cities)} cities showing elevated night temperatures. Accelerate inventory positioning for AC and cooling products.',
            'metrics': [
                {'value': f'{len(hot_cities)}', 'label': 'Hot Markets'},
                {'value': 'Next 6 weeks', 'label': 'Action Window'}
            ]
        })
    
    # Identify fastest heating markets
    heating_markets = []
    for city in Config.CITIES:
        forecast = forecast_by_city.get(city['id'], [])
        if len(forecast) >= 30:
            first_week = sum(d['night_temp'] for d in forecast[:7]) / 7
            fourth_week = sum(d['night_temp'] for d in forecast[21:28]) / 7 if len(forecast) >= 28 else first_week
            if fourth_week - first_week > 2:
                heating_markets.append(city['name'])
    
    if heating_markets:
        recommendations.append({
            'priority': 'high',
            'icon': 'chart-line',
            'title': 'Rapid Temperature Rise Detected',
            'description': f'{", ".join(heating_markets[:3])} showing rapid heating trend. Priority markets for immediate stock deployment.',
            'metrics': [
                {'value': f'+2-4°C', 'label': 'Expected Rise'},
                {'value': '4 weeks', 'label': 'Timeline'}
            ]
        })
    
    # Night temperature opportunity
    night_opportunity = [c for c in cities_weather if 20 <= c.get('night_temp', 18) < 24]
    if night_opportunity:
        recommendations.append({
            'priority': 'medium',
            'icon': 'moon',
            'title': 'Night Temperature Sweet Spot',
            'description': f'{len(night_opportunity)} markets in 20-24°C night range. Optimal for premium AC positioning - consumers actively seeking comfort.',
            'metrics': [
                {'value': '12-16 hrs', 'label': 'AC Usage'},
                {'value': 'Premium', 'label': 'Segment Focus'}
            ]
        })
    
    # Regional strategy based on data
    # Identify hottest South Indian cities by night temp
    south_hot_cities = []
    for c in cities_weather:
        night_temp = c.get('night_temp', 20)
        if night_temp >= 22:
            south_hot_cities.append({'name': c['city_name'], 'night_temp': round(night_temp, 1)})
    south_hot_cities.sort(key=lambda x: x['night_temp'], reverse=True)
    
    if south_hot_cities:
        city_list = ', '.join([f"{c['name']} ({c['night_temp']}°C)" for c in south_hot_cities[:3]])
        recommendations.append({
            'priority': 'medium',
            'icon': 'map-marker-alt',
            'title': f'{len(south_hot_cities)} Cities Showing High Night Temps',
            'description': f'{city_list} — prioritize inventory allocation to these markets.',
            'metrics': [
                {'value': f"{south_hot_cities[0]['night_temp']}°C", 'label': f"Hottest: {south_hot_cities[0]['name']}"},
                {'value': f'{len(south_hot_cities)}', 'label': 'Hot Markets'}
            ]
        })
    
    # Inventory timing recommendation
    recommendations.append({
        'priority': 'low',
        'icon': 'warehouse',
        'title': 'Inventory Timing Optimal',
        'description': 'Based on 4-month forecast, current period ideal for channel loading. Distributor stock-up recommended before March price increases.',
        'metrics': [
            {'value': '2-3 weeks', 'label': 'Lead Time'},
            {'value': 'Feb-Mar', 'label': 'Optimal Window'}
        ]
    })
    
    # Promotional timing
    if current_month in [2, 3]:
        recommendations.append({
            'priority': 'low',
            'icon': 'bullhorn',
            'title': 'Pre-Season Promotion Window',
            'description': 'Consumer awareness campaigns effective now. Digital marketing ROI highest 4-6 weeks before peak.',
            'metrics': [
                {'value': '4-6 weeks', 'label': 'Before Peak'},
                {'value': '2x', 'label': 'Conversion Rate'}
            ]
        })
    
    return recommendations[:6]  # Return top 6


def generate_monthly_forecast_breakdown(forecast_by_city, current_month):
    """Generate monthly forecast breakdown with demand levels"""
    months_data = []
    month_names = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December']
    
    for i in range(4):  # Next 4 months
        target_month = current_month + i
        if target_month > 12:
            break
        
        all_day_temps = []
        all_night_temps = []
        
        for city_id, forecast in forecast_by_city.items():
            month_data = [d for d in forecast if datetime.strptime(d['date'], '%Y-%m-%d').month == target_month]
            for d in month_data:
                all_day_temps.append(d['day_temp'])
                all_night_temps.append(d['night_temp'])
        
        if all_day_temps and all_night_temps:
            avg_day = sum(all_day_temps) / len(all_day_temps)
            avg_night = sum(all_night_temps) / len(all_night_temps)
            demand = min(100, max(0, int((avg_night - 15) * 7)))
            
            # Determine demand level
            if demand >= 80:
                level = 'extreme'
            elif demand >= 60:
                level = 'high'
            elif demand >= 40:
                level = 'moderate'
            else:
                level = 'normal'
            
            months_data.append({
                'month': month_names[target_month - 1],
                'month_num': target_month,
                'avg_day': round(avg_day, 1),
                'avg_night': round(avg_night, 1),
                'demand': demand,
                'level': level
            })
    
    return months_data


def generate_action_checklist(days_to_peak, demand_potential, city_scores, current_month):
    """Generate prioritized action checklist"""
    actions = []
    
    # Urgency based on days to peak
    if days_to_peak <= 30:
        actions.append({
            'urgency': 'urgent',
            'title': 'Emergency Stock Deployment',
            'detail': 'Peak season imminent. Prioritize logistics and retailer stock levels.',
            'timeline': 'This week'
        })
    elif days_to_peak <= 60:
        actions.append({
            'urgency': 'urgent',
            'title': 'Accelerate Channel Loading',
            'detail': 'Push inventory to distributors in top 5 priority markets.',
            'timeline': 'Next 2 weeks'
        })
    
    # High demand potential actions
    if demand_potential >= 70:
        actions.append({
            'urgency': 'important',
            'title': 'Premium Product Push',
            'detail': 'High-margin inverter AC models should lead portfolio mix.',
            'timeline': 'Ongoing'
        })
    
    # Top market specific
    if city_scores and city_scores[0]['score'] >= 70:
        top = city_scores[0]
        actions.append({
            'urgency': 'important',
            'title': f'Focus on {top["city"]}',
            'detail': f'Highest potential market with {top["night_temp"]}°C nights. Increase retail presence.',
            'timeline': 'Next 4 weeks'
        })
    
    # Seasonal actions
    if current_month == 2:
        actions.append({
            'urgency': 'important',
            'title': 'Trade Scheme Launch',
            'detail': 'Announce dealer incentives for pre-season orders.',
            'timeline': 'Feb 15-28'
        })
    
    if current_month in [2, 3]:
        actions.append({
            'urgency': 'normal',
            'title': 'Consumer Financing Tie-ups',
            'detail': 'Finalize EMI partnerships with banks for peak season.',
            'timeline': 'Before March end'
        })
    
    actions.append({
        'urgency': 'normal',
        'title': 'Service Network Readiness',
        'detail': 'Ensure installation capacity scaled up for anticipated demand.',
        'timeline': 'Next 6 weeks'
    })
    
    actions.append({
        'urgency': 'normal',
        'title': 'Digital Marketing Campaign',
        'detail': 'Launch awareness campaigns targeting AC research keywords.',
        'timeline': 'Ongoing'
    })
    
    return actions[:8]


def generate_city_insights(cities_weather, forecast_by_city, historical_by_city):
    """Generate insights for each city"""
    city_insights = []
    
    for city in cities_weather:
        city_id = city['city_id']
        forecast = forecast_by_city.get(city_id, [])
        
        # Calculate metrics
        current_night = city.get('night_temp', 20)
        current_day = city.get('day_temp', 32)
        
        # Future projection
        future_nights = [d['night_temp'] for d in forecast[:60]]
        future_days = [d['day_temp'] for d in forecast[:60]]
        
        avg_future_night = sum(future_nights) / len(future_nights) if future_nights else current_night
        avg_future_day = sum(future_days) / len(future_days) if future_days else current_day
        
        # Calculate demand score
        demand_score = min(100, max(0, int((avg_future_night - 15) * 7)))
        
        # Determine priority
        if demand_score >= 70:
            priority = 'high'
            badge = 'High Priority'
        elif demand_score >= 50:
            priority = 'medium'
            badge = 'Medium Priority'
        else:
            priority = 'low'
            badge = 'Monitor'
        
        # Generate recommendation
        if avg_future_night >= 24:
            recommendation = f"<strong>Peak demand territory.</strong> Night temps above 24°C drive 14-16 hr AC usage. Prioritize premium models and installation capacity."
        elif avg_future_night >= 22:
            recommendation = f"<strong>Strong demand zone.</strong> Current {current_night}°C nights rising to {avg_future_night:.1f}°C. Accelerate inventory deployment."
        elif avg_future_night >= 20:
            recommendation = f"<strong>Building demand.</strong> Position stock now for upcoming surge. Focus on mid-range segment."
        else:
            recommendation = f"<strong>Moderate demand.</strong> Maintain baseline inventory. Monitor for temperature changes."
        
        # Demand zone from config
        city_config = next((c for c in Config.CITIES if c['id'] == city_id), {})
        
        city_insights.append({
            'city': city['city_name'],
            'city_id': city_id,
            'priority': priority,
            'badge': badge,
            'current_day': round(current_day, 1),
            'current_night': round(current_night, 1),
            'forecast_night': round(avg_future_night, 1),
            'demand_score': demand_score,
            'recommendation': recommendation,
            'demand_zone': city_config.get('demand_zone', ''),
            'zone_icon': city_config.get('zone_icon', '📍')
        })
    
    # Sort by demand score
    city_insights.sort(key=lambda x: x['demand_score'], reverse=True)
    
    return city_insights


# ═══════════════════════════════════════════════════════════════════════════
# NEW API ENDPOINTS (Boss's 6-Point Directive)
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/api/advanced-weather')
def get_advanced_weather():
    """
    Advanced weather parameters: wet bulb, heat wave, monsoon, consecutive hot days.
    Query params: city (optional, default: all)
    """
    try:
        city_filter = request.args.get('city', 'all')
        cities_weather = get_cached_weather()
        
        if city_filter != 'all':
            cities_weather = [c for c in cities_weather if c.get('city_id') == city_filter]
        
        result = []
        for city in cities_weather:
            city_id = city.get('city_id', '')
            day_temp = city.get('day_temp', city['temperature'])
            night_temp = city.get('night_temp', city['temperature'] - 5)
            humidity = city.get('humidity', 60)
            
            # Wet bulb
            wet_bulb = data_processor.calculate_wet_bulb(day_temp, humidity)
            
            # Consecutive hot days from forecast
            forecast = get_cached_forecast(city_id, days=16)
            heatwave = data_processor.detect_consecutive_hot_days(forecast)
            
            # DSB zone
            demand_idx = data_processor.calculate_demand_index(day_temp, night_temp, humidity)
            dsb = data_processor.get_dsb_zone(demand_idx)
            
            # City config
            city_config = next((c for c in Config.CITIES if c['id'] == city_id), {})
            
            result.append({
                'city_id': city_id,
                'city_name': city.get('city_name', ''),
                'demand_zone': city_config.get('demand_zone', ''),
                'zone_icon': city_config.get('zone_icon', '📍'),
                'zone_traits': city_config.get('zone_traits', ''),
                'wet_bulb': wet_bulb,
                'heatwave': heatwave,
                'dsb_zone': dsb,
                'demand_index': round(demand_idx, 1),
                'day_temp': day_temp,
                'night_temp': night_temp,
                'humidity': humidity
            })
        
        # Monsoon status (same for all cities in region)
        monsoon = data_processor.get_monsoon_status()
        
        return jsonify({
            'status': 'success',
            'data': {
                'cities': result,
                'monsoon': monsoon
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


# Alerts subsystem: generate alerts for Amber/Red/kerala_special, cache and provide endpoints
ALERTS_TTL = 300  # refresh alerts every 5 minutes

# Acknowledged alerts store
if 'alerts_ack' not in cache:
    cache['alerts_ack'] = set()


def refresh_alerts(force=False):
    """Refresh alerts and store in cache."""
    now = time.time()
    if (not force and cache.get('alerts_timestamp', 0) and (now - cache['alerts_timestamp'] < ALERTS_TTL)):
        return cache.get('alerts_data', [])

    try:
        cities_weather = get_cached_weather()
        alerts = alert_engine.get_all_alerts(cities_weather)
        # Attach stable ids and ack flag
        ts = int(time.time())
        new_alerts_to_send = []
        for idx, a in enumerate(alerts):
            a_id = f"{a.get('city_id')}_{ts}_{idx}"
            a['id'] = a_id
            a['acknowledged'] = a_id in cache.get('alerts_ack', set())
            # if webhook configured and this alert is Amber/Red/Kerala special and not sent yet
            if (a.get('alert_level') in ('red', 'orange', 'kerala_special') and
                a_id not in cache.get('alerts_webhook_sent', set()) and
                getattr(Config, 'ALERT_WEBHOOK_URLS', [])):
                new_alerts_to_send.append(a)
        cache['alerts_data'] = alerts
        cache['alerts_timestamp'] = now

        # Persist critical alerts to Supabase (non-blocking)
        if supabase_handler.enabled:
            critical = [a for a in alerts if a.get('alert_level') in ('red', 'orange', 'kerala_special')]
            if critical:
                def _persist_alerts(alert_list):
                    for alert in alert_list:
                        try:
                            supabase_handler.save_alert(alert)
                        except Exception as e:
                            print(f"[Supabase] Alert persist error: {e}")
                threading.Thread(target=_persist_alerts, args=(critical,), daemon=True).start()

        # send webhooks for newly discovered alerts (non-blocking)
        if new_alerts_to_send:
            try:
                threading.Thread(target=send_alert_webhooks, args=(new_alerts_to_send,), daemon=True).start()
            except Exception as e:
                app.logger.error('Failed to start webhook thread: %s', e)

        return alerts
    except Exception as e:
        app.logger.error('Error refreshing alerts: %s', e)
        return []


def send_alert_webhooks(alerts_list):
    """Send alerts to configured webhook URLs and update cache of sent alerts."""
    urls = getattr(Config, 'ALERT_WEBHOOK_URLS', []) or []
    headers = getattr(Config, 'ALERT_WEBHOOK_HEADERS', {}) or {}
    timeout = getattr(Config, 'ALERT_WEBHOOK_TIMEOUT', 5)
    sent = cache.setdefault('alerts_webhook_sent', set())
    for alert in alerts_list:
        payload = {
            'city_id': alert.get('city_id'),
            'city': alert.get('city'),
            'demand_index': alert.get('demand_index'),
            'dsb_zone': alert.get('dsb_zone'),
            'alert_level': alert.get('alert_level'),
            'timestamp': alert.get('timestamp'),
            'recommendation': alert.get('recommendation')
        }
        for url in urls:
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
                app.logger.info('Webhook sent to %s (%s) -> %s', url, alert.get('id'), resp.status_code)
                # If request returns 2xx, mark as sent
                if 200 <= resp.status_code < 300:
                    sent.add(alert.get('id'))
            except Exception as e:
                app.logger.error('Webhook send failed for %s -> %s', url, e)
    cache['alerts_webhook_sent'] = sent


def _start_alerts_worker():
    def worker():
        while True:
            try:
                refresh_alerts(force=True)
            except Exception as e:
                app.logger.error('Alert worker error: %s', e)
            time.sleep(ALERTS_TTL)
    t = threading.Thread(target=worker, daemon=True)
    t.start()

# Start background worker when app initializes
_start_alerts_worker()



@app.route('/api/alerts/ack', methods=['POST'], endpoint='alerts_ack')
def acknowledge_alerts():
    """Acknowledge alerts by id. Accepts JSON: {'ids': ['city_...'] }"""
    try:
        body = request.get_json() or {}
        ids = body.get('ids', [])
        if not isinstance(ids, list):
            return jsonify({'status': 'error', 'message': 'ids must be a list'}), 400
        for _id in ids:
            cache.setdefault('alerts_ack', set()).add(_id)
        # update cached alerts' acknowledged flags
        for a in cache.get('alerts_data', []):
            if a.get('id') in ids:
                a['acknowledged'] = True
        return jsonify({'status': 'success', 'acknowledged': ids})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/generate-checklist', endpoint='generate_checklist_api')
def generate_checklist():
    """Generate an actionable checklist for a city based on current conditions. Query: city=<city_id> or city=all"""
    try:
        city_id = request.args.get('city')
        if not city_id or city_id == 'all':
            return jsonify({'status': 'error', 'message': 'Please specify a city parameter'}), 400
        # Find city weather
        cities = get_cached_weather()
        city = next((c for c in cities if c.get('city_id') == city_id), None)
        if not city:
            return jsonify({'status': 'error', 'message': 'City not found'}), 404

        # Use alert engine to create recommendation steps
        alert = alert_engine.analyze_temperature(
            city.get('day_temp', city.get('temperature')),
            city.get('night_temp', city.get('temperature') - 5),
            city.get('city_name'),
            city_id
        )
        rec = alert.get('recommendation', {})
        checklist = {
            'city': city.get('city_name'),
            'city_id': city_id,
            'demand_index': alert.get('demand_index'),
            'action': rec.get('action'),
            'priority': rec.get('priority'),
            'steps': rec.get('steps', [])
        }
        return jsonify({'status': 'success', 'data': {'checklist': checklist}})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/demand-correlation')
def get_demand_correlation():
    """
    Demand correlation layer: overlay historical weather vs simulated sales data.
    Query params: city (city_id, default: chennai), days (int, default: 90)
    """
    try:
        city_id = request.args.get('city', 'chennai')
        days = int(request.args.get('days', 90))
        
        # Get historical weather data
        historical = weather_service.get_historical_data(city_id, days=days)
        
        if not historical:
            return jsonify({'status': 'error', 'message': 'No historical data available'}), 404
        
        # Calculate correlation
        correlation = data_processor.calculate_demand_correlation(historical, city_id)
        
        city_config = next((c for c in Config.CITIES if c['id'] == city_id), {})
        
        return jsonify({
            'status': 'success',
            'data': {
                'city_id': city_id,
                'city_name': city_config.get('name', city_id),
                'demand_zone': city_config.get('demand_zone', ''),
                'days_analyzed': len(historical),
                'correlation': correlation
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/service-predictions')
def get_service_predictions():
    """
    Service demand predictions: compressor failures, gas refills, warranty claims.
    Returns predictions for all cities or a specific city.
    Query params: city (optional, default: all)
    """
    try:
        city_filter = request.args.get('city', 'all')
        cities_weather = get_cached_weather()
        
        if city_filter != 'all':
            cities_weather = [c for c in cities_weather if c.get('city_id') == city_filter]
        
        predictions = []
        for city in cities_weather:
            city_id = city.get('city_id', '')
            day_temp = city.get('day_temp', city['temperature'])
            night_temp = city.get('night_temp', city['temperature'] - 5)
            humidity = city.get('humidity', 60)
            
            pred = data_processor.predict_service_demand(city_id, day_temp, night_temp, humidity)
            pred['city_id'] = city_id
            pred['city_name'] = city.get('city_name', '')
            
            city_config = next((c for c in Config.CITIES if c['id'] == city_id), {})
            pred['demand_zone'] = city_config.get('demand_zone', '')
            pred['zone_icon'] = city_config.get('zone_icon', '📍')
            
            predictions.append(pred)
        
        # Sort by overall service load
        predictions.sort(key=lambda x: x.get('overall_service_load', 0), reverse=True)
        
        return jsonify({
            'status': 'success',
            'data': predictions
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/refresh-status')
def get_refresh_status():
    """
    Get refresh cadence status: daily weather, weekly demand forecast, monthly accuracy validation.
    """
    try:
        refresh = data_processor.get_refresh_status()
        return jsonify({
            'status': 'success',
            'data': refresh
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/dsb-overview')
def get_dsb_overview():
    """
    DSB methodology overview: Green/Amber/Red zones for all cities.
    """
    try:
        cities_weather = get_cached_weather()
        
        zones = {'green': [], 'amber': [], 'red': []}
        
        for city in cities_weather:
            demand_idx = city.get('demand_index', 0)
            dsb = data_processor.get_dsb_zone(demand_idx)
            city_config = next((c for c in Config.CITIES if c['id'] == city.get('city_id')), {})
            
            entry = {
                'city_id': city.get('city_id', ''),
                'city_name': city.get('city_name', ''),
                'demand_index': round(demand_idx, 1),
                'demand_zone': city_config.get('demand_zone', ''),
                'zone_icon': city_config.get('zone_icon', '📍'),
                'day_temp': city.get('day_temp'),
                'night_temp': city.get('night_temp'),
                'dsb': dsb
            }
            
            zones[dsb['zone']].append(entry)
        
        return jsonify({
            'status': 'success',
            'data': {
                'zones': zones,
                'summary': {
                    'green_count': len(zones['green']),
                    'amber_count': len(zones['amber']),
                    'red_count': len(zones['red']),
                    'total': len(cities_weather)
                },
                'methodology': {
                    'green': Config.DSB_GREEN,
                    'amber': Config.DSB_AMBER,
                    'red': Config.DSB_RED
                }
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


def warm_cache():
    """Pre-warm caches in background so first user request is instant"""
    try:
        time.sleep(1)  # Wait for server to be fully ready
        
        print("[Cache] Pre-warming weather cache...")
        weather = get_cached_weather()
        print(f"[Cache] Weather ready ({len(weather)} cities)")
        
        # Pre-warm forecasts for all cities (staggered to avoid rate limits)
        print("[Cache] Pre-warming forecast cache...")
        for city in Config.CITIES:
            try:
                get_cached_forecast(city['id'], days=120)
            except Exception:
                pass
            time.sleep(0.3)  # Small delay between API calls
        print(f"[Cache] Forecasts ready ({len(Config.CITIES)} cities)")
        
        # Pre-warm historical data (staggered)
        print("[Cache] Pre-warming historical cache...")
        for city in Config.CITIES:
            for year in [2024, 2025]:
                try:
                    get_cached_monthly_data(city['id'], year)
                except Exception:
                    pass
                time.sleep(0.2)
        print("[Cache] Historical data ready")
        print("[Cache] All caches warmed successfully!")
    except Exception as e:
        print(f"[Cache] Warning: Pre-warming failed: {e}")


# ---- Supabase Database API Endpoints ----

@app.route('/api/supabase/weather-history')
def supabase_weather_history():
    """Get historical weather data from Supabase. Query: city=<city_id>, limit=<n>"""
    try:
        city_id = request.args.get('city', 'chennai')
        limit = int(request.args.get('limit', 24))
        data = supabase_handler.get_recent_logs(city_id, limit=limit)
        return jsonify({
            'status': 'success',
            'supabase_enabled': supabase_handler.enabled,
            'data': data,
            'count': len(data)
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/supabase/alerts')
def supabase_alerts():
    """Get alerts from Supabase. Query: active_only=true|false"""
    try:
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        if active_only:
            data = supabase_handler.get_active_alerts()
        else:
            # Fetch all alerts (up to 100)
            if supabase_handler.enabled:
                response = supabase_handler.client.table("alerts")\
                    .select("*")\
                    .order("created_at", desc=True)\
                    .limit(100)\
                    .execute()
                data = response.data
            else:
                data = []
        return jsonify({
            'status': 'success',
            'supabase_enabled': supabase_handler.enabled,
            'data': data,
            'count': len(data)
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/supabase/alerts/ack', methods=['POST'])
def supabase_ack_alert():
    """Acknowledge an alert in Supabase by UUID. Body: { "id": "<uuid>" }"""
    try:
        body = request.get_json() or {}
        alert_id = body.get('id')
        if not alert_id:
            return jsonify({'status': 'error', 'message': 'Missing alert id'}), 400
        result = supabase_handler.acknowledge_alert(alert_id)
        if result is not None:
            return jsonify({'status': 'success', 'acknowledged': alert_id})
        else:
            return jsonify({'status': 'error', 'message': 'Failed to acknowledge or Supabase disabled'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/supabase/status')
def supabase_status():
    """Check Supabase connection health."""
    status = supabase_handler.get_connection_status()
    return jsonify({
        'status': 'success',
        'supabase_enabled': supabase_handler.enabled,
        'connection': status
    })


if __name__ == '__main__':
    # Start cache warming in background thread (non-blocking)
    cache_thread = threading.Thread(target=warm_cache, daemon=True)
    cache_thread.start()
    
    app.run(
        host='0.0.0.0',
        port=Config.PORT,
        debug=(Config.FLASK_ENV == 'development')
    )
