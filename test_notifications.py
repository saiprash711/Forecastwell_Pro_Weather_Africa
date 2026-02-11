#!/usr/bin/env python3
"""
Test Notification System
Tests Email, SMS, and WhatsApp notifications
"""
import sys
from config import Config
from utils.notification_service import NotificationService

def test_email():
    """Test email notification"""
    print("\n📧 Testing Email Notification...")
    print(f"Enabled: {Config.EMAIL_ENABLED}")
    
    if not Config.EMAIL_ENABLED:
        print("❌ Email is disabled in config")
        return False
    
    print(f"Recipients: {Config.EMAIL_RECIPIENTS}")
    
    subject = "🧪 ForecastWell Test Alert"
    body = """
    This is a test email from ForecastWell Pro.
    
    If you received this, email notifications are working correctly!
    
    Test Details:
    - System: ForecastWell Pro
    - Type: Email Notification Test
    - Status: SUCCESS
    """
    
    html_body = """
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">🧪 Test Alert</h2>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
            <p>This is a test email from <strong>ForecastWell Pro</strong>.</p>
            <p>If you received this, email notifications are working correctly! ✅</p>
            <div style="background: #e0e7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>Test Details:</strong>
                <ul style="margin: 10px 0;">
                    <li>System: ForecastWell Pro</li>
                    <li>Type: Email Notification Test</li>
                    <li>Status: SUCCESS</li>
                </ul>
            </div>
        </div>
        <div style="background: #1f2937; padding: 10px; text-align: center; color: #9ca3af; font-size: 12px;">
            © 2026 Hansei Consultancy | ForecastWell Pro
        </div>
    </div>
    """
    
    success, message = NotificationService.send_email(subject, body, html_body)
    
    if success:
        print(f"✅ Email sent successfully: {message}")
        return True
    else:
        print(f"❌ Email failed: {message}")
        return False


def test_sms():
    """Test SMS notification"""
    print("\n📱 Testing SMS Notification...")
    print(f"Enabled: {Config.SMS_ENABLED}")
    
    if not Config.SMS_ENABLED:
        print("❌ SMS is disabled in config")
        return False
    
    print(f"Recipients: {Config.SMS_RECIPIENTS}")
    
    message = "🧪 ForecastWell Test: SMS notifications are working! This is a test message."
    
    success, result = NotificationService.send_sms(message)
    
    if success:
        print(f"✅ SMS sent successfully: {result}")
        return True
    else:
        print(f"❌ SMS failed: {result}")
        return False


def test_whatsapp():
    """Test WhatsApp notification"""
    print("\n💬 Testing WhatsApp Notification...")
    print(f"Enabled: {Config.WHATSAPP_ENABLED}")
    
    if not Config.WHATSAPP_ENABLED:
        print("❌ WhatsApp is disabled in config")
        return False
    
    print(f"Recipients: {Config.WHATSAPP_RECIPIENTS}")
    
    message = """
🧪 *ForecastWell Test Alert*

This is a test WhatsApp message from ForecastWell Pro.

If you received this, WhatsApp notifications are working correctly! ✅

_Test Details:_
• System: ForecastWell Pro
• Type: WhatsApp Notification Test
• Status: SUCCESS
    """
    
    success, result = NotificationService.send_whatsapp(message)
    
    if success:
        print(f"✅ WhatsApp sent successfully: {result}")
        return True
    else:
        print(f"❌ WhatsApp failed: {result}")
        return False


def test_alert_notification():
    """Test full alert notification (all channels)"""
    print("\n🚨 Testing Full Alert Notification...")
    
    # Create a mock alert
    alert = {
        'city': 'Chennai',
        'city_id': 'chennai',
        'alert_level': 'red',
        'night_temp': 26,
        'day_temp': 38,
        'dsb_zone': 'A',
        'demand_index': 85,
        'recommendation': {
            'action': 'EXTREME DEMAND - HOT NIGHTS',
            'priority': 'CRITICAL',
            'steps': [
                '🔴 EXTREME: Chennai - 16 hours AC usage expected',
                'Hot nights = ALL NIGHT AC usage = MAXIMUM demand',
                'Immediately increase inventory by 50-60%'
            ]
        },
        'reason': 'Night temp 26°C (EXTREME - Full Push)',
        'timestamp': '2026-02-11T10:30:00'
    }
    
    results = NotificationService.notify_alert(alert)
    
    print("\nResults:")
    for channel, result in results.items():
        status = "✅" if result['success'] else "❌"
        print(f"{status} {channel.upper()}: {result['message']}")
    
    return any(r['success'] for r in results.values())


def main():
    """Run all notification tests"""
    print("=" * 60)
    print("ForecastWell Pro - Notification System Test")
    print("=" * 60)
    
    results = {
        'email': test_email(),
        'sms': test_sms(),
        'whatsapp': test_whatsapp(),
        'alert': test_alert_notification()
    }
    
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for test, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test.upper()}: {status}")
    
    total = len(results)
    passed = sum(results.values())
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All notification tests passed!")
        return 0
    else:
        print(f"\n⚠️ {total - passed} test(s) failed")
        print("\nTroubleshooting:")
        print("1. Check .env configuration")
        print("2. Verify API credentials")
        print("3. Check network connectivity")
        print("4. Review error messages above")
        return 1


if __name__ == '__main__':
    sys.exit(main())
