import Redis from 'ioredis';
import logger from '../core/logger/logger.js';
import { ENV } from './envConfig.js';

// Backward compatibility: agar UPSTASH_REDIS_URL explicitly set hai .env mein toh woh use karo
// Warna REDIS_HOST/PORT/PASSWORD use karo (naya Redis / local Redis)
const upstashUrl = process.env.UPSTASH_REDIS_URL;
const useUpstash = !!upstashUrl;

let redis;

if (useUpstash) {
    logger.info('🔌 Redis: Using Upstash URL');
    redis = new Redis(upstashUrl, {
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
    if (ENV.REDIS_USERNAME) {
        opts.username = ENV.REDIS_USERNAME;
    }
    if (ENV.REDIS_PASSWORD) {
        opts.password = ENV.REDIS_PASSWORD;
    }
    redis = new Redis(opts);
}

redis.on('connect', () => logger.info('✅ Redis Cloud connected successfully'));
redis.on('ready', () => logger.info('✅ Redis Cloud ready'));
redis.on('error', (err) => logger.error('❌ Redis error:', err.message));
redis.on('close', () => logger.warn('⚠️ Redis connection closed'));

// ─── Health check helper ─────────────────────────────────────────────────────
export const isRedisReady = () => redis.status === 'ready';

/**
 * Safe Redis wrapper — Redis fail hone pe null return karta hai, crash nahi karta
 * Usage: const val = await redisSafe(() => redis.get('key'));
 */
export const redisSafe = async (fn) => {
    try {
        return await fn();
    } catch (err) {
        logger.warn('⚠️ Redis operation failed (non-blocking):', err.message);
        return null;
    }
};

export default redis;