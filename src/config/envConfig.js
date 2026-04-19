import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
    // Server
    NODE_ENV: process.env.NODE_ENV || 'development',
    APP_NAME: process.env.APP_NAME || 'GoMobility',
    PORT: parseInt(process.env.PORT) || 5000,
    BASE_URL: process.env.BASE_URL || 'http://localhost:5000',
    API_PREFIX: process.env.API_PREFIX || '/api/v1',
    
    
    // Database
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT) || 5432,
    DB_NAME: process.env.DB_NAME || 'go_app',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || 'Irshad@123',
    DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX) || 20,
    DB_POOL_IDLE: parseInt(process.env.DB_POOL_IDLE) || 10000,
    DB_POOL_CONNECTION: parseInt(process.env.DB_POOL_CONNECTION) || 10000,
    
    // Redis
    REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
    REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
    REDIS_DB: parseInt(process.env.REDIS_DB) || 0,
    UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL || 'rediss://default:gQAAAAAAAU2PAAIncDI0MzI0MDJkNDQxMGM0YzJlOTMzMDRjMTNmODAxZGIzY3AyODUzOTE@picked-marten-85391.upstash.io:6379',

    // Firebase
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'gomobility_super_secret_key',
    JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '30d',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'gomobility_refresh_secret',
    JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '30d',
    
    // OTP
    OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES) || 5,
    OTP_LENGTH: parseInt(process.env.OTP_LENGTH) || 4,
    OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS) || 3,
    
    // SMS Provider
    SMS_PROVIDER: process.env.SMS_PROVIDER || 'console',
    MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
    MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID,
    MSG91_SENDER_ID: process.env.MSG91_SENDER_ID,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    FAST2SMS_API_KEY: process.env.FAST2SMS_API_KEY,
    AUTHKEY_API_KEY: process.env.AUTHKEY_API_KEY,
    AUTHKEY_SID: process.env.AUTHKEY_SID,
    
    // Payment Gateway
    PAYMENT_GATEWAY: process.env.PAYMENT_GATEWAY || 'razorpay',
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    
    // Subscription
    DEFAULT_SUBSCRIPTION_CURRENCY: process.env.DEFAULT_SUBSCRIPTION_CURRENCY || 'INR',
    FREE_TRIAL_DAYS: parseInt(process.env.FREE_TRIAL_DAYS) || 0,
    
    // Socket.IO
    SOCKET_PING_TIMEOUT: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
    SOCKET_PING_INTERVAL: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000,
    
    // Geo/Location
    DRIVER_SEARCH_RADIUS_METERS: parseInt(process.env.DRIVER_SEARCH_RADIUS_METERS) || 5000,
    DEFAULT_SEARCH_RADIUS_KM: parseInt(process.env.DEFAULT_SEARCH_RADIUS_KM) || 5,
    MAX_DRIVER_PING: parseInt(process.env.MAX_DRIVER_PING) || 5,
    LOCATION_UPDATE_INTERVAL: parseInt(process.env.LOCATION_UPDATE_INTERVAL) || 5,
    
    // Surge Pricing (Spec Section 2)
    SURGE_MAX_MULTIPLIER: parseFloat(process.env.SURGE_MAX_MULTIPLIER) || 1.75,
    PEAK_RATIO_THRESHOLD: parseFloat(process.env.PEAK_RATIO_THRESHOLD) || 1.2,
    PEAK_VELOCITY_THRESHOLD: parseFloat(process.env.PEAK_VELOCITY_THRESHOLD) || 18,
    DEMAND_WINDOW_MINUTES: parseInt(process.env.DEMAND_WINDOW_MINUTES) || 10,
    VELOCITY_WINDOW_MINUTES: parseInt(process.env.VELOCITY_WINDOW_MINUTES) || 5,

    // Demand-based peak — minimum volume guard
    // Demand ratio is ignored unless at least this many requests exist in the window
    MIN_DEMAND_REQUESTS: parseInt(process.env.MIN_DEMAND_REQUESTS) || 5,

    // Time-based peak hours (24h format, comma-separated ranges "HH-HH")
    // Default: morning 8-10, evening 18-21
    PEAK_HOURS_MORNING_START: parseInt(process.env.PEAK_HOURS_MORNING_START) || 8,
    PEAK_HOURS_MORNING_END: parseInt(process.env.PEAK_HOURS_MORNING_END) || 10,
    PEAK_HOURS_EVENING_START: parseInt(process.env.PEAK_HOURS_EVENING_START) || 18,
    PEAK_HOURS_EVENING_END: parseInt(process.env.PEAK_HOURS_EVENING_END) || 21,

    // Weather-based Peak Detection (OpenWeatherMap)
    // Plug & Play: sirf OPENWEATHER_API_KEY set karo .env mein, baaki sab auto
    // Agar key nahi hai → weather detection silently skip hoga
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY || '',
    WEATHER_CACHE_MINUTES: parseInt(process.env.WEATHER_CACHE_MINUTES) || 15,
    WEATHER_PEAK_CONDITIONS: process.env.WEATHER_PEAK_CONDITIONS?.split(',') || ['Rain', 'Drizzle', 'Thunderstorm', 'Snow', 'Squall', 'Tornado'],
    WEATHER_SEVERE_CONDITIONS: process.env.WEATHER_SEVERE_CONDITIONS?.split(',') || ['Thunderstorm', 'Snow', 'Squall', 'Tornado'],
    WEATHER_SURGE_MILD: parseFloat(process.env.WEATHER_SURGE_MILD) || 1.1,
    WEATHER_SURGE_SEVERE: parseFloat(process.env.WEATHER_SURGE_SEVERE) || 1.25,
    
    // Rate Limiting
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000,
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
    OTP_RATE_LIMIT_MAX: parseInt(process.env.OTP_RATE_LIMIT_MAX) || 3,
    

    
    // File Upload
    UPLOAD_PROVIDER: process.env.UPLOAD_PROVIDER || 'local',
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
    MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB) || 5,
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 5242880,
    
    // Security
    BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'gomobility_ultra_secure_key_2026',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    
    // OCR
    OCR_PROVIDER: process.env.OCR_PROVIDER || 'aws_textract',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
    
    // Email
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'smtp',
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM || 'GoMobility <noreply@gomobility.com>',
    
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
    LOG_FILE: process.env.LOG_FILE || 'logs/app.log',
    
    // MySQL (Optional)
    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_PORT: parseInt(process.env.MYSQL_PORT) || 3306,
    MYSQL_DB: process.env.MYSQL_DB,
    MYSQL_USER: process.env.MYSQL_USER,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    
    // Vehicle Pricing (Spec Section 8)
    VEHICLE_TYPES: process.env.VEHICLE_TYPES?.split(',') || ['bike', 'auto', 'car'],
    BIKE_BASE_FARE: parseFloat(process.env.BIKE_BASE_FARE) || 20,
    BIKE_PER_KM: parseFloat(process.env.BIKE_PER_KM) || 8,
    BIKE_MINIMUM_FARE: parseFloat(process.env.BIKE_MINIMUM_FARE) || 35,
    AUTO_BASE_FARE: parseFloat(process.env.AUTO_BASE_FARE) || 30,
    AUTO_PER_KM: parseFloat(process.env.AUTO_PER_KM) || 12,
    AUTO_MINIMUM_FARE: parseFloat(process.env.AUTO_MINIMUM_FARE) || 50,
    CAR_BASE_FARE: parseFloat(process.env.CAR_BASE_FARE) || 50,
    CAR_PER_KM: parseFloat(process.env.CAR_PER_KM) || 15,
    CAR_MINIMUM_FARE: parseFloat(process.env.CAR_MINIMUM_FARE) || 90,

    // Average Speed per Vehicle (km/h) — for duration estimation
    SPEED_BIKE: parseFloat(process.env.SPEED_BIKE) || 30,
    SPEED_AUTO: parseFloat(process.env.SPEED_AUTO) || 25,
    SPEED_CAR: parseFloat(process.env.SPEED_CAR) || 35,

    // Platform Fee per Ride (Spec Section 1)
    PLATFORM_FEE_BIKE: parseFloat(process.env.PLATFORM_FEE_BIKE) || 1,
    PLATFORM_FEE_AUTO: parseFloat(process.env.PLATFORM_FEE_AUTO) || 1.5,
    PLATFORM_FEE_CAR: parseFloat(process.env.PLATFORM_FEE_CAR) || 5,
    PLATFORM_FEE_DAILY_CAP: parseInt(process.env.PLATFORM_FEE_DAILY_CAP) || 10,

    // Waiting Charges (Spec Section 5)
    WAITING_GRACE_MINUTES: parseInt(process.env.WAITING_GRACE_MINUTES) || 3,
    WAITING_RATE_BIKE: parseFloat(process.env.WAITING_RATE_BIKE) || 1,
    WAITING_RATE_AUTO: parseFloat(process.env.WAITING_RATE_AUTO) || 1.5,
    WAITING_RATE_CAR: parseFloat(process.env.WAITING_RATE_CAR) || 2,

    // Traffic Delay Compensation (Spec Section 6)
    TRAFFIC_GRACE_BUFFER_MINUTES: parseInt(process.env.TRAFFIC_GRACE_BUFFER_MINUTES) || 30,
    TRAFFIC_RATE_BIKE: parseFloat(process.env.TRAFFIC_RATE_BIKE) || 0.5,
    TRAFFIC_RATE_AUTO: parseFloat(process.env.TRAFFIC_RATE_AUTO) || 1,
    TRAFFIC_RATE_CAR: parseFloat(process.env.TRAFFIC_RATE_CAR) || 1.5,

    // Pickup Distance Compensation (Spec Section 7)
    PICKUP_BASE_RADIUS_KM: parseFloat(process.env.PICKUP_BASE_RADIUS_KM) || 2.5,
    PICKUP_COMP_BIKE: parseFloat(process.env.PICKUP_COMP_BIKE) || 3,
    PICKUP_COMP_AUTO: parseFloat(process.env.PICKUP_COMP_AUTO) || 5,
    PICKUP_COMP_CAR: parseFloat(process.env.PICKUP_COMP_CAR) || 7,

    // Convenience Fee (Spec Section 3)
    CONV_FEE_BIKE_NONPEAK_MIN: parseFloat(process.env.CONV_FEE_BIKE_NONPEAK_MIN) || 5,
    CONV_FEE_BIKE_NONPEAK_MAX: parseFloat(process.env.CONV_FEE_BIKE_NONPEAK_MAX) || 5,
    CONV_FEE_BIKE_PEAK_MIN: parseFloat(process.env.CONV_FEE_BIKE_PEAK_MIN) || 10,
    CONV_FEE_BIKE_PEAK_MAX: parseFloat(process.env.CONV_FEE_BIKE_PEAK_MAX) || 12,
    CONV_FEE_AUTO_NONPEAK_MIN: parseFloat(process.env.CONV_FEE_AUTO_NONPEAK_MIN) || 12,
    CONV_FEE_AUTO_NONPEAK_MAX: parseFloat(process.env.CONV_FEE_AUTO_NONPEAK_MAX) || 15,
    CONV_FEE_AUTO_PEAK_MIN: parseFloat(process.env.CONV_FEE_AUTO_PEAK_MIN) || 20,
    CONV_FEE_AUTO_PEAK_MAX: parseFloat(process.env.CONV_FEE_AUTO_PEAK_MAX) || 25,
    CONV_FEE_CAR_NONPEAK_MIN: parseFloat(process.env.CONV_FEE_CAR_NONPEAK_MIN) || 20,
    CONV_FEE_CAR_NONPEAK_MAX: parseFloat(process.env.CONV_FEE_CAR_NONPEAK_MAX) || 25,
    CONV_FEE_CAR_PEAK_MIN: parseFloat(process.env.CONV_FEE_CAR_PEAK_MIN) || 30,
    CONV_FEE_CAR_PEAK_MAX: parseFloat(process.env.CONV_FEE_CAR_PEAK_MAX) || 50,

    // Cancellation (Spec Section 4)
    CANCELLATION_PENALTY: parseFloat(process.env.CANCELLATION_PENALTY) || 50,
    CANCELLATION_DISTANCE_THRESHOLD: parseInt(process.env.CANCELLATION_DISTANCE_THRESHOLD) || 500,
    CANCELLATION_DRIVER_SHARE_PERCENT: parseInt(process.env.CANCELLATION_DRIVER_SHARE_PERCENT) || 80,
    CANCELLATION_PLATFORM_SHARE_PERCENT: parseInt(process.env.CANCELLATION_PLATFORM_SHARE_PERCENT) || 20,
    
    // Pagination
    PAGINATION_DEFAULT_LIMIT: parseInt(process.env.PAGINATION_DEFAULT_LIMIT) || 20,
    PAGINATION_MAX_LIMIT: parseInt(process.env.PAGINATION_MAX_LIMIT) || 100,

    // Cashfree Verification Suite (KYC)
    CASHFREE_ENV:                process.env.CASHFREE_ENV                || 'sandbox',
    CASHFREE_CLIENT_ID:          process.env.CASHFREE_CLIENT_ID,
    CASHFREE_CLIENT_SECRET:      process.env.CASHFREE_CLIENT_SECRET,
    // RSA public key for x-cf-signature
    // .env mein ek variable mein full PEM daal sakte ho, ya CASHFREE_PUBLIC_KEY2 mein sirf body
    CASHFREE_PUBLIC_KEY: (() => {
        const raw = process.env.CASHFREE_PUBLIC_KEY || '';
        const body = process.env.CASHFREE_PUBLIC_KEY2 || '';
        // Agar sirf header hai pehle var mein, aur body alag var mein
        if (body) {
            return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
        }
        // Agar full key ek hi var mein hai (\\n escaped)
        return raw.replace(/\\n/g, '\n');
    })(),
    CASHFREE_FACE_MATCH_THRESHOLD:    parseFloat(process.env.CASHFREE_FACE_MATCH_THRESHOLD) || 75,
    CASHFREE_NAME_MATCH_THRESHOLD:    parseFloat(process.env.CASHFREE_NAME_MATCH_THRESHOLD) || 70,
    DIGILOCKER_REDIRECT_URL:          process.env.DIGILOCKER_REDIRECT_URL || 'http://localhost:5000/api/v1/kyc/digilocker/callback',
};

