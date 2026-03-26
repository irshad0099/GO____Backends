import { ENV } from '../../config/envConfig.js';
import logger from '../logger/logger.js';

// ─── In-Memory Cache ────────────────────────────────────────────────────────
// Weather doesn't change every second — cache per area for 15 min (configurable)
// Key = rounded lat,lng (1 decimal = ~11km area) → same cache for nearby requests
const weatherCache = new Map();

const getCacheKey = (lat, lng) => {
    return `${Math.round(lat * 10) / 10},${Math.round(lng * 10) / 10}`;
};

const getCachedWeather = (lat, lng) => {
    const key = getCacheKey(lat, lng);
    const cached = weatherCache.get(key);
    if (!cached) return null;

    const cacheMinutes = Number(ENV.WEATHER_CACHE_MINUTES) || 15;
    const ageMs = Date.now() - cached.timestamp;
    if (ageMs > cacheMinutes * 60 * 1000) {
        weatherCache.delete(key);
        return null;
    }

    return cached.data;
};

const setCachedWeather = (lat, lng, data) => {
    const key = getCacheKey(lat, lng);
    weatherCache.set(key, { data, timestamp: Date.now() });

    // Cleanup: agar cache 500 se zyada entries ho gayi toh purani hatao
    if (weatherCache.size > 500) {
        const oldest = weatherCache.keys().next().value;
        weatherCache.delete(oldest);
    }
};

// ─── Fetch Weather from OpenWeatherMap ──────────────────────────────────────
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
        condition:   data.weather?.[0]?.main  || 'Clear',   // Rain, Thunderstorm, etc.
        description: data.weather?.[0]?.description || '',   // "heavy rain", "light snow"
        temp:        data.main?.temp || 0,
        humidity:    data.main?.humidity || 0,
        windSpeed:   data.wind?.speed || 0,
        cityName:    data.name || ''
    };
};

// ─── Main Export: Get Weather Peak Signal ───────────────────────────────────
// Plug & Play: agar OPENWEATHER_API_KEY nahi hai → silently returns no peak
export const getWeatherSignal = async (latitude, longitude) => {
    const noWeather = {
        isWeatherPeak: false,
        weatherCondition: 'unknown',
        weatherDescription: '',
        weatherSurge: 1.0,
        severity: 'none',
        weatherAvailable: false
    };

    // No API key = weather detection disabled
    const apiKey = ENV.OPENWEATHER_API_KEY;
    if (!apiKey) return noWeather;

    try {
        // Check cache first
        let weather = getCachedWeather(latitude, longitude);

        if (!weather) {
            weather = await fetchWeatherFromAPI(latitude, longitude);
            if (!weather) return noWeather;
            setCachedWeather(latitude, longitude, weather);
        }

        const peakConditions   = ENV.WEATHER_PEAK_CONDITIONS   || ['Rain', 'Drizzle', 'Thunderstorm', 'Snow', 'Squall', 'Tornado'];
        const severeConditions = ENV.WEATHER_SEVERE_CONDITIONS  || ['Thunderstorm', 'Snow', 'Squall', 'Tornado'];
        const mildSurge        = Number(ENV.WEATHER_SURGE_MILD)   || 1.1;
        const severeSurge      = Number(ENV.WEATHER_SURGE_SEVERE) || 1.25;

        const condition      = weather.condition;
        const isWeatherPeak  = peakConditions.includes(condition);
        const isSevere       = severeConditions.includes(condition);

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
