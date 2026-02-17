import json
from app import app


def test_dashboard_init_empty(monkeypatch):
    """When no cached weather exists, endpoint should return a well-formed empty payload."""
    monkeypatch.setattr('app.get_cached_weather', lambda: [])
    monkeypatch.setattr('app.refresh_alerts', lambda: [])

    client = app.test_client()
    resp = client.get('/api/dashboard-init')
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload['status'] == 'success'
    assert payload['data']['weather'] == []
    assert payload['data']['alerts'] == []
    kpis = payload['data']['kpis']
    assert kpis['hottest_day_city'] is None
    assert kpis['hottest_night_city'] is None


def test_dashboard_init_with_sample_data(monkeypatch):
    """Return sample weather and ensure KPIs/alerts are present in response."""
    sample = [{
        'city_id': 'chennai',
        'city_name': 'Chennai',
        'temperature': 30.0,
        'day_temp': 33.0,
        'night_temp': 25.0,
        'humidity': 70,
        'timestamp': '2026-02-16T00:00:00'
    }]

    monkeypatch.setattr('app.get_cached_weather', lambda: sample)
    monkeypatch.setattr('app.refresh_alerts', lambda: [{'city': 'Chennai', 'alert_level': 'red'}])

    client = app.test_client()
    resp = client.get('/api/dashboard-init')
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload['status'] == 'success'
    assert payload['data']['weather'] == sample
    assert len(payload['data']['alerts']) == 1
    assert 'kpis' in payload['data']
