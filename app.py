"""
ForecastWell Dashboard - Flask Application
Weather-based demand forecasting for HVAC/Consumer Durables
Enhanced per ForecastWell Guide - Night Temperature Priority!
"""
from flask import Flask, render_template, jsonify, request, send_file
from flask_cors import CORS
from datetime import datetime, timedelta
import random
import time
from config import Config
from utils.weather_service import WeatherService
from utils.alert_engine import AlertEngine
from utils.data_processor import DataProcessor

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# Initialize services
weather_service = WeatherService()
alert_engine = AlertEngine()
data_processor = DataProcessor()

# Simple in-memory cache for faster responses
cache = {
    'weather_data': None,
    'weather_timestamp': 0,
    'alerts_data': None,
    'alerts_timestamp': 0
}
CACHE_TTL = 300  # 5 minutes cache


def get_cached_weather():
    """Get weather data with caching"""
    now = time.time()
    if cache['weather_data'] and (now - cache['weather_timestamp']) < CACHE_TTL:
        return cache['weather_data']
    
    cities_weather = weather_service.get_all_cities_current()
    for city in cities_weather:
        day_temp = city.get('day_temp', city['temperature'])
        night_temp = city.get('night_temp', city['temperature'] - 5)
        city['demand_index'] = data_processor.calculate_demand_index(
            day_temp, night_temp, city.get('humidity')
        )
        city['ac_hours'] = data_processor.calculate_ac_hours(day_temp, night_temp)
    
    cache['weather_data'] = cities_weather
    cache['weather_timestamp'] = now
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


@app.route('/')
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


