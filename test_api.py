"""
Quick test to verify the optimized API is working correctly
"""
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    
from app import app
import json

def test_dashboard_init():
    """Test the dashboard-init endpoint"""
    with app.test_client() as client:
        # Login first
        login_data = {'username': 'admin', 'password': 'forecast2026'}
        login_response = client.post('/login', data=login_data, follow_redirects=True)
        print(f"Login status: {login_response.status_code}")
        
        # Test dashboard-init
        response = client.get('/api/dashboard-init')
        print(f"Dashboard-init status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = json.loads(response.data)
            print(f"\nStatus: {data.get('status')}")
            
            if data.get('status') == 'success':
                init_data = data.get('data', {})
                weather = init_data.get('weather', [])
                kpis = init_data.get('kpis', {})
                
                print(f"Weather cities: {len(weather)}")
                print(f"KPIs keys: {list(kpis.keys())}")
                
                # Check compact format
                if weather:
                    first_city = weather[0]
                    print(f"\nFirst city format:")
                    print(f"  Keys: {list(first_city.keys())}")
                    print(f"  Has compact keys (n, t, dt, nt): {'n' in first_city}")
                    print(f"  Has full keys (city_name, temperature): {'city_name' in first_city}")
                
                # Check KPI format
                print(f"\nKPIs:")
                print(f"  d2p (days to peak): {kpis.get('d2p')}")
                print(f"  season: {kpis.get('season')}")
                print(f"  days_to_peak (legacy): {kpis.get('days_to_peak', 'N/A')}")
                print(f"  season_status (legacy): {kpis.get('season_status', 'N/A')}")
                
                print("\n✅ API test PASSED!")
                return True
            else:
                print(f"\n❌ API returned error: {data}")
                return False
        else:
            print(f"\n❌ API returned status {response.status_code}")
            print(f"Response: {response.data.decode('utf-8')}")
            return False

if __name__ == '__main__':
    print("=" * 60)
    print("Testing Optimized Dashboard API")
    print("=" * 60)
    test_dashboard_init()
