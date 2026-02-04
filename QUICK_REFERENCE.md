# ⚡ ForecastWell Dashboard - Quick Reference

## 🚀 FASTEST START (3 Steps)

1. **Double-click**: `start.bat`
2. **Wait**: 30 seconds for setup
3. **Open**: http://localhost:5000

## 📋 What You'll See

### Dashboard Header
- **Avg Temperature**: Average across 6 cities
- **Peak Temperature**: Highest current temperature
- **Demand Index**: 0-100 scale (higher = more demand)
- **Active Alerts**: Critical/high alerts count

### Main Sections
1. **Left Panel**: Interactive map of South India
2. **Right Panel**: Alerts with recommendations
3. **Bottom**: Temperature trend chart
4. **Cities Grid**: All 6 cities overview

## 🎯 Understanding Alerts

| Alert Level | Temperature | Action | Priority |
|-------------|-------------|---------|----------|
| 🔴 **CRITICAL** | ≥40°C | Increase inventory 50-60% | URGENT |
| 🟠 **HIGH** | ≥35°C | Increase inventory 30-40% | HIGH |
| 🔵 **LOW** | ≤28°C | Reduce inventory | LOW |
| 🟢 **NORMAL** | 28-35°C | Maintain standard | ROUTINE |

## 💡 Key Features

### Map Interaction
- **Click marker**: View city details
- **Colors**: Blue (cool), Yellow (warm), Red (hot)
- **Popup**: Shows temp, humidity, wind, demand index

### Charts
- **Blue line**: Historical data (30 days)
- **Orange dashed**: Forecast (7 days)
- **Hover**: See exact values

### City Cards
- **Click card**: Load detailed analysis
- **Demand meter**: Visual representation 0-100
- **Stats**: Humidity and wind speed

## 🔧 Quick Troubleshooting

### Problem: Dashboard not loading
**Solution**: 
```powershell
# Restart the server
Ctrl+C
python app.py
```

### Problem: Map not showing
**Solution**: Check internet connection (needs Leaflet CDN)

### Problem: Port 5000 in use
**Solution**: Edit `.env` file, change `PORT=5001`

## 📊 API Quick Reference

All endpoints: `http://localhost:5000/api/...`

- `/dashboard/summary` - Overview stats
- `/weather/current` - All cities weather
- `/weather/city/chennai` - Chennai details
- `/alerts` - All alerts

## 🎨 Customization

### Change Temperature Thresholds
Edit [config.py](config.py):
```python
THRESHOLD_HIGH = 35      # Your value
THRESHOLD_CRITICAL = 40  # Your value
THRESHOLD_LOW = 28       # Your value
```

### Add More Cities
Edit [config.py](config.py) CITIES array with new city info.

## 📱 Mobile Access

Dashboard is mobile-responsive. Access from phone:
1. Find your computer's IP: `ipconfig`
2. Open on phone: `http://YOUR_IP:5000`

## 🔄 Data Refresh

- **Auto**: Every 5 minutes
- **Manual**: Click "🔄 Refresh" button
- **Last Update**: Shown at bottom

## 📖 Documentation Files

- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Complete overview
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Installation details
- [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) - Technical specs
- [README.md](README.md) - Quick introduction

## 🎯 Business Scenarios

### Heat Wave Detection
```
Temperature > 40°C → CRITICAL Alert
→ Action: Increase inventory 50-60%
→ Alert distribution network
→ Activate emergency protocols
```

### Normal Conditions
```
Temperature 28-35°C → NORMAL
→ Action: Maintain standard inventory
→ Monitor daily
→ No urgent action needed
```

### Cooling Trend
```
Temperature < 28°C → LOW
→ Action: Reduce inventory
→ Focus on other products
→ Plan off-season activities
```

## 🎓 Training Tips

### For Operations Team
1. Check dashboard every morning
2. Review alert panel first
3. Act on critical/high alerts within 24 hours
4. Monitor demand index trends

### For Management
1. Review weekly temperature trends
2. Compare demand indices across cities
3. Plan inventory based on 7-day forecast
4. Use recommendations for strategic decisions

## ⚙️ Advanced Features

### Export Data (Future)
- Click export button
- Download as Excel/PDF
- Use for reports

### Email Alerts (Planned)
- Configure email in settings
- Receive critical alerts
- Daily summary reports

## 🆘 Support

### Self-Help
1. Check this quick reference
2. Read SETUP_GUIDE.md
3. Review error messages
4. Restart application

### Technical Issues
- Check Python is installed: `python --version`
- Verify dependencies: `pip list`
- View logs in terminal window
- Try reinstalling: `pip install -r requirements.txt --force-reinstall`

## 📞 Contact

**Project**: ForecastWell Dashboard  
**Developer**: Hansei Consultancy  
**Version**: 1.0.0

## ✅ Daily Checklist

- [ ] Open dashboard at start of day
- [ ] Check active alerts count
- [ ] Review any critical/high alerts
- [ ] Note peak temperatures
- [ ] Check 7-day forecast
- [ ] Take recommended actions
- [ ] Update inventory plans

## 🎉 Quick Tips

💡 **Tip 1**: Bookmark http://localhost:5000  
💡 **Tip 2**: Keep terminal window open while using  
💡 **Tip 3**: Refresh if data seems old  
💡 **Tip 4**: Check multiple cities before decisions  
💡 **Tip 5**: Use forecast for weekly planning  

---

**Remember**: Dashboard auto-refreshes every 5 minutes. For urgent updates, click the Refresh button!

---

*Need more help? Open [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions.*
