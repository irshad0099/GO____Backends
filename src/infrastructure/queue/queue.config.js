import { ENV } from '../../config/envConfig.js';

/**
 * BullMQ ke liye Redis connection options banata hai.
 * Upstash TLS URL se host/port/password parse karta hai.
 * maxRetriesPerRequest: null — BullMQ ki hard requirement hai.
 */
export const getRedisConnectionOptions = () => {
    const redisUrl = ENV.UPSTASH_REDIS_URL;

    // URL format: rediss://default:<password>@<host>:<port>
    const parsed = new URL(redisUrl);

    return {
        host:     parsed.hostname,
        port:     parseInt(parsed.port) || 6379,
        password: decodeURIComponent(parsed.password),
        username: parsed.username || 'default',
        tls:      parsed.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,

        // BullMQ requirement — blocking commands ke liye null chahiye
        maxRetriesPerRequest: null,
        enableReadyCheck:     false,
        enableOfflineQueue:   true,

        retryStrategy: (times) => Math.min(times * 100, 3000),
    };
};