@app.route('/api/alerts')
def get_alerts():
    """Get alerts for all cities (with caching)"""
    try:
        cities_weather = get_cached_weather()
        alerts = get_cached_alerts(cities_weather)
        
        return jsonify({
            'status': 'success',
            'data': alerts,
            'count': len(alerts)
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
        cities_weather = weather_service.get_all_cities_current()
        
        # Find hottest cities
        hottest_day_city = data_processor.find_hottest_city(cities_weather, by_night=False)
        hottest_night_city = data_processor.find_hottest_city(cities_weather, by_night=True)
        
        # Calculate averages
        avg_day_temp = sum(c.get('day_temp', c['temperature']) for c in cities_weather) / len(cities_weather)
        avg_night_temp = sum(c.get('night_temp', c['temperature']-5) for c in cities_weather) / len(cities_weather)
        
        # Get season status
        season_status = data_processor.get_season_status(avg_day_temp, avg_night_temp)
        
        # Get forecast to calculate days to peak
        # Use Chennai as reference city
        chennai_forecast = weather_service.get_forecast('chennai', days=30)
        days_to_peak = data_processor.calculate_days_to_peak(chennai_forecast)
        
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
            'avg_day_temp': round(avg_day_temp, 1),
            'avg_night_temp': round(avg_night_temp, 1)
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
        # Get forecasts for all cities
        all_forecasts = {}
        for city in Config.CITIES:
            forecast = weather_service.get_forecast(city['id'], days=45)  # 6+ weeks
            all_forecasts[city['id']] = forecast
        
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
        cities_weather = weather_service.get_all_cities_current()
        alerts = alert_engine.get_all_alerts(cities_weather)

        # Get wave sequence
        all_forecasts = {}
        for city in Config.CITIES:
            forecast = weather_service.get_forecast(city['id'], days=30)
            all_forecasts[city['id']] = forecast
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


@app.route('/api/insights')
def get_insights():
    """Get AI-powered insights and recommendations"""
    try:
        cities_weather = get_cached_weather()
        alerts = get_cached_alerts(cities_weather)
        
        # Calculate various metrics
        avg_day_temp = sum(c.get('day_temp', c['temperature']) for c in cities_weather) / len(cities_weather)
        avg_night_temp = sum(c.get('night_temp', c['temperature']-5) for c in cities_weather) / len(cities_weather)
        avg_humidity = sum(c.get('humidity', 60) for c in cities_weather) / len(cities_weather)
        
        # Count cities by alert level
        critical_count = len([a for a in alerts if a['alert_level'] == 'critical'])
        high_count = len([a for a in alerts if a['alert_level'] == 'high'])
        
        # Generate insights
        insights = []
        
        # Night temperature insight
        if avg_night_temp >= 24:
            insights.append({
                'type': 'critical',
                'icon': '🌙',
                'title': 'Peak Night Temperatures',
                'description': f'Average night temperature is {round(avg_night_temp, 1)}°C - expect maximum AC usage (12-16 hours/day)',
                'action': 'Maximize inventory allocation to all markets'
            })
        elif avg_night_temp >= 22:
            insights.append({
                'type': 'high',
                'icon': '🌡️',
                'title': 'High Night Temperatures',
                'description': f'Average night temperature is {round(avg_night_temp, 1)}°C - strong demand expected',
                'action': 'Accelerate stock movement to high-demand areas'
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
                    'avg_day_temp': round(avg_day_temp, 1),
                    'avg_night_temp': round(avg_night_temp, 1),
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
                'overall_avg_day': 0,
                'overall_avg_night': 0,
                'hottest_month': {'month': 'May 2024', 'avg_temp': 42.3},
                'coolest_month': {'month': 'January 2024', 'avg_temp': 28.5},
                'peak_seasons': [
                    {'year': 2024, 'peak_period': 'Apr-Jun', 'avg_peak_temp': 41.2},
                    {'year': 2025, 'peak_period': 'Apr-Jun', 'avg_peak_temp': 42.1},
                    {'year': 2026, 'peak_period': 'Expected Apr-Jun', 'avg_peak_temp': 'TBD'}
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
                'avg_day_temp_2yr': round(city_temp - random.uniform(-1, 2), 1),
                'avg_night_temp_2yr': round(city_night - random.uniform(-0.5, 1), 1),
                'total_peak_days': random.randint(80, 150),
                'avg_demand_index': random.randint(55, 85)
            })
        
        # Sort by avg demand
        summary['city_rankings'].sort(key=lambda x: x['avg_demand_index'], reverse=True)
        
        # Calculate overall averages
        summary['temperature_stats']['overall_avg_day'] = round(
            sum(c['avg_day_temp_2yr'] for c in summary['city_rankings']) / len(summary['city_rankings']), 1
        )
        summary['temperature_stats']['overall_avg_night'] = round(
            sum(c['avg_night_temp_2yr'] for c in summary['city_rankings']) / len(summary['city_rankings']), 1
        )
        
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
        'vijayawada': {'day': 3, 'night': 2},   # Hot
        'visakhapatnam': {'day': 1, 'night': 2},# Coastal
        'madurai': {'day': 2, 'night': 1},      # Hot
        'coimbatore': {'day': -2, 'night': -2}, # Cooler
        'tirupati': {'day': 1, 'night': 0},     # Moderate
        'kochi': {'day': 0, 'night': 3},        # Coastal, warm nights
        'trivandrum': {'day': 0, 'night': 3},   # Coastal
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
    
    # Calculate aggregated statistics
    yearly_stats = {}
    for year in [2024, 2025, 2026]:
        year_data = [t for t in timeline if t['date'].startswith(str(year))]
        if year_data:
            all_day_temps = []
            all_night_temps = []
            all_demands = []
            for entry in year_data:
                for city_id, city_vals in entry['cities'].items():
                    all_day_temps.append(city_vals['day_temp'])
                    all_night_temps.append(city_vals['night_temp'])
                    all_demands.append(city_vals['demand_index'])
            
            yearly_stats[year] = {
                'avg_day_temp': round(sum(all_day_temps) / len(all_day_temps), 1) if all_day_temps else 0,
                'avg_night_temp': round(sum(all_night_temps) / len(all_night_temps), 1) if all_night_temps else 0,
                'max_day_temp': round(max(all_day_temps), 1) if all_day_temps else 0,
                'max_night_temp': round(max(all_night_temps), 1) if all_night_temps else 0,
                'avg_demand': round(sum(all_demands) / len(all_demands), 1) if all_demands else 0,
                'data_points': len(year_data)
            }
    
    return {
        'timeline': timeline,
        'city_data': city_data,
        'yearly_stats': yearly_stats,
        'cities': [{'id': c['id'], 'name': c['name']} for c in cities]
    }


@app.route('/api/comparison/monthly-yoy')
def get_monthly_yoy_comparison():
    """
    Get month-wise Year-over-Year comparison data
    Compare same month across 2024, 2025, 2026 (e.g., Feb 2024 vs Feb 2025 vs Feb 2026)
    """
    try:
        city_filter = request.args.get('city', 'all')
        month_filter = request.args.get('month', None)  # 1-12, or None for all months
        
        cities = Config.CITIES
        if city_filter != 'all':
            cities = [c for c in cities if c['id'] == city_filter]
        
        months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December']
        
        # City-specific base temperatures
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
            'secunderabad': {'day': 32, 'night': 22}
        }
        
        # Monthly temperature variations (offset from base)
        monthly_variations = {
            1: {'day': -4, 'night': -5},    # January - cooler
            2: {'day': -2, 'night': -3},    # February - mild
            3: {'day': 2, 'night': 0},      # March - warming
            4: {'day': 5, 'night': 3},      # April - hot
            5: {'day': 8, 'night': 5},      # May - peak summer
            6: {'day': 6, 'night': 4},      # June - still hot
            7: {'day': 2, 'night': 2},      # July - monsoon cooling
            8: {'day': 1, 'night': 1},      # August - monsoon
            9: {'day': 1, 'night': 1},      # September - post monsoon
            10: {'day': 0, 'night': 0},     # October - moderate
            11: {'day': -2, 'night': -2},   # November - cooling
            12: {'day': -4, 'night': -4}    # December - cool
        }
        
        # Year-over-year warming trend
        year_trend = {2024: 0, 2025: 0.5, 2026: 1.0}
        
        comparison_data = []
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        for month_num in range(1, 13):
            month_name = months[month_num - 1]
            month_data = {
                'month': month_name,
                'month_num': month_num,
                'years': {}
            }
            
            for year in [2024, 2025, 2026]:
                # Skip future months for 2026
                if year == 2026 and month_num > current_month:
                    month_data['years'][year] = None
                    continue
                
                # Calculate city average or specific city data
                day_temps = []
                night_temps = []
                demands = []
                ac_hours_list = []
                
                for city in cities:
                    city_id = city['id']
                    base = city_base_temps.get(city_id, {'day': 32, 'night': 23})
                    variation = monthly_variations[month_num]
                    trend = year_trend[year]
                    
                    # Add some randomness for realistic variation
                    random.seed(f"{city_id}_{year}_{month_num}")
                    noise = random.uniform(-1, 1)
                    
                    day_temp = base['day'] + variation['day'] + trend + noise
                    night_temp = base['night'] + variation['night'] + trend + noise * 0.7
                    
                    day_temps.append(day_temp)
                    night_temps.append(night_temp)
                    
                    # Calculate demand index
                    demand = min(100, max(0, int((night_temp - 15) * 7)))
                    demands.append(demand)
                    
                    # Calculate AC hours
                    ac_hours = max(0, min(24, round((night_temp - 18) * 2.5 + (day_temp - 30) * 0.5, 1)))
                    ac_hours_list.append(ac_hours)
                
                month_data['years'][year] = {
                    'avg_day_temp': round(sum(day_temps) / len(day_temps), 1),
                    'avg_night_temp': round(sum(night_temps) / len(night_temps), 1),
                    'max_day_temp': round(max(day_temps), 1),
                    'max_night_temp': round(max(night_temps), 1),
                    'avg_demand': round(sum(demands) / len(demands), 1),
                    'avg_ac_hours': round(sum(ac_hours_list) / len(ac_hours_list), 1)
                }
            
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
                'month_filter': month_filter,
                'years_compared': [2024, 2025, 2026],
                'current_date': datetime.now().strftime('%Y-%m-%d')
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=Config.PORT,
        debug=(Config.FLASK_ENV == 'development')
    )
