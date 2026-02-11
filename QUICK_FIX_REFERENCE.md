# Quick Fix Reference Card

## 🚨 What Was Fixed?

| Issue | Status | Impact |
|-------|--------|--------|
| API keys exposed in git | ✅ FIXED | CRITICAL |
| Fake data shown when APIs fail | ✅ FIXED | CRITICAL |
| No mobile responsiveness | ✅ FIXED | HIGH |
| No alert notifications | ✅ FIXED | HIGH |
| Export buttons broken | ✅ FIXED | MEDIUM |

---

## ⚡ Quick Start

### 1. Setup Environment (2 minutes)
```bash
# Copy example config
cp .env.example .env

# Edit .env and add your API key
# OPENWEATHER_API_KEY=your-key-here

# Install dependencies
pip install -r requirements.txt

# Start server
python app.py
```

### 2. Test Notifications (1 minute)
```bash
python test_notifications.py
```

### 3. Test Mobile (5 minutes)
- Open on phone: `http://your-ip:5000`
- Check hamburger menu works
- Verify cards are readable
- Test export buttons

---

## 🔧 Common Tasks

### Enable Email Alerts
```bash
# In .env file:
EMAIL_ENABLED=true
EMAIL_SMTP_SERVER=smtp.gmail.com
EMAIL_SENDER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_RECIPIENTS=team@company.com
```

### Enable SMS Alerts
```bash
# In .env file:
SMS_ENABLED=true
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_FROM_NUMBER=+1234567890
SMS_RECIPIENTS=+919876543210
```

### Test Single Notification
```python
from utils.notification_service import NotificationService

# Test email
NotificationService.send_email("Test", "Body", "<h1>HTML</h1>")

# Test SMS
NotificationService.send_sms("Test message")

# Test WhatsApp
NotificationService.send_whatsapp("Test message")
```

---

## 🐛 Troubleshooting

### "No data available"
**Cause**: API failed, no fallback data (by design)
**Fix**: Check API key in `.env`, verify internet connection

### "Export failed"
**Cause**: Missing openpyxl library
**Fix**: `pip install openpyxl`

### "Notification failed"
**Cause**: Wrong credentials or disabled
**Fix**: Check `.env` settings, run `python test_notifications.py`

### "Mobile menu not working"
**Cause**: JavaScript error
**Fix**: Check browser console, clear cache

---

## 📱 Mobile Testing Checklist

Quick 5-minute test:
- [ ] Open on phone
- [ ] Tap hamburger menu (☰)
- [ ] View city cards (readable?)
- [ ] Check alerts (touch-friendly?)
- [ ] Test export (downloads?)
- [ ] Scroll smoothly?

---

## 🔒 Security Checklist

Before committing:
- [ ] `.env` is in `.gitignore`
- [ ] No API keys in code
- [ ] No passwords in code
- [ ] Run: `git status` (should NOT show .env)

---

## 📊 Export Functions

| Button | Endpoint | Status |
|--------|----------|--------|
| Excel Export | `/api/export/excel` | ✅ Working |
| PDF Export | Client-side jsPDF | ✅ Working |
| Alert Report | `/api/export/alert-report` | ✅ NEW |
| Forecast Report | `/api/export/forecast-report` | ✅ NEW |

---

## 🚀 Deployment Commands

```bash
# Check status
git status

# Add changes
git add .

# Commit
git commit -m "Fix: Security, mobile, notifications, exports"

# Push
git push origin main

# Deploy (if using Render/Heroku)
git push heroku main
```

---

## 📞 Quick Help

### Get API Key
- OpenWeather: https://openweathermap.org/api (FREE)
- Twilio: https://www.twilio.com (SMS/WhatsApp)

### Documentation
- Full details: `FIXES_SUMMARY.md`
- Security: `SECURITY_FIXES.md`
- Mobile: `MOBILE_TESTING_GUIDE.md`

### Test Commands
```bash
# Test notifications
python test_notifications.py

# Test server
python app.py

# Test upload
python test_upload.py
```

---

## ⚠️ Critical Reminders

1. **NEVER commit .env file** - Contains secrets
2. **No fake data** - App fails fast now (safer)
3. **Test on mobile** - Field sales need it
4. **Monitor costs** - SMS/WhatsApp cost money
5. **Check logs** - Watch for API failures

---

## 🎯 Success Indicators

✅ All working if:
- No `.env` in `git status`
- Notifications arrive
- Mobile menu works
- Exports download
- No simulated data shown

---

**Print this card and keep it handy!**
