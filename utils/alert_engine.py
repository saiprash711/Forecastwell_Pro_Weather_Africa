"""
Alert Engine Module
Handles threshold monitoring and demand acceleration/de-acceleration triggers
Per ForecastWell Guide: Night temperature is MORE important than day temperature!
Enhanced: DSB methodology, heat wave alerts, service demand predictions
"""
import sys
# Fix Windows console encoding for emoji
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from datetime import datetime
from config import Config

class AlertEngine:
    """Engine for generating alerts and recommendations"""
    
    def __init__(self):
        # Day temperature thresholds
        self.threshold_red_day = Config.THRESHOLD_RED_DAY
        self.threshold_orange_day = Config.THRESHOLD_ORANGE_DAY
        self.threshold_yellow_day = Config.THRESHOLD_YELLOW_DAY
        self.threshold_green_day = Config.THRESHOLD_GREEN_DAY
        
        # Night temperature thresholds (MORE IMPORTANT!)
        self.threshold_red_night = Config.THRESHOLD_RED_NIGHT
        self.threshold_orange_night = Config.THRESHOLD_ORANGE_NIGHT
        self.threshold_yellow_night = Config.THRESHOLD_YELLOW_NIGHT
        self.threshold_green_night = Config.THRESHOLD_GREEN_NIGHT
        
        # Tropical coastal special
        self.tropical_coastal_night_threshold = Config.TROPICAL_COASTAL_NIGHT_THRESHOLD
        self.tropical_coastal_cities = Config.TROPICAL_COASTAL_CITIES
        
        # Track sent alerts to avoid spam
        self.sent_alerts = set()
    
    def should_send_notification(self, alert):
        """Determine if notification should be sent for this alert"""
        # Only send for critical/high alerts
        if alert['alert_level'] not in ['red', 'orange', 'kerala_special']:
            return False
        
        # Create unique key for this alert
        alert_key = f"{alert['city_id']}_{alert['alert_level']}_{alert['night_temp']}"
        
        # Check if already sent
        if alert_key in self.sent_alerts:
            return False
        
        # Mark as sent
        self.sent_alerts.add(alert_key)
        return True
    
    def send_alert_notification(self, alert):
        """Send notification for critical alert"""
        try:
            from utils.notification_service import NotificationService
            
            if not self.should_send_notification(alert):
                return
            
            # Send notification
            results = NotificationService.notify_alert(alert)
            print(f"📧 Alert notification sent for {alert['city']}: {results}")
            
        except Exception as e:
            print(f"⚠️ Failed to send alert notification: {e}")
        
    def analyze_temperature(self, day_temp, night_temp, city_name, city_id, humidity=None):
        """
        Analyze day AND night temperature and generate alerts
        CRITICAL: Night temperature is MORE important than day temperature!
        
        Args:
            day_temp: Daytime temperature
            night_temp: Nighttime temperature (MORE IMPORTANT!)
            city_name: Name of the city
            city_id: City identifier
            
        Returns:
            dict: Alert information with color coding
        """
        # Calculate AC usage hours based on temps
        ac_hours = self._calculate_ac_hours(day_temp, night_temp)
        
        # Get color code based on NIGHT temp (priority) and day temp
        night_color = self._get_temp_color(night_temp, is_night=True)
        day_color = self._get_temp_color(day_temp, is_night=False)
        
        # Night temp determines the primary alert level
        alert_level = night_color['level']
        primary_color = night_color['color']
        
        # Tropical Coastal Special: Purple alert for hot humid nights
        is_kerala_special = (city_id in self.tropical_coastal_cities and
                            night_temp >= self.tropical_coastal_night_threshold)

        if is_kerala_special:
            primary_color = 'PURPLE'
            alert_level = 'kerala_special'
        
        # DSB zone classification
        from utils.data_processor import DataProcessor
        dp = DataProcessor()
        demand_index = dp.calculate_demand_index(day_temp, night_temp, humidity)
        dsb_zone = dp.get_dsb_zone(demand_index)
        
        # Get city config for demand zone info
        city_config = next((c for c in Config.CITIES if c['id'] == city_id), {})
        
        alert = {
            'city': city_name,
            'city_id': city_id,
            'day_temp': day_temp,
            'night_temp': night_temp,
            'timestamp': datetime.now().isoformat(),
            'alert_level': alert_level,
            'color_code': primary_color,
            'day_color': day_color['color'],
            'night_color': night_color['color'],
            'trigger_type': night_color['trigger'],
            'ac_hours_estimated': ac_hours,
            'is_kerala_special': is_kerala_special,
            'priority_note': 'Night temp drives demand!' if ac_hours > 10 else None,
            'demand_index': round(demand_index, 1),
            'dsb_zone': dsb_zone,
            'demand_zone': city_config.get('demand_zone', 'Unknown'),
            'zone_icon': city_config.get('zone_icon', '📍'),
            'recommendation': self._get_recommendation(
                night_color, day_color, city_name, ac_hours, is_kerala_special
            ),
            'reason': f"Night temp {night_temp}°C ({night_color['trigger']})"
        }
        
        # Send notification if critical
        self.send_alert_notification(alert)
        
        return alert
    
    def analyze_forecast(self, forecast_data, city_name):
        """
        Analyze forecast data and predict demand trends
        
        Args:
            forecast_data: List of forecast data
            city_name: Name of the city
            
        Returns:
            dict: Forecast analysis
        """
        if not forecast_data:
            return None
            
        avg_day_temp = sum(day.get('day_temp', day.get('temperature', 0)) for day in forecast_data) / len(forecast_data)
        avg_night_temp = sum(day.get('night_temp', day.get('min_temp', 0)) for day in forecast_data) / len(forecast_data)
        max_temp = max(day.get('max_temp', day.get('day_temp', 0)) for day in forecast_data)
        avg_temp = (avg_day_temp + avg_night_temp) / 2

        hot_night_days = sum(1 for day in forecast_data if day.get('night_temp', 0) >= self.threshold_red_night)
        high_temp_days = sum(1 for day in forecast_data if day.get('day_temp', day.get('temperature', 0)) >= self.threshold_red_day)

        analysis = {
            'city': city_name,
            'period_days': len(forecast_data),
            'avg_temperature': round(avg_temp, 1),
            'avg_day_temp': round(avg_day_temp, 1),
            'avg_night_temp': round(avg_night_temp, 1),
            'max_temperature': round(max_temp, 1),
            'high_temp_days': high_temp_days,
            'hot_night_days': hot_night_days,
            'demand_trend': self._calculate_demand_trend(avg_day_temp, avg_night_temp, hot_night_days, len(forecast_data)),
            'recommendations': []
        }
        
        # Generate recommendations based on trend
        if analysis['demand_trend'] == 'HIGH':
            analysis['recommendations'] = [
                f"Increase AC inventory for {city_name} by 30-40%",
                "Accelerate production planning for next 2 weeks",
                "Alert distribution partners for increased demand",
                "Ensure service team availability"
            ]
        elif analysis['demand_trend'] == 'MODERATE':
            analysis['recommendations'] = [
                f"Maintain normal inventory levels for {city_name}",
                "Monitor temperature trends daily",
                "Prepare for potential demand increase"
            ]
        else:
            analysis['recommendations'] = [
                f"Consider reducing AC inventory for {city_name}",
                "Focus on other product lines",
                "Plan maintenance activities during low demand"
            ]
            
        return analysis
    
    def get_all_alerts(self, cities_weather_data):
        """
        Generate alerts for all cities
        
        Args:
            cities_weather_data: List of weather data for all cities
            
        Returns:
            list: All alerts sorted by priority
        """
        alerts = []
        
        for city_data in cities_weather_data:
            # Skip cities with no temperature data (API unavailable)
            temp = city_data.get('temperature')
            day_temp = city_data.get('day_temp') or temp
            night_temp = city_data.get('night_temp') or (temp - 5 if temp is not None else None)
            if day_temp is None or night_temp is None:
                continue
            alert = self.analyze_temperature(
                day_temp,
                night_temp,
                city_data['city_name'],
                city_data['city_id'],
                humidity=city_data.get('humidity')
            )
            alerts.append(alert)
            
        # Sort by priority: kerala_special > red > orange > yellow > green > blue
        priority_order = {
            'kerala_special': 0,
            'red': 1,
            'orange': 2,
            'yellow': 3,
            'green': 4,
            'blue': 5
        }
        alerts.sort(key=lambda x: priority_order.get(x['alert_level'], 6))
        
        return alerts
    
    def _calculate_ac_hours(self, day_temp, night_temp):
        """
        Calculate estimated AC usage hours
        CRITICAL INSIGHT: Night temp drives AC hours more than day temp!
        
        Example:
        - Day 35°C + Night 21°C = 4-6 hours (afternoon only)
        - Day 32°C + Night 25°C = 12-16 hours (evening + overnight)
        """
        ac_hours = 0
        
        # Daytime AC usage (typically 4-6 hours in afternoon)
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
    
    def _get_temp_color(self, temp, is_night=False):
        """Get color code and trigger type based on temperature"""
        if is_night:
            # Night temperature color coding
            if temp >= self.threshold_red_night:
                return {
                    'color': 'RED',
                    'level': 'red',
                    'trigger': 'EXTREME - Full Push',
                    'action': 'CRITICAL_ACCELERATION'
                }
            elif temp >= self.threshold_orange_night:
                return {
                    'color': 'ORANGE',
                    'level': 'orange',
                    'trigger': 'STRONG - Accelerate',
                    'action': 'ACCELERATION'
                }
            elif temp >= self.threshold_yellow_night:
                return {
                    'color': 'YELLOW',
                    'level': 'yellow',
                    'trigger': 'WARM - Position Stock',
                    'action': 'POSITION'
                }
            elif temp >= self.threshold_green_night:
                return {
                    'color': 'GREEN',
                    'level': 'green',
                    'trigger': 'NORMAL - Monitor',
                    'action': 'MONITOR'
                }
            else:
                return {
                    'color': 'BLUE',
                    'level': 'blue',
                    'trigger': 'COOL - Off Season',
                    'action': 'DE-ACCELERATION'
                }
        else:
            # Day temperature color coding
            if temp >= self.threshold_red_day:
                return {
                    'color': 'RED',
                    'level': 'red',
                    'trigger': 'EXTREME - Full Push',
                    'action': 'CRITICAL_ACCELERATION'
                }
            elif temp >= self.threshold_orange_day:
                return {
                    'color': 'ORANGE',
                    'level': 'orange',
                    'trigger': 'STRONG - Accelerate',
                    'action': 'ACCELERATION'
                }
            elif temp >= self.threshold_yellow_day:
                return {
                    'color': 'YELLOW',
                    'level': 'yellow',
                    'trigger': 'WARM - Position Stock',
                    'action': 'POSITION'
                }
            elif temp >= self.threshold_green_day:
                return {
                    'color': 'GREEN',
                    'level': 'green',
                    'trigger': 'NORMAL - Monitor',
                    'action': 'MONITOR'
                }
            else:
                return {
                    'color': 'BLUE',
                    'level': 'blue',
                    'trigger': 'COOL - Off Season',
                    'action': 'DE-ACCELERATION'
                }
    
    def _get_recommendation(self, night_color, day_color, city, ac_hours, is_kerala_special):
        """Generate recommendations based on day and night temperatures"""
        if is_kerala_special:
            return {
                'action': 'TROPICAL COASTAL SPECIAL - HOT HUMID NIGHTS',
                'priority': 'PURPLE',
                'steps': [
                    f'🟣 TROPICAL COASTAL: {city} experiencing hot humid nights',
                    f'Estimated {ac_hours} hours AC usage (mostly nighttime!)',
                    'Coastal humidity + hot nights = HIGH overnight demand',
                    'Push premium models with sleep mode features',
                    'Increase inverter AC inventory by 40-50%',
                    'Target marketing: "Sleep cool with inverter ACs"',
                    'Ensure service teams available for installations'
                ]
            }
        
        # Use night temp as primary driver
        if night_color['level'] == 'red':
            return {
                'action': 'EXTREME DEMAND - HOT NIGHTS',
                'priority': 'CRITICAL',
                'steps': [
                    f'🔴 EXTREME: {city} - {ac_hours} hours AC usage expected',
                    f'Night temp {night_color["color"]} + Day temp {day_color["color"]}',
                    'Hot nights = ALL NIGHT AC usage = MAXIMUM demand',
                    'Immediately increase inventory by 50-60%',
                    'Expedite shipments - HOT NIGHTS drive highest sales',
                    'Alert all distributors - stock will move fast',
                    'Deploy additional service teams',
                    'Launch "Cool Nights" marketing campaign'
                ]
            }
        elif night_color['level'] == 'orange':
            return {
                'action': 'HIGH DEMAND - WARM NIGHTS',
                'priority': 'HIGH',
                'steps': [
                    f'🟠 HIGH: {city} - {ac_hours} hours AC usage',
                    f'Night temp {night_color["color"]} driving extended usage',
                    'Warm nights = Evening + overnight demand',
                    'Increase AC inventory by 30-40%',
                    'Position stock at key distributors',
                    'Prepare for sustained demand',
                    'Monitor daily - may escalate to RED'
                ]
            }
        elif night_color['level'] == 'yellow':
            return {
                'action': 'MODERATE DEMAND - POSITIONING',
                'priority': 'MEDIUM',
                'steps': [
                    f'🟡 WARM: {city} - {ac_hours} hours AC usage',
                    'Comfortable nights but warm days',
                    'Position inventory strategically',
                    'Standard stock levels + 20%',
                    'Monitor temperature trends',
                    'Prepare for potential escalation'
                ]
            }
        elif night_color['level'] == 'green':
            return {
                'action': 'NORMAL - MONITOR',
                'priority': 'NORMAL',
                'steps': [
                    f'🟢 NORMAL: {city} - {ac_hours} hours AC usage',
                    'Pleasant nights, moderate demand',
                    'Maintain standard inventory',
                    'Regular monitoring',
                    'Focus on other product lines'
                ]
            }
        else:  # blue
            return {
                'action': 'LOW DEMAND - OFF SEASON',
                'priority': 'LOW',
                'steps': [
                    f'🔵 COOL: {city} - {ac_hours} hours AC usage',
                    'Cool nights = minimal AC demand',
                    'Reduce inventory replenishment',
                    'Focus on heaters/other products',
                    'Plan off-season promotions',
                    'Schedule equipment maintenance'
                ]
            }
    
    def analyze_wave_sequence(self, all_cities_forecast):
        """
        Analyze market wave sequence: Wave 1 (NOW) → Wave 2 (+2 weeks) → Wave 3 (+6 weeks)
        Per Guide: Lead indicators → Building markets → Lag markets
        
        Args:
            all_cities_forecast: Dict of forecasts for all cities
            
        Returns:
            dict: Wave sequence analysis
        """
        waves = {
            'wave_1_now': {
                'name': 'Wave 1: NOW - Lead Indicators',
                'cities': [],
                'action': 'PUSH NOW',
                'description': 'Hottest day/night cities - immediate demand'
            },
            'wave_2_building': {
                'name': 'Wave 2: +2 Weeks - Building Markets',
                'cities': [],
                'action': 'POSITION',
                'description': 'Interior cities warming - following lead indicators'
            },
            'wave_3_lag': {
                'name': 'Wave 3: +6 Weeks - Lag Markets',
                'cities': [],
                'action': 'PLAN',
                'description': 'Coastal/pleasant metros - plan ahead'
            }
        }
        
        # Analyze each city
        for city_id, forecast in all_cities_forecast.items():
            if not forecast:
                continue
            
            current_night_temp = forecast[0].get('night_temp', 20)
            week_2_night_temp = forecast[min(14, len(forecast)-1)].get('night_temp', 20) if len(forecast) > 7 else current_night_temp
            
            city_info = next((c for c in Config.CITIES if c['id'] == city_id), None)
            if not city_info:
                continue
            
            city_data = {
                'name': city_info['name'],
                'id': city_id,
                'current_night_temp': current_night_temp,
                'trend': 'warming' if week_2_night_temp > current_night_temp else 'cooling'
            }
            
            # Classify into waves based on night temperature (MORE IMPORTANT!)
            if current_night_temp >= 23:
                waves['wave_1_now']['cities'].append(city_data)
            elif current_night_temp >= 20 or (current_night_temp >= 18 and city_data['trend'] == 'warming'):
                waves['wave_2_building']['cities'].append(city_data)
            else:
                waves['wave_3_lag']['cities'].append(city_data)
        
        return waves
    
    def _calculate_demand_trend(self, avg_day_temp, avg_night_temp, hot_night_days, total_days):
        """
        Calculate demand trend based on day AND night temperature analysis
        Night temp is the PRIMARY driver!
        """
        # Night temperature is MORE IMPORTANT
        night_score = 0
        if avg_night_temp >= self.threshold_red_night:
            night_score = 3
        elif avg_night_temp >= self.threshold_orange_night:
            night_score = 2
        elif avg_night_temp >= self.threshold_yellow_night:
            night_score = 1
        
        # Day temperature is secondary
        day_score = 0
        if avg_day_temp >= self.threshold_red_day:
            day_score = 2
        elif avg_day_temp >= self.threshold_orange_day:
            day_score = 1.5
        elif avg_day_temp >= self.threshold_yellow_day:
            day_score = 1
        
        # Combined score (night weighted 60%, day 40%)
        combined_score = (night_score * 0.6) + (day_score * 0.4)
        
        # Also factor in number of hot nights
        if hot_night_days >= (total_days * 0.5):
            combined_score += 1
        
        if combined_score >= 2.5:
            return 'HIGH'
        elif combined_score >= 1.5:
            return 'MODERATE'
        else:
            return 'LOW'
