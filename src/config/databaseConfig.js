import { ENV } from './envConfig.js';

export const dbConfig = {
    user: ENV.DB_USER,
    host: ENV.DB_HOST,
    database: ENV.DB_NAME,
    password: ENV.DB_PASSWORD,
    port: ENV.DB_PORT,
    max: ENV.DB_POOL_MAX,
    idleTimeoutMillis: ENV.DB_POOL_IDLE,
    connectionTimeoutMillis: ENV.DB_POOL_CONNECTION,
    
    // SSL for production
    ssl: ENV.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
};