import Redis from 'ioredis';
import logger from '../core/logger/logger.js';
import { ENV } from './envConfig.js';

// Backward compatibility: agar UPSTASH_REDIS_URL explicitly set hai .env mein toh woh use karo
// Warna REDIS_HOST/PORT/PASSWORD use karo (naya Redis / local Redis)
const useUpstash = !!process.env.UPSTASH_REDIS_URL;

let redis;

if (useUpstash) {
    logger.info('🔌 Redis: Using Upstash URL');
    redis = new Redis(ENV.UPSTASH_REDIS_URL, {
        tls: { rejectUnauthorized: false },
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        enableOfflineQueue: true,
        retryStrategy: (times) => Math.min(times * 50, 2000),
    });
} else {
    logger.info(`🔌 Redis: Using ${ENV.REDIS_HOST}:${ENV.REDIS_PORT}`);
    const opts = {
        host: ENV.REDIS_HOST,
        port: ENV.REDIS_PORT,
        db:   ENV.REDIS_DB,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        enableOfflineQueue: true,
        retryStrategy: (times) => Math.min(times * 50, 2000),
    };
    if (ENV.REDIS_PASSWORD) {
        opts.password = ENV.REDIS_PASSWORD;
    }
    redis = new Redis(opts);
}

redis.on('connect', () => logger.info('✅ Redis connected successfully'));
redis.on('ready', () => logger.info('✅ Redis ready'));
redis.on('error', (err) => logger.error('❌ Redis error:', err.message));
redis.on('close', () => logger.warn('⚠️ Redis connection closed'));

export default redis;