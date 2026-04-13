import { ENV } from '../../config/envConfig.js';

/**
 * BullMQ ke liye Redis connection options banata hai.
 * Backward compatible: UPSTASH_REDIS_URL explicitly set hai toh woh use karo,
 * warna REDIS_HOST/PORT/PASSWORD use karo.
 * maxRetriesPerRequest: null — BullMQ ki hard requirement hai.
 */
export const getRedisConnectionOptions = () => {
    const useUpstash = !!process.env.UPSTASH_REDIS_URL;

    if (useUpstash) {
        // URL format: rediss://default:<password>@<host>:<port>
        const parsed = new URL(ENV.UPSTASH_REDIS_URL);

        return {
            host:     parsed.hostname,
            port:     parseInt(parsed.port) || 6379,
            password: decodeURIComponent(parsed.password),
            username: parsed.username || 'default',
            tls:      parsed.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck:     false,
            enableOfflineQueue:   true,
            retryStrategy: (times) => Math.min(times * 100, 3000),
        };
    }

    // Naya Redis / local Redis — individual vars se
    const opts = {
        host:     ENV.REDIS_HOST,
        port:     ENV.REDIS_PORT,
        maxRetriesPerRequest: null,
        enableReadyCheck:     false,
        enableOfflineQueue:   true,
        retryStrategy: (times) => Math.min(times * 100, 3000),
    };
    if (ENV.REDIS_PASSWORD) {
        opts.password = ENV.REDIS_PASSWORD;
    }
    return opts;
};
