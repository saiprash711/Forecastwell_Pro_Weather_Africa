# Free Weather API Setup Guide

## ✅ Recommended: OpenWeatherMap (FREE)

### Why OpenWeatherMap?
- ✅ **FREE tier**: 1,000 API calls/day (enough for your dashboard)
- ✅ **No credit card required**
- ✅ **Excellent coverage** for Indian cities
- ✅ **Reliable and well-documented**
- ✅ **Current weather + forecasts + historical data**

### Setup Steps (5 minutes):

1. **Sign up for free account**
   - Go to: https://openweathermap.org/api
   - Click "Sign Up" (top right)
   - Fill in basic details (Name, Email, Password)
   - Verify your email

2. **Get your API key**
   - Login to your account
   - Go to: https://home.openweathermap.org/api_keys
   - Copy your default API key (or create a new one)
   - **Note**: New keys take ~10 minutes to activate

3. **Add to your project**
   - Create a `.env` file in your project root (copy from `.env.example`)
   - Add your API key:
     ```
     OPENWEATHER_API_KEY=your_actual_api_key_here
     ```

4. **Test it**
   ```bash
   python
   >>> from utils.weather_service import WeatherService
   >>> ws = WeatherService()
   >>> data = ws.get_current_weather('chennai')
   >>> print(data)
   ```

### API Limits (Free Tier)
- **Calls per day**: 1,000
- **Calls per minute**: 60
- **Data**: Current + 5-day forecast + 40 years historical
- **Update frequency**: Every 10 minutes

For your dashboard with 6 cities:
- Refresh every 10 minutes = 144 calls/day per city
- Total: ~864 calls/day (well within 1,000 limit!)

---

## Alternative Free Options

### 1. WeatherAPI.com (FREE)
- **Free tier**: 1 million calls/month
- **Setup**: https://www.weatherapi.com/signup.aspx
- **Coverage**: Excellent for India
- **Advantage**: Higher limits than OpenWeatherMap

### 2. Tomorrow.io (FREE)
- **Free tier**: 500 calls/day
- **Setup**: https://www.tomorrow.io/weather-api/
- **Coverage**: Good global coverage
- **Advantage**: Advanced weather data

### 3. Open-Meteo (FREE, NO API KEY!)
- **Free tier**: Unlimited (no key required!)
- **Setup**: https://open-meteo.com/
- **Coverage**: Global
- **Limitation**: Less detailed than OpenWeatherMap

---

## Data Priority (How Your System Works)

Your dashboard uses this order:
1. **Excel imported data** (if you upload via /api/upload-excel)
2. **OpenWeatherMap API** (if API key configured)
3. **IMD API** (if API key configured)
4. **Simulated data** (fallback for testing)

---

## Configuration File

Your `.env` file should look like:
```env
# Flask Configuration
SECRET_KEY=my-secret-key-123
FLASK_ENV=development
PORT=5000

# Weather API Keys
OPENWEATHER_API_KEY=abc123def456ghi789  # Get from openweathermap.org
IMD_API_KEY=  # Optional - leave empty if not available
```

---

## Troubleshooting

### "Invalid API key" error
- Wait 10 minutes after signup (activation delay)
- Check for typos in your API key
- Ensure no extra spaces in .env file

### "Rate limit exceeded"
- You've used 1,000+ calls today
- Wait until tomorrow or upgrade plan
- Reduce refresh frequency in your dashboard

### No data returned
- Check your internet connection
- Verify API key is in `.env` file
- Check terminal for error messages
- Test API directly: `curl "https://api.openweathermap.org/data/2.5/weather?lat=13.08&lon=80.27&appid=YOUR_KEY&units=metric"`

---

## Next Steps

1. ✅ Sign up for OpenWeatherMap (5 minutes)
2. ✅ Add API key to `.env` file
3. ✅ Restart your Flask app: `python app.py`
4. ✅ Open dashboard: http://localhost:5000
5. ✅ Check data source shows "OpenWeatherMap" instead of "Simulated"

Your dashboard will now show **REAL weather data** for all Indian cities! 🎉
