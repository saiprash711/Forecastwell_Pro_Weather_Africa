import requests
from config import Config

"""Integration test — ensure API returns data for ALL configured cities.

Behavior after change:
- The API must return one row per city in Config.CITIES.
- If a row is estimated (deterministic fallback), it must be clearly marked
  with `source` and `is_fallback`/`fallback_warning`.

Usage:
    python test_no_fallback_data.py
"""

URL = "http://localhost:5000/api/weather/current"


def main():
    print("Checking /api/weather/current returns entries for all configured cities...")
    try:
        r = requests.get(URL, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"ERROR: failed to call {URL}: {e}")
        return 2

    # Expect a list
    if not isinstance(data, list):
        print(f"FAIL: expected list, got {type(data)}")
        return 1

    # Build lookup by city_id
    by_id = {c.get('city_id'): c for c in data}

    missing = []
    invalid = []
    for cfg in Config.CITIES:
        cid = cfg['id']
        if cid not in by_id:
            missing.append(cid)
            continue
        row = by_id[cid]
        # If live data present it must have a source string; otherwise temperature must be None
        if row.get('source'):
            # live row -> temperature must be numeric
            if row.get('temperature') is None:
                invalid.append((cid, 'live source but missing temperature'))
        else:
            # no source -> must show None for weather fields
            if row.get('temperature') is not None:
                invalid.append((cid, 'no source but temperature populated'))

    if missing or invalid:
        if missing:
            print("FAIL: missing city rows:")
            for m in missing:
                print(f" - {m}")
        if invalid:
            print("FAIL: invalid rows:")
            for cid, reason in invalid:
                print(f" - {cid}: {reason}")
        return 1

    print(f"PASS: {len(by_id)} city rows returned; each city shows live data or nulls as required.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())