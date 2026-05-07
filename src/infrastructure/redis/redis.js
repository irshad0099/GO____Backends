/**
 * Standardized Redis client — re-exports from config/redis.config.js
 * All files should use the SAME Redis connection instance.
 */
import redis from '../../config/redis.config.js';

export { redis };
export default redis;