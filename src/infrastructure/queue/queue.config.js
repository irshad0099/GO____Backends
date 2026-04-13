// import { ENV } from '../../config/envConfig.js';

// /**
//  * BullMQ ke liye Redis connection options banata hai.
//  * Upstash TLS URL se host/port/password parse karta hai.
//  * maxRetriesPerRequest: null — BullMQ ki hard requirement hai.
//  */
// export const getRedisConnectionOptions = () => {
//     const redisUrl = ENV.UPSTASH_REDIS_URL;

//     // URL format: rediss://default:<password>@<host>:<port>
//     const parsed = new URL(redisUrl);

//     return {
//         host:     parsed.hostname,
//         port:     parseInt(parsed.port) || 6379,
//         password: decodeURIComponent(parsed.password),
//         username: parsed.username || 'default',
//         tls:      parsed.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,

//         // BullMQ requirement — blocking commands ke liye null chahiye
//         maxRetriesPerRequest: null,
//         enableReadyCheck:     false,
//         enableOfflineQueue:   true,

//         retryStrategy: (times) => Math.min(times * 100, 3000),
//     };
// };



import { ENV } from '../../config/envConfig.js';

/**
 * BullMQ ke liye Redis connection options banata hai.
 * Redis Cloud host/port/password directly use karta hai.
 * maxRetriesPerRequest: null — BullMQ ki hard requirement hai.
 */
export const getRedisConnectionOptions = () => {
    return {
        host:     ENV.REDIS_HOST,
        port:     ENV.REDIS_PORT,
        password: ENV.REDIS_PASSWORD,
        username: ENV.REDIS_USERNAME || 'default',
        maxRetriesPerRequest: null,
        enableReadyCheck:     false,
        enableOfflineQueue:   true,
        retryStrategy: (times) => Math.min(times * 100, 3000),
    };
};