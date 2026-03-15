import {ENV} from '../../config/envConfig.js';

export const calculateRideFare = (vehicleType, distanceKm, durationMinutes, surgeMultiplier = 1.0) => {
    let baseFare, perKm, perMinute, minimumFare;

    switch (vehicleType) {
        case 'bike':
            baseFare = ENV.BIKE_BASE_FARE || 20;
            perKm = ENV.BIKE_PER_KM || 8;
            perMinute = ENV.BIKE_PER_MINUTE || 1;
            minimumFare = ENV.BIKE_MINIMUM_FARE || 25;
            break;
        case 'auto':
            baseFare = ENV.AUTO_BASE_FARE || 30;
            perKm = ENV.AUTO_PER_KM || 12;
            perMinute = ENV.AUTO_PER_MINUTE || 1.5;
            minimumFare = ENV.AUTO_MINIMUM_FARE || 35;
            break;
        case 'car':
            baseFare = ENV.CAR_BASE_FARE || 50;
            perKm = ENV.CAR_PER_KM || 15;
            perMinute = ENV.CAR_PER_MINUTE || 2;
            minimumFare = ENV.CAR_MINIMUM_FARE || 60;
            break;
        default:
            throw new Error('Invalid vehicle type');
    }

    const distanceFare = distanceKm * perKm;
    const timeFare = durationMinutes * perMinute;
    let totalFare = (baseFare + distanceFare + timeFare) * surgeMultiplier;

    // Apply minimum fare
    totalFare = Math.max(totalFare, minimumFare);

    // Round to nearest integer
    totalFare = Math.round(totalFare);

    return {
        baseFare,
        distanceFare: Math.round(distanceFare),
        timeFare: Math.round(timeFare),
        surgeMultiplier,
        estimatedFare: totalFare
    };
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal
};

export const calculateDuration = (distanceKm, vehicleType) => {
    let averageSpeed;
    
    switch (vehicleType) {
        case 'bike':
            averageSpeed = 30; // km/h
            break;
        case 'auto':
            averageSpeed = 25; // km/h
            break;
        case 'car':
            averageSpeed = 35; // km/h
            break;
        default:
            averageSpeed = 30;
    }
    
    const durationHours = distanceKm / averageSpeed;
    const durationMinutes = Math.ceil(durationHours * 60);
    
    return durationMinutes;
};

export const generateRideNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RIDE-${timestamp}${random}`;
};

export const calculateSurgeMultiplier = (nearbyDriversCount, totalRequests) => {
    if (nearbyDriversCount === 0) return ENV.SURGE_MAX_MULTIPLIER || 2.5;
    
    const demandRatio = totalRequests / nearbyDriversCount;
    
    if (demandRatio >= 3) return ENV.SURGE_MAX_MULTIPLIER || 2.5;
    if (demandRatio >= 2) return 2.0;
    if (demandRatio >= 1.5) return 1.5;
    if (demandRatio >= 1.2) return 1.2;
    
    return ENV.SURGE_BASE_MULTIPLIER || 1.0;
};