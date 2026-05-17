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
    // UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL || 'rediss://default:gQAAAAAAAU2PAAIncDI0MzI0MDJkNDQxMGM0YzJlOTMzMDRjMTNmODAxZGIzY3AyODUzOTE@picked-marten-85391.upstash.io:6379',

    // NAYA - YEH RAKHO
REDIS_USERNAME: process.env.REDIS_USERNAME || 'default',

    // Firebase
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'gomobility_super_secret_key',
    JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
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
    RAZORPAY_ACCOUNT_NUMBER: process.env.RAZORPAY_ACCOUNT_NUMBER, // RazorpayX account for payouts

    // Company
    COMPANY_USER_ID: process.env.COMPANY_USER_ID, // seeded admin user whose wallet = company earnings
    
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

    // Google Maps
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,

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
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,  // NO DEFAULT - must be set in env
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
    // EMAIL_FROM: process.env.EMAIL_FROM || 'GoMobility <noreply@gomobility.com>',
    
    EMAIL_FROM:      process.env.EMAIL_FROM      || 'mailatgomobility@gmail.com',
EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'GO Mobility',
EMAIL_REPLY_TO:  process.env.EMAIL_REPLY_TO  || 'support@gomobility.co.in',


    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
    LOG_FILE: process.env.LOG_FILE || 'logs/app.log',
    
    // MySQL (Optional)
    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_PORT: parseInt(process.env.MYSQL_PORT) || 3306,
    MYSQL_DB: process.env.MYSQL_DB,
    MYSQL_USER: process.env.MYSQL_USER,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    
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

    // KYC v2 scoring thresholds (tune without redeploy)
    KYC_AUTO_THRESHOLD:             parseFloat(process.env.KYC_AUTO_THRESHOLD)             || 85,
    KYC_REVIEW_THRESHOLD:           parseFloat(process.env.KYC_REVIEW_THRESHOLD)           || 60,
    // RC pe VAHAN se aane wale insurance/fitness data ke liye
    KYC_INSURANCE_EXPIRY_MIN_DAYS:  parseInt(process.env.KYC_INSURANCE_EXPIRY_MIN_DAYS)    || 30,

    // S3 bucket for KYC document storage
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME || 'go-mobility-kyc',
};

// Validate required secrets in production
if (ENV.NODE_ENV === 'production') {
    const requiredSecrets = ['DB_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY'];
    const missing = requiredSecrets.filter(key => !ENV[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

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
