// import redis from '../../config/redis.config.js';

// // ─── OTP Store karo (5 min expiry) ───────────────────────────────────────────
// export const saveOTP = async (phone, otp, purpose = 'signin') => {
//     const key = `otp:${purpose}:${phone}`;
//     await redis.setex(key, 300, otp); // 300 seconds = 5 minutes
// };

// // ─── OTP Verify karo ─────────────────────────────────────────────────────────
// export const verifyOTP = async (phone, otp, purpose = 'signin') => {
//     const key   = `otp:${purpose}:${phone}`;
//     const saved = await redis.get(key);
//     if (!saved) return { valid: false, reason: 'OTP expired or not found' };
//     if (saved !== String(otp)) return { valid: false, reason: 'Invalid OTP' };
//     await redis.del(key); // OTP use hone ke baad delete karo
//     return { valid: true };
// };

// // ─── OTP Delete karo ─────────────────────────────────────────────────────────
// export const deleteOTP = async (phone, purpose = 'signin') => {
//     await redis.del(`otp:${purpose}:${phone}`);
// };

// // ─── Driver Location Store karo ───────────────────────────────────────────────
// export const saveDriverLocation = async (driverId, lat, lng) => {
//     const key  = `driver:location:${driverId}`;
//     const data = JSON.stringify({ lat, lng, updatedAt: Date.now() });
//     await redis.setex(key, 30, data); // 30 sec expiry — agar update na aaye toh stale
// };

// // ─── Driver Location Get karo ─────────────────────────────────────────────────
// export const getDriverLocation = async (driverId) => {
//     const data = await redis.get(`driver:location:${driverId}`);
//     return data ? JSON.parse(data) : null;
// };

// // ─── Token Blacklist (logout pe) ──────────────────────────────────────────────
// export const blacklistToken = async (token, expirySeconds = 86400) => {
//     await redis.setex(`blacklist:${token}`, expirySeconds, '1');
// };

// export const isTokenBlacklisted = async (token) => {
//     const result = await redis.get(`blacklist:${token}`);
//     return result === '1';
// };

// // ─── Rate Limit check ─────────────────────────────────────────────────────────
// export const checkRateLimit = async (key, maxRequests, windowSeconds) => {
//     const current = await redis.incr(key);
//     if (current === 1) await redis.expire(key, windowSeconds);
//     return { allowed: current <= maxRequests, current, max: maxRequests };
// };





import redis from '../../config/redis.config.js';
import logger from '../logger/logger.js';

// ─── OTP Store karo (5 min expiry) ───────────────────────────────────────────
export const saveOTP = async (phone, otp, purpose = 'signin') => {
    const key = `otp:${purpose}:${phone}`;
    await redis.setex(key, 300, otp);
};

// ─── OTP Verify karo ─────────────────────────────────────────────────────────
export const verifyOTP = async (phone, otp, purpose = 'signin') => {
    const key   = `otp:${purpose}:${phone}`;
    const saved = await redis.get(key);
    if (!saved) return { valid: false, reason: 'OTP expired or not found' };
    if (saved !== String(otp)) return { valid: false, reason: 'Invalid OTP' };
    await redis.del(key);
    return { valid: true };
};

// ─── OTP Delete karo ─────────────────────────────────────────────────────────
export const deleteOTP = async (phone, purpose = 'signin') => {
    await redis.del(`otp:${purpose}:${phone}`);
};

// ─── Driver Location Store karo ───────────────────────────────────────────────
export const saveDriverLocation = async (driverId, lat, lng) => {
    const key  = `driver:location:${driverId}`;
    const data = JSON.stringify({ lat, lng, updatedAt: Date.now() });
    await redis.setex(key, 30, data);
};

// ─── Driver Location Get karo ─────────────────────────────────────────────────
export const getDriverLocation = async (driverId) => {
    const data = await redis.get(`driver:location:${driverId}`);
    return data ? JSON.parse(data) : null;
};

// ─── Token Blacklist (logout pe) ──────────────────────────────────────────────
export const blacklistToken = async (token, expirySeconds = 86400) => {
    await redis.setex(`blacklist:${token}`, expirySeconds, '1');
};

export const isTokenBlacklisted = async (token) => {
    const result = await redis.get(`blacklist:${token}`);
    return result === '1';
};

