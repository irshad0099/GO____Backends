import { ENV } from '../../config/envConfig.js';
import logger from '../../core/logger/logger.js';

class SMSProvider {
    constructor() {
        this.provider = ENV.SMS_PROVIDER;
        this.initializeProvider();
    }

    initializeProvider() {
        switch (this.provider) {
            case 'twilio':
                // Initialize Twilio
                this.client = require('twilio')(
                    ENV.TWILIO_ACCOUNT_SID,
                    ENV.TWILIO_AUTH_TOKEN
                );
                break;
            case 'console':
            default:
                // Console logger for development
                this.client = null;
                break;
        }
    }

    async sendSMS(phone, message) {
        try {
            // Validate phone number (Indian format)
            if (!this.validatePhoneNumber(phone)) {
                throw new Error('Invalid phone number format');
            }

            switch (this.provider) {
                case 'twilio':
                    return await this.sendViaTwilio(phone, message);
                case 'console':
                default:
                    return this.logToConsole(phone, message);
            }
        } catch (error) {
            logger.error('SMS sending failed:', error);
            throw error;
        }
    }

    validatePhoneNumber(phone) {
        // Indian phone number validation
        const phoneRegex = /^[6-9]\d{9}$/;
        return phoneRegex.test(phone.replace(/\D/g, ''));
    }

    async sendViaTwilio(phone, message) {
        try {
            const result = await this.client.messages.create({
                body: message,
                from: ENV.TWILIO_PHONE_NUMBER,
                to: `+91${phone}` // Assuming Indian numbers
            });
            
            logger.info('SMS sent via Twilio:', { phone, sid: result.sid });
            return { success: true, sid: result.sid };
        } catch (error) {
            logger.error('Twilio SMS failed:', error);
            throw error;
        }
    }

    logToConsole(phone, message) {
        logger.info(`[SMS to ${phone}]: ${message}`);
        return { success: true, simulated: true };
    }

    async sendOTP(phone, otp) {
        const message = `Your OTP for Ride Sharing app is: ${otp}. Valid for ${ENV.OTP_EXPIRY_MINUTES} minutes. Do not share this OTP with anyone.`;
        return this.sendSMS(phone, message);
    }
}

export const smsProvider = new SMSProvider();