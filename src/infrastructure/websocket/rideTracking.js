import redis from '../../config/redis.config.js';
import { calculateDistance } from '../../core/utils/rideCalculator.js';
import logger from '../../core/logger/logger.js';

const TRACKING_TTL   = 7200;  // 2 hours
const MIN_PING_KM    = 0.01;  // 10 meters — GPS jitter ignore karo
const MIN_VALID_KM   = 0.1;   // agar total < 100m to GPS fail mana jayega

const key = (rideId) => `ride:tracking:${rideId}`;

// OTP confirm hone pe call karo — tracking shuru
export const startRideTracking = async (rideId, lat, lon) => {
    try {
        await redis.hset(key(rideId), {
            lastLat:   String(lat),
            lastLon:   String(lon),
            totalKm:   '0',
            pingCount: '0',
        });
        await redis.expire(key(rideId), TRACKING_TTL);
        logger.info(`[RideTracking] Started rideId=${rideId} at (${lat},${lon})`);
    } catch (err) {
        logger.warn(`[RideTracking] startRideTracking failed rideId=${rideId}:`, err.message);
    }
};

// Har driver:location_update pe call karo (sirf in_progress rides ke liye)
export const addTrackingPoint = async (rideId, lat, lon) => {
    try {
        const data = await redis.hgetall(key(rideId));
        if (!data || !data.lastLat) return; // tracking shuru nahi hua

        const prevLat = parseFloat(data.lastLat);
        const prevLon = parseFloat(data.lastLon);
        const segment = calculateDistance(prevLat, prevLon, lat, lon);

        // GPS jitter filter — 10 meter se kam movement ignore karo
        if (segment < MIN_PING_KM) return;

        const newTotal = parseFloat(data.totalKm) + segment;
        const newCount = parseInt(data.pingCount) + 1;

        await redis.hset(key(rideId), {
            lastLat:   String(lat),
            lastLon:   String(lon),
            totalKm:   String(Math.round(newTotal * 1000) / 1000), // 3 decimal places
            pingCount: String(newCount),
        });
        await redis.expire(key(rideId), TRACKING_TTL); // TTL refresh karo
    } catch (err) {
        logger.warn(`[RideTracking] addTrackingPoint failed rideId=${rideId}:`, err.message);
    }
};

// Completion pe call karo — actual distance nikalo
// Returns null agar tracking data nahi mila ya unreliable lag raha hai
export const getActualDistance = async (rideId) => {
    try {
        const data = await redis.hgetall(key(rideId));
        if (!data || !data.totalKm) return null;

        const totalKm   = parseFloat(data.totalKm);
        const pingCount = parseInt(data.pingCount || '0');

        // Sanity check — agar bahut kam pings aaye to GPS reliable nahi tha
        if (totalKm < MIN_VALID_KM || pingCount < 2) {
            logger.warn(`[RideTracking] Unreliable data rideId=${rideId} totalKm=${totalKm} pings=${pingCount}`);
            return null;
        }

        logger.info(`[RideTracking] Actual distance rideId=${rideId}: ${totalKm} km (${pingCount} pings)`);
        return Math.round(totalKm * 100) / 100; // 2 decimal places
    } catch (err) {
        logger.warn(`[RideTracking] getActualDistance failed rideId=${rideId}:`, err.message);
        return null;
    }
};

// Completion ke baad cleanup
export const clearRideTracking = async (rideId) => {
    try {
        await redis.del(key(rideId));
    } catch (err) {
        logger.warn(`[RideTracking] clearRideTracking failed rideId=${rideId}:`, err.message);
    }
};