// ─── Rate Limit check ─────────────────────────────────────────────────────────
export const checkRateLimit = async (key, maxRequests, windowSeconds) => {
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, windowSeconds);
    return { allowed: current <= maxRequests, current, max: maxRequests };
};

// ─────────────────────────────────────────────────────────────────────────────
//  NEARBY DRIVERS CACHE
//  Key: nearby:drivers:{vehicleType}:{lat}:{lng}
//  TTL: 10 seconds (drivers move fast!)
// ─────────────────────────────────────────────────────────────────────────────

const getNearbyKey = (vehicleType, lat, lng) => {
    const rLat = Math.round(lat * 100) / 100; // ~1km precision
    const rLng = Math.round(lng * 100) / 100;
    return `nearby:drivers:${vehicleType}:${rLat}:${rLng}`;
};

export const getCachedNearbyDrivers = async (vehicleType, lat, lng) => {
    try {
        const key  = getNearbyKey(vehicleType, lat, lng);
        const data = await redis.get(key);
        if (!data) return null;
        logger.debug(`✅ Nearby drivers cache HIT | ${key}`);
        return JSON.parse(data);
    } catch (error) {
        logger.warn('Nearby drivers Redis GET error:', error.message);
        return null;
    }
};

export const setCachedNearbyDrivers = async (vehicleType, lat, lng, drivers) => {
    try {
        const key = getNearbyKey(vehicleType, lat, lng);
        await redis.setex(key, 10, JSON.stringify(drivers));
        logger.debug(`💾 Nearby drivers cached | ${key} | ${drivers.length} drivers | TTL: 10s`);
    } catch (error) {
        logger.warn('Nearby drivers Redis SET error:', error.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  SURGE MULTIPLIER CACHE
//  Key: surge:{vehicleType}:{lat}:{lng}
//  TTL: 30 seconds
// ─────────────────────────────────────────────────────────────────────────────

const getSurgeKey = (vehicleType, lat, lng) => {
    const rLat = Math.round(lat * 10) / 10; // ~11km precision
    const rLng = Math.round(lng * 10) / 10;
    return `surge:${vehicleType}:${rLat}:${rLng}`;
};

export const getCachedSurge = async (vehicleType, lat, lng) => {
    try {
        const key  = getSurgeKey(vehicleType, lat, lng);
        const data = await redis.get(key);
        if (!data) return null;
        logger.debug(`✅ Surge cache HIT | ${key}`);
        return JSON.parse(data);
    } catch (error) {
        logger.warn('Surge Redis GET error:', error.message);
        return null;
    }
};

export const setCachedSurge = async (vehicleType, lat, lng, surgeData) => {
    try {
        const key = getSurgeKey(vehicleType, lat, lng);
        await redis.setex(key, 30, JSON.stringify(surgeData));
        logger.debug(`💾 Surge cached | ${key} | TTL: 30s`);
    } catch (error) {
        logger.warn('Surge Redis SET error:', error.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DRIVER PROFILE CACHE
//  Key: driver:profile:{driverId}
//  TTL: 5 minutes
// ─────────────────────────────────────────────────────────────────────────────

export const getCachedDriverProfile = async (driverId) => {
    try {
        const key  = `driver:profile:${driverId}`;
        const data = await redis.get(key);
        if (!data) return null;
        logger.debug(`✅ Driver profile cache HIT | driver:${driverId}`);
        return JSON.parse(data);
    } catch (error) {
        logger.warn('Driver profile Redis GET error:', error.message);
        return null;
    }
};

export const setCachedDriverProfile = async (driverId, profile) => {
    try {
        await redis.setex(`driver:profile:${driverId}`, 300, JSON.stringify(profile));
        logger.debug(`💾 Driver profile cached | driver:${driverId} | TTL: 5min`);
    } catch (error) {
        logger.warn('Driver profile Redis SET error:', error.message);
    }
};

export const invalidateDriverProfileCache = async (driverId) => {
    try {
        await redis.del(`driver:profile:${driverId}`);
        logger.debug(`🗑 Driver profile cache invalidated | driver:${driverId}`);
    } catch (error) {
        logger.warn('Driver profile Redis DEL error:', error.message);
    }
};