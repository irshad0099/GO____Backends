import Redis from 'ioredis';
import logger from '../core/logger/logger.js';
import { ENV } from './envConfig.js';

const redisUrl = ENV.UPSTASH_REDIS_URL;

const redis = new Redis(redisUrl, {
    tls: {
        rejectUnauthorized: false
    },
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: true,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on('connect', () => logger.info('✅ Redis connected successfully'));
redis.on('ready', () => logger.info('✅ Redis ready'));
redis.on('error', (err) => logger.error('❌ Redis error:', err.message));
redis.on('close', () => logger.warn('⚠️ Redis connection closed'));

export default redis;