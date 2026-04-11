import Redis from 'ioredis';
import logger from '../core/logger/logger.js';

const redis = new Redis(process.env.REDIS_URL, {
    tls: {},
    maxRetriesPerRequest: 3,
    lazyConnect: false,
});

redis.on('connect', () => logger.info('✅ Redis connected successfully'));
redis.on('error',   (err) => logger.error('❌ Redis error:', err.message));

export default redis;