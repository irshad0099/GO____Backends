import { ENV } from '../../config/envConfig.js';
import logger from '../../core/logger/logger.js';
import twilio from 'twilio';

class SMSProvider {
    constructor() {
        this.provider = ENV.SMS_PROVIDER;
        this.initializeProvider();
    }

    initializeProvider() {
        switch (this.provider) {
            case 'msg91':
                logger.info('🔌 Initializing MSG91 SMS Provider', {
                    authKeyPresent: !!ENV.MSG91_AUTH_KEY,
                    templateIdPresent: !!ENV.MSG91_TEMPLATE_ID,
                    senderIdPresent: !!ENV.MSG91_SENDER_ID
                });
                this.client = null; // MSG91 uses HTTP API, no SDK needed
                break;
            case 'twilio':
                logger.info('🔌 Initializing Twilio SMS Provider', {
                    accountSidPresent: !!ENV.TWILIO_ACCOUNT_SID,
                    authTokenPresent: !!ENV.TWILIO_AUTH_TOKEN,
                    phonePresent: !!ENV.TWILIO_PHONE_NUMBER
                });
                this.client = twilio(
                    ENV.TWILIO_ACCOUNT_SID,
                    ENV.TWILIO_AUTH_TOKEN
                );
                break;
            case 'console':
            default:
                logger.info('🔌 SMS Provider initialized in CONSOLE mode (development)');
                this.client = null;
                break;
        }
    }

    async sendSMS(phone, message, purpose = 'general') {
        const startTime = Date.now();

        try {
            // Validate phone number (Indian format)
            if (!this.validatePhoneNumber(phone)) {
                const error = new Error('Invalid phone number format');
                logger.error('📱 SMS validation failed', {
                    phone,
                    purpose,
                    error: error.message,
                    duration: Date.now() - startTime
                });
                throw error;
            }

            logger.debug('📤 SMS sending initiated', {
                phone: phone.slice(-4), // Only log last 4 digits for privacy
                provider: this.provider,
                purpose,
                messageLength: message.length
            });

            switch (this.provider) {
                case 'msg91':
                    return await this.sendViaMSG91(phone, message, purpose);
                case 'twilio':
                    return await this.sendViaTwilio(phone, message, purpose);
                case 'console':
                default:
                    return this.logToConsole(phone, message, purpose);
            }
            
        } catch (error) {
            console.log(error);
            logger.error('❌ SMS sending failed', {
                phone: phone.slice(-4),
                provider: this.provider,
                purpose,
                errorCode: error.code,
                errorMessage: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    validatePhoneNumber(phone) {
        // Indian phone number validation
        const phoneRegex = /^[6-9]\d{9}$/;
        return phoneRegex.test(phone.replace(/\D/g, ''));
    }

    async sendViaMSG91(phone, message, purpose = 'general') {
        const startTime = Date.now();
        const cleanPhone = phone.replace(/\D/g, '');

        try {
            if (!ENV.MSG91_AUTH_KEY) {
                throw new Error('MSG91_AUTH_KEY not configured');
            }

            // MSG91 API endpoint - Using sendhttp.php (working endpoint)
            const msg91Url = new URL('https://api.msg91.com/api/sendhttp.php');
            msg91Url.searchParams.append('authkey', ENV.MSG91_AUTH_KEY);
            msg91Url.searchParams.append('mobiles', `91${cleanPhone}`);
            msg91Url.searchParams.append('message', message);
            msg91Url.searchParams.append('route', '1'); // Promotional route (try this)
            msg91Url.searchParams.append('sender', ENV.MSG91_SENDER_ID || 'GoMob');
            logger.debug('📡 MSG91 API Request', {
                endpoint: 'sendhttp.php',
                phone: cleanPhone.slice(-4),
                purpose,
                authKeyPresent: !!ENV.MSG91_AUTH_KEY
            });
            
            const response = await fetch(msg91Url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            console.log(response);

            const responseText = await response.text();
            console.log(responseText)
            logger.debug('📨 MSG91 API Response Received', {
                status: response.status,
                phone: cleanPhone.slice(-4),
                purpose,
                response: responseText.substring(0, 150),
                duration: Date.now() - startTime
            });

            if (!response.ok) {
                throw new Error(`MSG91 API error: ${response.status} - ${responseText}`);
            }

            // MSG91 sendhttp.php returns plain text
            // Success: "Message sent successfully" or similar
            // Error: "Invalid AuthKey" or error description
            const isSuccess = responseText &&
                !responseText.toLowerCase().includes('error') &&
                !responseText.toLowerCase().includes('invalid') &&
                response.status === 200;

            if (isSuccess) {
                logger.info('✅ SMS sent successfully via MSG91', {
                    phone: cleanPhone.slice(-4),
                    purpose,
                    response: responseText.substring(0, 100),
                    duration: Date.now() - startTime
                });

                return {
                    success: true,
                    provider: 'msg91',
                    messageId: 'msg91_' + Date.now(),
                    response: responseText
                };
            } else {
                throw new Error(`MSG91 returned error: ${responseText}`);
            }
        } catch (error) {
            logger.error('❌ MSG91 SMS failed', {
                phone: cleanPhone.slice(-4),
                purpose,
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async sendViaTwilio(phone, message, purpose = 'general') {
        const startTime = Date.now();

        try {
            const result = await this.client.messages.create({
                body: message,
                from: ENV.TWILIO_PHONE_NUMBER,
                to: `+91${phone}` // Assuming Indian numbers
            });
                console.log(result,"twilio");
            logger.info('✅ SMS sent via Twilio', {
                phone: phone.slice(-4),
                sid: result.sid,
                purpose,
                duration: Date.now() - startTime
            });
            return { success: true, sid: result.sid, provider: 'twilio' };
        } catch (error) {
            logger.error('❌ Twilio SMS failed', {
                phone: phone.slice(-4),
                purpose,
                error: error.message,
                
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    logToConsole(phone, message, purpose = 'general') {
        logger.info(`🔔 [CONSOLE MODE] SMS to ${phone.slice(-4)}:`, {
            purpose,
            message,
            timestamp: new Date().toISOString()
        });
        return { success: true, simulated: true, provider: 'console' };
    }

    async sendOTP(phone, otp, purpose = 'signin') {
        const message = `Your OTP for GoMobility is: ${otp}. Valid for ${ENV.OTP_EXPIRY_MINUTES} minutes. Do not share.`;

        return this.sendSMS(phone, message, `otp_${purpose}`);
    }
}

export const smsProvider = new SMSProvider();