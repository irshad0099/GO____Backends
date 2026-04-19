import axios from 'axios';
import { ENV } from '../../config/envConfig.js';
import redis from '../../infrastructure/redis/redis.js';
import logger from '../logger/logger.js';

const GOOGLE_MAPS_API_KEY = ENV.GOOGLE_MAPS_API_KEY;
const CACHE_TTL = 600; // 10 minutes

// ─── Get Distance, Duration & Polyline ──────────────────────────────────────
export const getDistanceAndDuration = async (originLat, originLng, destLat, destLng) => {
    const cacheKey = `maps:route:${originLat}:${originLng}:${destLat}:${destLng}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            logger.info('[Maps] Cache HIT — route');
            return JSON.parse(cached);
        }

        const response = await axios.post(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
                origin: {
                    location: {
                        latLng: { latitude: parseFloat(originLat), longitude: parseFloat(originLng) }
                    }
                },
                destination: {
                    location: {
                        latLng: { latitude: parseFloat(destLat), longitude: parseFloat(destLng) }
                    }
                },
                travelMode: 'DRIVE',
                routingPreference: 'TRAFFIC_AWARE',
                computeAlternativeRoutes: false,
                routeModifiers: {
                    avoidTolls: false,
                    avoidHighways: false
                },
                languageCode: 'en-IN',
                units: 'METRIC'
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
                }
            }
        );

        const route = response.data.routes?.[0];
        if (!route) throw new Error('No route found');

        const result = {
            distanceKm:      Math.round((route.distanceMeters / 1000) * 10) / 10,
            durationMinutes: Math.ceil(parseInt(route.duration) / 60),
            polyline:        route.polyline?.encodedPolyline || null,
            source:          'google_maps'
        };

        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
        logger.info(`[Maps] Cache MISS — route calculated: ${result.distanceKm}km, ${result.durationMinutes}min`);

        return result;

    } catch (error) {
        logger.error('[Maps] getDistanceAndDuration error:', error.response?.data?.error?.message || error.message);

        const distanceKm      = haversineDistance(originLat, originLng, destLat, destLng);
        const durationMinutes = Math.ceil((distanceKm / 30) * 60);

        return {
            distanceKm,
            durationMinutes,
            polyline: null,
            source:   'haversine_fallback'
        };
    }
};

// ─── Get Driver ETA to Rider ─────────────────────────────────────────────────
export const getDriverETA = async (driverLat, driverLng, riderLat, riderLng) => {
    try {
        const result = await getDistanceAndDuration(driverLat, driverLng, riderLat, riderLng);
        return {
            etaMinutes:  result.durationMinutes,
            distanceKm:  result.distanceKm,
            source:      result.source
        };
    } catch (error) {
        logger.error('[Maps] getDriverETA error:', error.message);
        return { etaMinutes: 5, distanceKm: 1, source: 'default_fallback' };
    }
};

// ─── Geocode Address to Lat/Lng ──────────────────────────────────────────────
export const geocodeAddress = async (address) => {
    const cacheKey = `maps:geocode:${address.replace(/\s+/g, '_').toLowerCase()}`;

    try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const response = await axios.get(
            'https://maps.googleapis.com/maps/api/geocode/json',
            {
                params: {
                    address,
                    key:    GOOGLE_MAPS_API_KEY,
                    region: 'in'
                }
            }
        );

        const location = response.data.results?.[0]?.geometry?.location;
        if (!location) throw new Error('Address not found');

        const result = {
            latitude:         location.lat,
            longitude:        location.lng,
            formattedAddress: response.data.results[0].formatted_address
        };

        await redis.setex(cacheKey, 3600, JSON.stringify(result));
        return result;

    } catch (error) {
        logger.error('[Maps] geocodeAddress error:', error.message);
        throw error;
    }
};

// ─── Haversine Fallback ──────────────────────────────────────────────────────
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R    = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a    =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};