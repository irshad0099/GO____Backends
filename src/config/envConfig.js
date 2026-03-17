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
    UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL,
    
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
    
    // Surge Pricing
    SURGE_BASE_MULTIPLIER: parseFloat(process.env.SURGE_BASE_MULTIPLIER) || 1.0,
    SURGE_MAX_MULTIPLIER: parseFloat(process.env.SURGE_MAX_MULTIPLIER) || 2.5,
    SURGE_DEMAND_THRESHOLD: parseInt(process.env.SURGE_DEMAND_THRESHOLD) || 10,
    
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
    
    // Vehicle Pricing
    VEHICLE_TYPES: process.env.VEHICLE_TYPES?.split(',') || ['bike', 'auto', 'car'],
    BIKE_BASE_FARE: parseInt(process.env.BIKE_BASE_FARE) || 20,
    BIKE_PER_KM: parseInt(process.env.BIKE_PER_KM) || 8,
    BIKE_PER_MINUTE: parseInt(process.env.BIKE_PER_MINUTE) || 1,
    BIKE_MINIMUM_FARE: parseInt(process.env.BIKE_MINIMUM_FARE) || 25,
    BIKE_SURGE_MULTIPLIER: parseFloat(process.env.BIKE_SURGE_MULTIPLIER) || 1.5,
    
    AUTO_BASE_FARE: parseInt(process.env.AUTO_BASE_FARE) || 30,
    AUTO_PER_KM: parseInt(process.env.AUTO_PER_KM) || 12,
    AUTO_PER_MINUTE: parseInt(process.env.AUTO_PER_MINUTE) || 1.5,
    AUTO_MINIMUM_FARE: parseInt(process.env.AUTO_MINIMUM_FARE) || 35,
    AUTO_SURGE_MULTIPLIER: parseFloat(process.env.AUTO_SURGE_MULTIPLIER) || 1.5,
    
    CAR_BASE_FARE: parseInt(process.env.CAR_BASE_FARE) || 50,
    CAR_PER_KM: parseInt(process.env.CAR_PER_KM) || 15,
    CAR_PER_MINUTE: parseInt(process.env.CAR_PER_MINUTE) || 2,
    CAR_MINIMUM_FARE: parseInt(process.env.CAR_MINIMUM_FARE) || 60,
    CAR_SURGE_MULTIPLIER: parseFloat(process.env.CAR_SURGE_MULTIPLIER) || 2.0,
    
    // Cancellation
    FREE_CANCELLATION_MINUTES: parseInt(process.env.FREE_CANCELLATION_MINUTES) || 5,
    PASSENGER_CANCELLATION_FEE: parseInt(process.env.PASSENGER_CANCELLATION_FEE) || 10,
    DRIVER_CANCELLATION_PENALTY: parseInt(process.env.DRIVER_CANCELLATION_PENALTY) || 20,
    
    // Pagination
    PAGINATION_DEFAULT_LIMIT: parseInt(process.env.PAGINATION_DEFAULT_LIMIT) || 20,
    PAGINATION_MAX_LIMIT: parseInt(process.env.PAGINATION_MAX_LIMIT) || 100
};

