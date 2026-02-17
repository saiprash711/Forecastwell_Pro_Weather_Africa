"""
File-based persistent cache for weather data
Saves data to disk to survive app restarts and avoid rate limits
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path


class FileCache:
    """Simple file-based cache for weather data"""

    def __init__(self, cache_dir='cache_data', ttl_hours=12):
        """
        Initialize file cache

        Args:
            cache_dir: Directory to store cache files
            ttl_hours: How many hours before cache is considered stale
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.ttl_hours = ttl_hours

    def _get_cache_path(self, cache_key):
        """Get the file path for a cache key"""
        safe_key = cache_key.replace('/', '_').replace('\\', '_')
        return self.cache_dir / f"{safe_key}.json"

    def get(self, cache_key):
        """
        Get data from cache if it exists and is not stale

        Args:
            cache_key: Unique identifier for the cached data

        Returns:
            Cached data if valid, None otherwise
        """
        cache_path = self._get_cache_path(cache_key)

        if not cache_path.exists():
            return None

        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)

            # Check if cache is stale
            cached_time = datetime.fromisoformat(cache_data['cached_at'])
            age_hours = (datetime.now() - cached_time).total_seconds() / 3600

            if age_hours > self.ttl_hours:
                print(f"[FileCache] Cache for '{cache_key}' is stale ({age_hours:.1f}h old, TTL={self.ttl_hours}h)")
                return None

            return cache_data['data']

        except Exception as e:
            print(f"[FileCache] Error reading cache for '{cache_key}': {e}")
            return None

    def set(self, cache_key, data):
        """
        Save data to cache

        Args:
            cache_key: Unique identifier for the cached data
            data: Data to cache (must be JSON serializable)
        """
        cache_path = self._get_cache_path(cache_key)

        try:
            cache_data = {
                'cached_at': datetime.now().isoformat(),
                'data': data
            }

            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, indent=2)

            pass  # Quiet save — errors still logged below

        except Exception as e:
            print(f"[FileCache] Error writing cache for '{cache_key}': {e}")

    def clear(self, cache_key=None):
        """
        Clear cache

        Args:
            cache_key: Specific key to clear, or None to clear all
        """
        if cache_key:
            cache_path = self._get_cache_path(cache_key)
            if cache_path.exists():
                cache_path.unlink()
                print(f"[FileCache] Cleared cache for '{cache_key}'")
        else:
            for cache_file in self.cache_dir.glob('*.json'):
                cache_file.unlink()
            print(f"[FileCache] Cleared all cache files")

    def get_cache_info(self, cache_key):
        """Get information about cached data without loading it"""
        cache_path = self._get_cache_path(cache_key)

        if not cache_path.exists():
            return None

        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)

            cached_time = datetime.fromisoformat(cache_data['cached_at'])
            age_hours = (datetime.now() - cached_time).total_seconds() / 3600

            return {
                'cached_at': cached_time,
                'age_hours': age_hours,
                'is_stale': age_hours > self.ttl_hours,
                'size_kb': cache_path.stat().st_size / 1024
            }

        except Exception:
            return None
