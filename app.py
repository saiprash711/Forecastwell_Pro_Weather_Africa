"""
ForecastWell Dashboard - Flask Application
Weather-based demand forecasting for HVAC/Consumer Durables
Enhanced per ForecastWell Guide - Night Temperature Priority!
"""
from flask import Flask, render_template, jsonify, request, send_file
from flask_cors import CORS
from datetime import datetime
import random
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
    """Get current weather for all cities"""
    try:
        cities_weather = weather_service.get_all_cities_current()
        
        # Add demand index and AC hours to each city
        for city in cities_weather:
            day_temp = city.get('day_temp', city['temperature'])
            night_temp = city.get('night_temp', city['temperature'] - 5)
            
            city['demand_index'] = data_processor.calculate_demand_index(
                day_temp,
                night_temp,
                city.get('humidity')
            )
            city['ac_hours'] = data_processor.calculate_ac_hours(day_temp, night_temp)
        
        return jsonify({
            'status': 'success',
            'data': cities_weather,
            'timestamp': cities_weather[0]['timestamp'] if cities_weather else None
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
    """Get alerts for all cities"""
    try:
        cities_weather = weather_service.get_all_cities_current()
        alerts = alert_engine.get_all_alerts(cities_weather)
        
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
        cities_weather = weather_service.get_all_cities_current()
        alerts = alert_engine.get_all_alerts(cities_weather)
        
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
        cities_weather = weather_service.get_all_cities_current()
        
        # Calculate weekly projections
        weekly_data = []
        for city in cities_weather:
            forecast = weather_service.get_forecast(city['city_id'], days=7)
            if forecast:
                avg_day = sum(f.get('day_temp', f['temperature']) for f in forecast) / len(forecast)
                avg_night = sum(f.get('night_temp', f['temperature']-5) for f in forecast) / len(forecast)
                max_temp = max(f.get('day_temp', f['temperature']) for f in forecast)
                min_night = min(f.get('night_temp', f['temperature']-5) for f in forecast)
                
                # Determine trend
                first_half = forecast[:3]
                second_half = forecast[4:]
                first_avg = sum(f.get('day_temp', f['temperature']) for f in first_half) / len(first_half) if first_half else 0
                second_avg = sum(f.get('day_temp', f['temperature']) for f in second_half) / len(second_half) if second_half else 0
                trend = 'rising' if second_avg > first_avg else ('falling' if second_avg < first_avg else 'stable')
                
                weekly_data.append({
                    'city': city['city_name'],
                    'city_id': city['city_id'],
                    'avg_day_temp': round(avg_day, 1),
                    'avg_night_temp': round(avg_night, 1),
                    'max_temp': round(max_temp, 1),
                    'min_night_temp': round(min_night, 1),
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
        cities_weather = weather_service.get_all_cities_current()
        
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
        cities_weather = weather_service.get_all_cities_current()
        
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
        cities_weather = weather_service.get_all_cities_current()
        
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


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=Config.PORT,
        debug=(Config.FLASK_ENV == 'development')
    )
