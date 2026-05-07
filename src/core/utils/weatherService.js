import { ENV } from '../../config/envConfig.js';
import logger from '../logger/logger.js';
import redis, { redisSafe } from '../../config/redis.config.js';

// ─── Cache Key ───────────────────────────────────────────────────────────────
const getCacheKey = (lat, lng) => {
    const roundedLat = Math.round(lat * 10) / 10;
    const roundedLng = Math.round(lng * 10) / 10;
    return `weather:${roundedLat}:${roundedLng}`;
};

// ─── Redis Cache Get ─────────────────────────────────────────────────────────
const getCachedWeather = async (lat, lng) => {
    try {
        const key  = getCacheKey(lat, lng);
        const data = await redisSafe(() => redis.get(key));
        if (!data) return null;
        logger.info('✅ Weather cache HIT', { key });
        return JSON.parse(data);
    } catch (error) {
        logger.warn('Weather Redis GET error:', error.message);
        return null;
    }
};

// ─── Redis Cache Set ─────────────────────────────────────────────────────────
const setCachedWeather = async (lat, lng, data) => {
    try {
        const key        = getCacheKey(lat, lng);
        const cacheMins  = Number(ENV.WEATHER_CACHE_MINUTES) || 15;
        const ttlSeconds = cacheMins * 60;
        await redisSafe(() => redis.setex(key, ttlSeconds, JSON.stringify(data)));
        logger.info('💾 Weather cached in Redis', { key, ttlSeconds });
    } catch (error) {
        logger.warn('Weather Redis SET error:', error.message);
    }
};

// ─── Fetch from OpenWeatherMap API ───────────────────────────────────────────
const fetchWeatherFromAPI = async (lat, lng) => {
    const apiKey = ENV.OPENWEATHER_API_KEY;
    if (!apiKey) return null;

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;

    const response = await fetch(url);
    if (!response.ok) {
        logger.warn(`Weather API returned ${response.status}: ${response.statusText}`);
        return null;
    }

    const data = await response.json();
    return {
        condition:   data.weather?.[0]?.main        || 'Clear',
        description: data.weather?.[0]?.description || '',
        temp:        data.main?.temp                 || 0,
        humidity:    data.main?.humidity             || 0,
        windSpeed:   data.wind?.speed                || 0,
        cityName:    data.name                       || ''
    };
};

// ─── Main Export: Get Weather Peak Signal ────────────────────────────────────
export const getWeatherSignal = async (latitude, longitude) => {
    const noWeather = {
        isWeatherPeak:      false,
        weatherCondition:   'unknown',
        weatherDescription: '',
        weatherSurge:       1.0,
        severity:           'none',
        weatherAvailable:   false
    };

    const apiKey = ENV.OPENWEATHER_API_KEY;
    if (!apiKey) return noWeather;

    try {
        // ── Step 1: Redis cache check karo ────────────────────────────────────
        let weather = await getCachedWeather(latitude, longitude);

        // ── Step 2: Cache miss — API se fetch karo ────────────────────────────
        if (!weather) {
            logger.debug('🌤 Weather cache MISS — fetching from API');
            weather = await fetchWeatherFromAPI(latitude, longitude);
            if (!weather) return noWeather;

            // ── Step 3: Redis mein cache karo ─────────────────────────────────
            await setCachedWeather(latitude, longitude, weather);
        }

        const peakConditions   = ENV.WEATHER_PEAK_CONDITIONS   || ['Rain', 'Drizzle', 'Thunderstorm', 'Snow', 'Squall', 'Tornado'];
        const severeConditions = ENV.WEATHER_SEVERE_CONDITIONS  || ['Thunderstorm', 'Snow', 'Squall', 'Tornado'];
        const mildSurge        = Number(ENV.WEATHER_SURGE_MILD)   || 1.1;
        const severeSurge      = Number(ENV.WEATHER_SURGE_SEVERE) || 1.25;

        const condition     = weather.condition;
        const isWeatherPeak = peakConditions.includes(condition);
        const isSevere      = severeConditions.includes(condition);

        return {
            isWeatherPeak,
            weatherCondition:    condition,
            weatherDescription:  weather.description,
            weatherSurge:        isWeatherPeak ? (isSevere ? severeSurge : mildSurge) : 1.0,
            severity:            isSevere ? 'severe' : (isWeatherPeak ? 'mild' : 'none'),
            temp:                weather.temp,
            humidity:            weather.humidity,
            windSpeed:           weather.windSpeed,
            cityName:            weather.cityName,
            weatherAvailable:    true
        };
    } catch (error) {
        logger.warn('Weather service error (non-blocking):', error.message);
        return noWeather;
    }
};