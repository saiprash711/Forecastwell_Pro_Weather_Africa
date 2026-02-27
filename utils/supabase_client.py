import os
from supabase import create_client, Client
from config import Config
from datetime import datetime
import json

class SupabaseHandler:
    """
    Handler for Supabase database interactions.
    Manages connection and CRUD operations for weather logs and alerts.
    """
    
    def __init__(self):
        self.url = Config.SUPABASE_URL
        self.key = Config.SUPABASE_KEY
        self.client: Client = None
        self.enabled = False
        
        if self.url and self.key:
            try:
                self.client = create_client(self.url, self.key)
                self.enabled = True
                print("[SUCCESS] Supabase client initialized successfully")
            except Exception as e:
                print(f"[ERROR] Failed to initialize Supabase client: {e}")
                self.enabled = False
        else:
            print("[WARNING] Supabase credentials not found. Database features disabled.")

    def _execute_with_retry(self, operation, max_retries=3, delay=1):
        import time
        last_error = None
        for attempt in range(max_retries):
            try:
                return operation()
            except Exception as e:
                last_error = e
                print(f"[WARNING] Supabase operation failed (Attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    if "10054" in str(e) or "connection" in str(e).lower() or "host" in str(e).lower():
                        try:
                            self.client = create_client(self.url, self.key)
                        except Exception:
                            pass
                    time.sleep(delay)
        raise last_error

    def save_weather_log(self, weather_data):
        """
        Save a single weather data record to the database.
        
        Args:
            weather_data (dict): Dictionary containing weather info
        """
        if not self.enabled:
            return None
            
        try:
            # Prepare data for insertion matching schema
            record = self._prepare_weather_record(weather_data)
            def _op():
                return self.client.table("weather_logs").insert(record).execute()
            response = self._execute_with_retry(_op)
            return getattr(response, 'data', response[0] if isinstance(response, tuple) else response)
        except Exception as e:
            print(f"[ERROR] Error saving weather log to Supabase: {e}")
            return None

    def save_weather_logs_batch(self, weather_data_list):
        """
        Save multiple weather records in a single batch.
        
        Args:
            weather_data_list (list): List of weather data dictionaries
        """
        if not self.enabled or not weather_data_list:
            return None
            
        try:
            records = [self._prepare_weather_record(wd) for wd in weather_data_list]
            records = [r for r in records if r] # Remove None records
            
            if not records:
                return None
                
            def _op():
                return self.client.table("weather_logs").insert(records).execute()
            response = self._execute_with_retry(_op)
            print(f"[SUCCESS] Batch saved {len(records)} weather logs to Supabase")
            return getattr(response, 'data', response[0] if isinstance(response, tuple) else response)
        except Exception as e:
            print(f"[ERROR] Error batch saving weather logs to Supabase: {e}")
            return None

    def _prepare_weather_record(self, weather_data):
        """Helper to prepare a weather record dictionary"""
        try:
            record = {
                "city_id": weather_data.get('city_id'),
                "city_name": weather_data.get('city_name'),
                "temperature": weather_data.get('temperature'),
                "day_temp": weather_data.get('day_temp'),
                "night_temp": weather_data.get('night_temp'),
                "humidity": weather_data.get('humidity'),
                "wind_speed": weather_data.get('wind_speed'),
                "demand_index": weather_data.get('demand_index'),
                "source": weather_data.get('source', 'Unknown'),
                "timestamp": datetime.now().isoformat()
            }
            # Remove None values
            return {k: v for k, v in record.items() if v is not None}
        except Exception:
            return None

    def save_alert(self, alert_data):
        """
        Save an alert to the database.
        
        Args:
            alert_data (dict): Dictionary containing alert info
        """
        if not self.enabled:
            return None
            
        try:
            record = {
                "city_id": alert_data.get('city_id') or alert_data.get('city'), # Handle key variation
                "alert_level": alert_data.get('alert_level'),
                "message": alert_data.get('message'),
                "recommendation": alert_data.get('recommendation'), # JSONB field
                "created_at": datetime.now().isoformat(),
                "acknowledged": False
            }
            
            def _op():
                return self.client.table("alerts").insert(record).execute()
            response = self._execute_with_retry(_op)
            return getattr(response, 'data', response[0] if isinstance(response, tuple) else response)
        except Exception as e:
            print(f"[ERROR] Error saving alert to Supabase: {e}")
            return None

    def get_recent_logs(self, city_id, limit=24):
        """Get recent weather logs for a city"""
        if not self.enabled:
            return []
            
        try:
            def _op():
                return self.client.table("weather_logs")\
                    .select("*")\
                    .eq("city_id", city_id)\
                    .order("timestamp", desc=True)\
                    .limit(limit)\
                    .execute()
            response = self._execute_with_retry(_op)
            return getattr(response, 'data', response)
        except Exception as e:
            print(f"[ERROR] Error fetching logs from Supabase: {e}")
            return []

    def get_active_alerts(self):
        """Get all unacknowledged alerts"""
        if not self.enabled:
            return []
            
        try:
            def _op():
                return self.client.table("alerts")\
                    .select("*")\
                    .eq("acknowledged", False)\
                    .order("created_at", desc=True)\
                    .execute()
            response = self._execute_with_retry(_op)
            return getattr(response, 'data', response)
        except Exception as e:
            print(f"[ERROR] Error fetching alerts from Supabase: {e}")
            return []

    def acknowledge_alert(self, alert_id):
        """Acknowledge an alert by its UUID in the database."""
        if not self.enabled:
            return None

        try:
            def _op():
                return self.client.table("alerts")\
                    .update({
                        "acknowledged": True,
                        "acknowledged_at": datetime.now().isoformat()
                    })\
                    .eq("id", alert_id)\
                    .execute()
            response = self._execute_with_retry(_op)
            return getattr(response, 'data', response[0] if isinstance(response, tuple) else response)
        except Exception as e:
            print(f"[ERROR] Error acknowledging alert in Supabase: {e}")
            return None

    def get_connection_status(self):
        """Check if Supabase connection is healthy."""
        if not self.enabled:
            return {"connected": False, "reason": "Credentials not configured"}

        try:
            # Simple query to verify connectivity
            response = self.client.table("weather_logs")\
                .select("id")\
                .limit(1)\
                .execute()
            return {"connected": True, "reason": "OK"}
        except Exception as e:
            return {"connected": False, "reason": str(e)}
