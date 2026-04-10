import redis from '../../config/redis.config.js';

// ─── OTP Store karo (5 min expiry) ───────────────────────────────────────────
export const saveOTP = async (phone, otp, purpose = 'signin') => {
    const key = `otp:${purpose}:${phone}`;
    await redis.setex(key, 300, otp); // 300 seconds = 5 minutes
};

// ─── OTP Verify karo ─────────────────────────────────────────────────────────
export const verifyOTP = async (phone, otp, purpose = 'signin') => {
    const key   = `otp:${purpose}:${phone}`;
    const saved = await redis.get(key);
    if (!saved) return { valid: false, reason: 'OTP expired or not found' };
    if (saved !== String(otp)) return { valid: false, reason: 'Invalid OTP' };
    await redis.del(key); // OTP use hone ke baad delete karo
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
    await redis.setex(key, 30, data); // 30 sec expiry — agar update na aaye toh stale
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