// import dotenv from 'dotenv';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // IMPORTANT: .env file ka sahi path do
// dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// // Debug: Check karo .env load hua ya nahi
// console.log('🔍 Loading .env from:', path.resolve(__dirname, '../../.env'));
// console.log('📊 RAW ENV Values:');
// console.log('  NODE_ENV (raw):', process.env.NODE_ENV);
// console.log('  PORT (raw):', process.env.PORT);
// console.log('  API_PREFIX (raw):', process.env.API_PREFIX);
// console.log('  DB_NAME (raw):', process.env.DB_NAME);

// export const ENV = {
//     // Server
//     NODE_ENV: process.env.NODE_ENV || 'development',
//     APP_NAME: process.env.APP_NAME || 'GoMobility',
//     PORT: parseInt(process.env.PORT) || 5000,
//     BASE_URL: process.env.BASE_URL || 'http://localhost:5000',
//     API_PREFIX: process.env.API_PREFIX || '',  // ✅ Empty string as default
    
//     // Database
//     DB_HOST: process.env.DB_HOST || 'localhost',
//     DB_PORT: parseInt(process.env.DB_PORT) || 5432,
//     DB_NAME: process.env.DB_NAME || 'go_app',
//     DB_USER: process.env.DB_USER || 'postgres',
//     DB_PASSWORD: process.env.DB_PASSWORD || 'Irshad@123',
    
//     // JWT
//     JWT_SECRET: process.env.JWT_SECRET || 'gomobility_super_secret_key',
//     JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
//     JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'gomobility_refresh_secret',
//     JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '30d',
    
//     // OTP
//     OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES) || 5,
//     OTP_LENGTH: parseInt(process.env.OTP_LENGTH) || 4,
//     OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS) || 3,
    
//     // CORS
//     CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
// };
