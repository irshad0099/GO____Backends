// import Redis from "ioredis";
// import dotenv from "dotenv";

// dotenv.config();

// export const redis = new Redis({
//   host: process.env.REDIS_HOST,
//   port: process.env.REDIS_PORT,
// });

// redis.on("connect", () => {
//   console.log("✅ Redis Connected");
// });



import Redis from "ioredis";
import { ENV } from "../../config/envConfig.js";

const redis = new Redis({
    host: ENV.REDIS_HOST,
    port: ENV.REDIS_PORT,
    username: ENV.REDIS_USERNAME,
    password: ENV.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: true,
    retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on("connect", () => console.log("✅ Redis Cloud Connected"));
redis.on("error", (err) => console.error("❌ Redis Error:", err.message));

export { redis };
export default redis;