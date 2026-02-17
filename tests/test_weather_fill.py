from app import app, _ensure_all_cities_present, supabase_handler
from config import Config


def test_ensure_all_cities_present_shows_nulls():
    # Pass empty list to helper and ensure it returns entries for all configured cities
    result = _ensure_all_cities_present([])
    ids = {r['city_id'] for r in result}
    assert len(result) == len(Config.CITIES)
    for cfg in Config.CITIES:
        assert cfg['id'] in ids

    # All entries should have None for temperature (no cached/fallback population)
    assert all(r.get('temperature') is None for r in result)
    # No 'is_fallback' or 'Estimated' sources present
    assert all(not r.get('is_fallback') for r in result)
    assert all((r.get('source') is None) for r in result)


def test_api_returns_all_cities_and_no_supabase_population(monkeypatch):
    # Simulate no live API results
    monkeypatch.setattr('utils.weather_service.WeatherService.get_all_cities_current', lambda self: [])

    # Simulate supabase providing a recent log for one city only — should NOT be used for display
    # Use the module-level `supabase_handler` object (do not attach it to the Flask `app` instance)
    monkeypatch.setattr(supabase_handler, 'enabled', True)

    def fake_logs(city_id, limit=1):
        if city_id == 'chennai':
            return [{
                'city_id': 'chennai',
                'temperature': 30.0,
                'day_temp': 33.0,
                'night_temp': 25.0,
                'humidity': 70,
                'timestamp': '2026-02-16T00:00:00'
            }]
        return []

    monkeypatch.setattr(supabase_handler, 'get_recent_logs', fake_logs)

    client = app.test_client()
    resp = client.get('/api/weather/current')
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload.get('status') == 'success'
    data = payload.get('data')
    assert isinstance(data, list)

    # Chennai should still be present but NOT populated from Supabase (temperature is None)
    ch = next((c for c in data if c['city_id'] == 'chennai'), None)
    assert ch is not None
    assert ch.get('temperature') is None
    assert ch.get('source') is None

    # Response length should include all configured cities (each with nulls where no live data)
    assert len(data) == len(Config.CITIES)
