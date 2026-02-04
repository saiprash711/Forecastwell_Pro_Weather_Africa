# ⚡ ForecastWell Dashboard - QUICK START

## 🚀 START IN 30 SECONDS

```powershell
# Step 1: Open PowerShell
cd "c:\Users\spras\OneDrive\Desktop\Hansei Consultancy\Jan 2026\Weather Based Dashboard"

# Step 2: Run the dashboard
python app.py

# Step 3: Open your browser
# Go to: http://localhost:5000
```

That's it! Dashboard is running! 🎉

---

## 📊 WHAT YOU'LL SEE

### Top Header (KPIs per Guide)
✅ **Hottest Day City**: e.g., "Chennai (39°C)"  
⭐ **Hottest Night**: e.g., "Kochi (25°C)" ← DRIVES DEMAND!  
✅ **Season Status**: "🔥 Peak Season" or "📈 Building Season"  
✅ **Days to Peak**: "5 days" or "Already at peak"  

### Wave Sequence (New Feature!)
🔴 **Wave 1 (NOW)**: Cities needing inventory NOW  
🟠 **Wave 2 (+2 Weeks)**: Position stock soon  
🔵 **Wave 3 (+6 Weeks)**: Plan ahead  

### Interactive Map
- 6 South India cities with color markers
- Click city = See details popup
- Shows: Day temp, Night temp, AC hours

### Alerts Panel
- Sorted by priority
- Shows estimated AC usage hours
- Specific recommendations
- Kerala special (purple) if applicable

### Temperature Charts
- Historical (30 days)
- Forecast (7 days)
- Day and night temps

### Cities Grid
- All 6 cities at a glance
- Click any city for details

---

## 🎨 COLOR LEGEND (Per Your Guide)

| Color | Temp Range | Action | What to Do |
|-------|------------|--------|------------|
| 🔴 **RED** | Day ≥38°C or Night ≥24°C | EXTREME | Increase inventory 50-60% |
| 🟠 **ORANGE** | Day 36-37°C or Night 22-23°C | STRONG | Increase inventory 30-40% |
| 🟡 **YELLOW** | Day 34-35°C or Night 20-21°C | WARM | Position stock +20% |
| 🟢 **GREEN** | Day 32-33°C or Night 18-19°C | NORMAL | Monitor, standard levels |
| 🔵 **BLUE** | Day <32°C or Night <18°C | COOL | Reduce inventory |
| 🟣 **PURPLE** | Kerala Night ≥24°C | KERALA SPECIAL | Hot coastal nights! |

---

## 💡 KEY INSIGHT (Your #1 Priority)

### Night Temperature > Day Temperature for AC Demand!

**Example from your guide:**
- Day 35°C + Night 21°C = 4-6 hours AC = **MEDIUM** demand
- Day 32°C + Night 25°C = 12-16 hours AC = **HIGH** demand

**Why?** Hot nights = people use AC all night (12+ hours) vs just afternoon (4-6 hours)

This is implemented throughout the dashboard! ⭐

---

## 🌊 Understanding Wave Sequence

### Wave 1 (NOW) - Red Border
- **Cities**: Hottest now (day/night)
- **Action**: PUSH NOW
- **Inventory**: Immediate 50-60% increase
- **Example**: Cities hitting 38°C day or 24°C night

### Wave 2 (+2 Weeks) - Orange Border
- **Cities**: Warming up, following wave 1
- **Action**: POSITION
- **Inventory**: Position stock, +30-40%
- **Example**: Interior cities showing warming trend

### Wave 3 (+6 Weeks) - Blue Border
- **Cities**: Coastal/metros, lag behind
- **Action**: PLAN
- **Inventory**: Plan ahead, no rush
- **Example**: Pleasant metros, will heat later

---

## 🔧 TROUBLESHOOTING

### Problem: Port 5000 already in use
```powershell
# Edit .env file, change:
PORT=5001
```

### Problem: Module not found
```powershell
pip install -r requirements.txt --force-reinstall
```

### Problem: Dashboard not loading
```powershell
# Check if server is running
# You should see: "Running on http://0.0.0.0:5000"
```

---

## 📥 EXPORT FEATURES

### Export to Excel
1. Click "📥 Export Excel" button
2. File downloads with:
   - All city data
   - Day/night temperatures
   - AC hours
   - Alerts
   - Wave sequence

### Upload Excel (6-City IMD Format)
1. Click "📤 Upload Excel" button
2. Select your Excel file
3. Dashboard updates with your data

---

## 🎯 DAILY WORKFLOW

### Morning Check (5 minutes)
1. Open dashboard
2. Check header KPIs
3. Note hottest night city (priority!)
4. Review wave sequence
5. Check any red/orange alerts

### Action Items
- **Red alerts**: Act within 24 hours
- **Orange alerts**: Plan within 3 days  
- **Purple (Kerala)**: Special coastal attention

### Weekly Review
- Temperature trends (30-day chart)
- Wave sequence changes
- Season status updates

---

## 📱 MOBILE ACCESS

Dashboard works on mobile! Access from phone:
1. Find your computer's IP: `ipconfig` in PowerShell
2. On phone, open: `http://YOUR_IP:5000`

---

## ⚙️ CUSTOMIZATION

### Change Temperature Thresholds
Edit `config.py`:
```python
THRESHOLD_RED_DAY = 38      # Your value
THRESHOLD_RED_NIGHT = 24    # Your value
# ... etc
```

### Add More Cities
Edit `config.py` CITIES array with new city info.

---

## 🆘 NEED HELP?

### Check These Files
1. `FINAL_SUMMARY.md` - Complete overview
2. `IMPLEMENTATION_STATUS.md` - What's implemented
3. `README.md` - Full documentation
4. `SETUP_GUIDE.md` - Detailed setup

### Common Questions

**Q: Is night temp really more important?**  
A: YES! Your guide emphasizes this. Dashboard implements it throughout.

**Q: What's Kerala special?**  
A: Purple alert for Kerala cities with hot nights (≥24°C) - coastal humidity pattern.

**Q: How are AC hours calculated?**  
A: Day temp (max 6 hrs) + Night temp (up to 12 hrs) = Total AC hours per day.

**Q: What's wave sequence?**  
A: Timeline showing which markets heat up first (Wave 1), second (Wave 2), third (Wave 3).

---

## 🎉 YOU'RE READY!

Dashboard implements **EVERYTHING** from your guide:
- ✅ Night temperature priority
- ✅ Exact color coding
- ✅ All 4 KPIs
- ✅ Wave sequence 1/2/3
- ✅ Kerala special
- ✅ AC hours calculation
- ✅ IMD data source

### Start Now:
```powershell
python app.py
```

### Then open:
```
http://localhost:5000
```

---

**Happy Forecasting!** 🌡️📈

*"Night Temperature Drives Demand" - Remember this!* 🌙

---

Need to stop the server? Press `Ctrl + C` in PowerShell.
