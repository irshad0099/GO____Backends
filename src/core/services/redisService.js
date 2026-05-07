import jwt from 'jsonwebtoken';
import redis, { redisSafe } from '../../config/redis.config.js';
import logger from '../logger/logger.js';

// ─── OTP Store karo (5 min expiry) ───────────────────────────────────────────
export const saveOTP = async (phone, otp, purpose = 'signin') => {
    const key = `otp:${purpose}:${phone}`;
    await redisSafe(() => redis.setex(key, 300, otp));
};

// ─── OTP Verify karo ─────────────────────────────────────────────────────────
export const verifyOTP = async (phone, otp, purpose = 'signin') => {
    const key   = `otp:${purpose}:${phone}`;
    const saved = await redisSafe(() => redis.get(key));
    if (!saved) return { valid: false, reason: 'OTP expired or not found' };
    if (saved !== String(otp)) return { valid: false, reason: 'Invalid OTP' };
    await redisSafe(() => redis.del(key));
    return { valid: true };
};

// ─── OTP Delete karo ─────────────────────────────────────────────────────────
export const deleteOTP = async (phone, purpose = 'signin') => {
    await redisSafe(() => redis.del(`otp:${purpose}:${phone}`));
};

// ─── Driver Location Store karo ───────────────────────────────────────────────
export const saveDriverLocation = async (driverId, lat, lng) => {
    const key  = `driver:location:${driverId}`;
    const data = JSON.stringify({ lat, lng, updatedAt: Date.now() });
    await redisSafe(() => redis.setex(key, 120, data)); // 2 min expiry — was 30s, too short
};

// ─── Driver Location Get karo ─────────────────────────────────────────────────
export const getDriverLocation = async (driverId) => {
    const data = await redisSafe(() => redis.get(`driver:location:${driverId}`));
    return data ? JSON.parse(data) : null;
};

// ─── Token Blacklist (logout pe) ──────────────────────────────────────────────
export const blacklistToken = async (token, expirySeconds = 86400) => {
    try {
        const decoded = jwt.decode(token);
        if (decoded?.exp) {
            const remaining = decoded.exp - Math.floor(Date.now() / 1000);
            if (remaining > 0) expirySeconds = remaining;
        }
    } catch { /* decode fail pe default use karo */ }
    await redisSafe(() => redis.setex(`blacklist:${token}`, expirySeconds, '1'));
};

export const isTokenBlacklisted = async (token) => {
    const result = await redisSafe(() => redis.get(`blacklist:${token}`));
    return result === '1';
};

// ─── Rate Limit check ─────────────────────────────────────────────────────────
export const checkRateLimit = async (key, maxRequests, windowSeconds) => {
    const current = await redisSafe(() => redis.incr(key));
    if (current === null) return { allowed: true, current: 0, max: maxRequests }; // Redis down = allow
    if (current === 1) await redisSafe(() => redis.expire(key, windowSeconds));
    return { allowed: current <= maxRequests, current, max: maxRequests };
};

// ─────────────────────────────────────────────────────────────────────────────
//  NEARBY DRIVERS CACHE
//  Key: nearby:drivers:{vehicleType}:{lat}:{lng}
//  TTL: 30 seconds (was 10s — too short for effective caching)
// ─────────────────────────────────────────────────────────────────────────────

const getNearbyKey = (vehicleType, lat, lng) => {
    // ~1km precision — nearby requests share cache
    const rLat = Math.round(lat * 100) / 100;
    const rLng = Math.round(lng * 100) / 100;
    return `nearby:drivers:${vehicleType}:${rLat}:${rLng}`;
};

export const getCachedNearbyDrivers = async (vehicleType, lat, lng) => {
    try {
        const key  = getNearbyKey(vehicleType, lat, lng);
        const data = await redisSafe(() => redis.get(key));
        if (!data) return null;
        logger.info(`✅ Nearby drivers cache HIT | ${key}`);
        return JSON.parse(data);
    } catch (error) {
        logger.warn('Nearby drivers cache parse error:', error.message);
        return null;
    }
};

export const setCachedNearbyDrivers = async (vehicleType, lat, lng, drivers) => {
    try {
        const key = getNearbyKey(vehicleType, lat, lng);
        await redisSafe(() => redis.setex(key, 30, JSON.stringify(drivers)));
        logger.info(`💾 Nearby drivers cached | ${key} | ${drivers.length} drivers | TTL: 30s`);
    } catch (error) {
        logger.warn('Nearby drivers Redis SET error:', error.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  SURGE MULTIPLIER CACHE
//  Key: surge:{vehicleType}:{lat}:{lng}
//  TTL: 60 seconds (was 30s)
// ─────────────────────────────────────────────────────────────────────────────

const getSurgeKey = (vehicleType, lat, lng) => {
    const rLat = Math.round(lat * 10) / 10;
    const rLng = Math.round(lng * 10) / 10;
    return `surge:${vehicleType}:${rLat}:${rLng}`;
};

export const getCachedSurge = async (vehicleType, lat, lng) => {
    try {
        const key  = getSurgeKey(vehicleType, lat, lng);
        const data = await redisSafe(() => redis.get(key));
        if (!data) return null;
        logger.info(`✅ Surge cache HIT | ${key}`);
        return JSON.parse(data);
    } catch (error) {
        logger.warn('Surge Redis GET error:', error.message);
        return null;
    }
};

export const setCachedSurge = async (vehicleType, lat, lng, surgeData) => {
    try {
        const key = getSurgeKey(vehicleType, lat, lng);
        await redisSafe(() => redis.setex(key, 60, JSON.stringify(surgeData)));
        logger.info(`💾 Surge cached | ${key} | TTL: 60s`);
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
        const data = await redisSafe(() => redis.get(key));
        if (!data) return null;
        logger.info(`✅ Driver profile cache HIT | driver:${driverId}`);
        return JSON.parse(data);
    } catch (error) {
        logger.warn('Driver profile Redis GET error:', error.message);
        return null;
    }
};

export const setCachedDriverProfile = async (driverId, profile) => {
    try {
        await redisSafe(() => redis.setex(`driver:profile:${driverId}`, 300, JSON.stringify(profile)));
        logger.info(`💾 Driver profile cached | driver:${driverId} | TTL: 5min`);
    } catch (error) {
        logger.warn('Driver profile Redis SET error:', error.message);
    }
};

export const invalidateDriverProfileCache = async (driverId) => {
    try {
        await redisSafe(() => redis.del(`driver:profile:${driverId}`));
        logger.debug(`🗑 Driver profile cache invalidated | driver:${driverId}`);
    } catch (error) {
        logger.warn('Driver profile Redis DEL error:', error.message);
    }
};