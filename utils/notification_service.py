import smtplib
import json
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import requests
from config import Config

logger = logging.getLogger(__name__)

class NotificationService:
    """
    Handles sending notifications via Email, SMS, and WhatsApp.
    Configurations are loaded from Config.
    """

    @staticmethod
    def send_email(subject, body, html_body=None):
        """Send email notification"""
        if not Config.EMAIL_ENABLED:
            return False, "Email disabled"
        
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = Config.EMAIL_SENDER
            msg['To'] = ", ".join(Config.EMAIL_RECIPIENTS)
            
            part1 = MIMEText(body, 'plain')
            msg.attach(part1)
            
            if html_body:
                part2 = MIMEText(html_body, 'html')
                msg.attach(part2)
            
            with smtplib.SMTP(Config.EMAIL_SMTP_SERVER, Config.EMAIL_SMTP_PORT) as server:
                server.starttls()
                server.login(Config.EMAIL_SENDER, Config.EMAIL_PASSWORD)
                server.sendmail(Config.EMAIL_SENDER, Config.EMAIL_RECIPIENTS, msg.as_string())
            
            logger.info(f"Email sent to {len(Config.EMAIL_RECIPIENTS)} recipients")
            return True, "Email sent successfully"
        except Exception as e:
            logger.error(f"Email send failed: {str(e)}")
            return False, str(e)

    @staticmethod
    def send_sms(message):
        """Send SMS via Twilio"""
        if not Config.SMS_ENABLED:
            return False, "SMS disabled"
            
        if not Config.SMS_RECIPIENTS:
             return False, "No SMS recipients configured"

        try:
            # Twilio API (using requests to avoid adding twilio lib dependency if not strictly needed, 
            # but usually better to use twilio lib. adhering to 'no external heavy deps' unless needed. 
            # straightforward REST call is fine)
            
            # Using Twilio client if available, else requests
            from twilio.rest import Client
            client = Client(Config.TWILIO_ACCOUNT_SID, Config.TWILIO_AUTH_TOKEN)
            
            success_count = 0
            for number in Config.SMS_RECIPIENTS:
                try:
                    client.messages.create(
                        body=message,
                        from_=Config.TWILIO_FROM_NUMBER,
                        to=number
                    )
                    success_count += 1
                except Exception as inner_e:
                    logger.error(f"Failed to send SMS to {number}: {str(inner_e)}")
            
            if success_count > 0:
                logger.info(f"SMS sent to {success_count} recipients")
                return True, f"SMS sent to {success_count} recipients"
            else:
                return False, "Failed to send SMS to any recipient"
                
        except ImportError:
             return False, "Twilio library not installed"
        except Exception as e:
            logger.error(f"Twilio SMS failed: {str(e)}")
            return False, str(e)

    @staticmethod
    def send_whatsapp(message):
        """Send WhatsApp via Twilio"""
        if not Config.WHATSAPP_ENABLED:
            return False, "WhatsApp disabled"
            
        try:
            from twilio.rest import Client
            client = Client(Config.TWILIO_ACCOUNT_SID, Config.TWILIO_AUTH_TOKEN)
            
            success_count = 0
            for number in Config.WHATSAPP_RECIPIENTS:
                # Ensure number has 'whatsapp:' prefix
                to_num = number if number.startswith('whatsapp:') else f"whatsapp:{number}"
                
                try:
                    client.messages.create(
                        body=message,
                        from_=Config.WHATSAPP_FROM_NUMBER,
                        to=to_num
                    )
                    success_count += 1
                except Exception as inner_e:
                    logger.error(f"Failed to send WhatsApp to {number}: {str(inner_e)}")
                    
            if success_count > 0:
                return True, f"WhatsApp sent to {success_count} recipients"
            else:
                return False, "Failed to send WhatsApp to any recipient"
                
        except Exception as e:
            logger.error(f"WhatsApp send failed: {str(e)}")
            return False, str(e)

    @staticmethod
    def notify_alert(alert):
        """
        Dispatch alert to all enabled channels.
        Alert object should be a dict with: city, alert_level, recommendation, timestamp, etc.
        """
        subject = f"🚨 {alert.get('alert_level', 'High').upper()} Alert: {alert.get('city')} - Demand Spike!"
        
        # Plain text
        body = f"""
        FORECAST WELL ALERT
        ===================
        City: {alert.get('city')}
        Level: {alert.get('alert_level', '').upper()}
        Zone: {alert.get('dsb_zone', 'N/A')}
        
        Trigger: {alert.get('reason', 'High demand detected')}
        Recommendation: {alert.get('recommendation')}
        
        Time: {alert.get('timestamp')}
        
        Login to dashboard for details.
        """
        
        # HTML Body
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
                <h2 style="margin:0;">🚨 {alert.get('alert_level', '').upper()} ALERT</h2>
            </div>
            <div style="padding: 20px; background-color: #ffffff;">
                <h3 style="margin-top: 0; color: #1f2937;">{alert.get('city')} Demand Spike</h3>
                <p style="color: #4b5563;"><strong>Zone:</strong> {alert.get('dsb_zone', 'N/A')}</p>
                <p style="color: #4b5563;"><strong>Recommendation:</strong> {alert.get('recommendation')}</p>
                <div style="margin: 20px 0; padding: 15px; background-color: #fee2e2; border-left: 4px solid #dc2626; color: #991b1b;">
                    {alert.get('reason', 'Action required immediately.')}
                </div>
                <p style="text-align: center;">
                    <a href="http://localhost:5000" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Dashboard</a>
                </p>
            </div>
            <div style="background-color: #f3f4f6; padding: 10px; text-align: center; color: #9ca3af; font-size: 12px;">
                Generated by ForecastWell Pro • {datetime.now().strftime('%Y-%m-%d %H:%M')}
            </div>
        </div>
        """
        
        results = {}
        
        # Email
        if Config.EMAIL_ENABLED:
            success, msg = NotificationService.send_email(subject, body, html_body)
            results['email'] = {'success': success, 'message': msg}
            
        # SMS (Short message)
        if Config.SMS_ENABLED:
            sms_msg = f"ALERT: {alert.get('city')} is {alert.get('alert_level')}. Action: {alert.get('recommendation')}"
            success, msg = NotificationService.send_sms(sms_msg)
            results['sms'] = {'success': success, 'message': msg}
            
        # WhatsApp
        if Config.WHATSAPP_ENABLED:
            wa_msg = f"🚨 *{alert.get('alert_level').upper()} ALERT for {alert.get('city')}*\n\nRecommendation: _{alert.get('recommendation')}_\nTrigger: {alert.get('reason')}"
            success, msg = NotificationService.send_whatsapp(wa_msg)
            results['whatsapp'] = {'success': success, 'message': msg}
            
        return results
