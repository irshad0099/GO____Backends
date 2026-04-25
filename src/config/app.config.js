// export const appConfig = {
//     name: 'Ride Sharing API',
//     version: '1.0.0',
    
//     // Vehicle types and base fares
//     vehicleTypes: {
//         bike: {
//             baseFare: 20,
//             perKm: 8,
//             perMinute: 1,
//             minimumFare: 25,
//             surgeMultiplier: 1.5    
//         },
//         auto: {
//             baseFare: 30,
//             perKm: 12,
//             perMinute: 1.5,
//             minimumFare: 35,
//             surgeMultiplier: 1.5
//         },
//         car: {
//             baseFare: 50,
//             perKm: 15,
//             perMinute: 2,
//             minimumFare: 60,
//             surgeMultiplier: 2.0
//         }
//     },
    
//     // Cancellation policies
//     cancellation: {
//         freeCancellationMinutes: 5,
//         passengerCancellationFee: 10,
//         driverCancellationPenalty: 20
//     },
    
//     // Pagination defaults
//     pagination: {
//         defaultLimit: 20,
//         maxLimit: 100
//     }
// };


// export const appConfig = {
//     name: 'Ride Sharing API',
//     version: '1.0.0',
    
//     vehicleTypes: {
//         bike: {
//             label: 'Bike',
//             baseFare: 20,
//             perKm: 8,
//             perMinute: 1,
//             minimumFare: 25,
//             surgeMultiplier: 1.5    
//         },
//         auto: {
//             label: 'Auto',
//             baseFare: 30,
//             perKm: 12,
//             perMinute: 1.5,
//             minimumFare: 35,
//             surgeMultiplier: 1.5
//         },
//         car: {
//             label: 'Car',
//             baseFare: 50,
//             perKm: 15,
//             perMinute: 2,
//             minimumFare: 60,
//             surgeMultiplier: 2.0
//         }
//     },

//     peakHours: [
//         { start: '08:00', end: '10:00' },
//         { start: '18:00', end: '21:00' }
//     ],

//     convenienceFee: {
//         bike: { nonPeak: 5, peakMin: 10, peakMax: 12 },
//         auto: { nonPeakMin: 12, nonPeakMax: 15, peakMin: 20, peakMax: 25 },
//         car:  { nonPeakMin: 20, nonPeakMax: 25, peakMin: 30, peakMax: 50 }
//     },

//     surge: {
//         defaultMultiplier: 1.0,
//         maxCap: 1.75,
//         thresholds: {
//             noSurge:         1.1,
//             normalSurgeMax:  1.3
//         },
//         normalRangeMin: 1.1,
//         normalRangeMax: 1.2
//     },

//     waitingCharges: {
//         freeWaitingMinutes: 3,
//         bike: 1,
//         auto: 1.5,
//         car:  2
//     },

//     trafficDelay: {
//         graceBufferMinutes: 30,
//         compensationPerMinute: {
//             bike: 0.5,
//             auto: 1,
//             car:  1.5
//         }
//     },

//     pickupCompensation: {
//         defaultRadiusKm: 2.5,
//         extraPerKm: {
//             bike: 3,
//             auto: 5,
//             car:  7
//         }
//     },

//     platformFee: {
//         dailyRideCap: 10,
//         perRide: {
//             bike: 1,
//             auto: 1.5,
//             car:  5
//         }
//     },

//     cancellation: {
//         freeCancellationMinutes: 5,
//         passengerCancellationFee: 10,
//         driverCancellationPenalty: 20,
//         proximityPenaltyMeters: 500,
//         proximityPenaltyAmount: 50,
//         driverShareAmount: 40,
//         platformShareAmount: 10
//     },
    
//     pagination: {
//         defaultLimit: 20,
//         maxLimit: 100
//     }
// };



import { ENV } from './envConfig.js';

export const appConfig = {
    vehicleTypes: {
        bike: {
            label: 'Bike',
            baseFare:    ENV.BIKE_BASE_FARE    || 20,
            perKm:       ENV.BIKE_PER_KM       || 8,
            perMinute:   1,
            minimumFare: ENV.BIKE_MINIMUM_FARE || 25,
        },
        auto: {
            label: 'Auto',
            baseFare:    ENV.AUTO_BASE_FARE    || 30,
            perKm:       ENV.AUTO_PER_KM       || 12,
            perMinute:   1.5,
            minimumFare: ENV.AUTO_MINIMUM_FARE || 50,
        },
        car: {
            label: 'Car',
            baseFare:    ENV.CAR_BASE_FARE    || 50,
            perKm:       ENV.CAR_PER_KM       || 15,
            perMinute:   2,
            minimumFare: ENV.CAR_MINIMUM_FARE || 90,
        },

        xl: {
    label: 'XL',
    baseFare:    ENV.XL_BASE_FARE    || 80,
    perKm:       ENV.XL_PER_KM       || 20,
    perMinute:   2.5,
    minimumFare: ENV.XL_MINIMUM_FARE || 120,
},
premium: {
    label: 'Premium',
    baseFare:    ENV.PREMIUM_BASE_FARE    || 120,
    perKm:       ENV.PREMIUM_PER_KM       || 28,
    perMinute:   3,
    minimumFare: ENV.PREMIUM_MINIMUM_FARE || 200,
},
luxury: {
    label: 'Luxury',
    baseFare:    ENV.LUXURY_BASE_FARE    || 200,
    perKm:       ENV.LUXURY_PER_KM       || 40,
    perMinute:   4,
    minimumFare: ENV.LUXURY_MINIMUM_FARE || 350,
},
    },

    peakHours: [
        { start: '08:00', end: '10:00' },
        { start: '18:00', end: '21:00' }
    ],

    convenienceFee: {
        bike: {
            nonPeak:  ENV.CONV_FEE_BIKE_NONPEAK_MIN || 5,
            peakMin:  ENV.CONV_FEE_BIKE_PEAK_MIN    || 10,
            peakMax:  ENV.CONV_FEE_BIKE_PEAK_MAX    || 12
        },
        auto: {
            nonPeakMin: ENV.CONV_FEE_AUTO_NONPEAK_MIN || 12,
            nonPeakMax: ENV.CONV_FEE_AUTO_NONPEAK_MAX || 15,
            peakMin:    ENV.CONV_FEE_AUTO_PEAK_MIN    || 20,
            peakMax:    ENV.CONV_FEE_AUTO_PEAK_MAX    || 25
        },
        car: {
            nonPeakMin: ENV.CONV_FEE_CAR_NONPEAK_MIN || 20,
            nonPeakMax: ENV.CONV_FEE_CAR_NONPEAK_MAX || 25,
            peakMin:    ENV.CONV_FEE_CAR_PEAK_MIN    || 30,
            peakMax:    ENV.CONV_FEE_CAR_PEAK_MAX    || 50
        },

        xl: {
    nonPeakMin: ENV.CONV_FEE_XL_NONPEAK_MIN || 25,
    nonPeakMax: ENV.CONV_FEE_XL_NONPEAK_MAX || 30,
    peakMin:    ENV.CONV_FEE_XL_PEAK_MIN    || 40,
    peakMax:    ENV.CONV_FEE_XL_PEAK_MAX    || 60,
},
premium: {
    nonPeakMin: ENV.CONV_FEE_PREMIUM_NONPEAK_MIN || 35,
    nonPeakMax: ENV.CONV_FEE_PREMIUM_NONPEAK_MAX || 45,
    peakMin:    ENV.CONV_FEE_PREMIUM_PEAK_MIN    || 60,
    peakMax:    ENV.CONV_FEE_PREMIUM_PEAK_MAX    || 80,
},
luxury: {
    nonPeakMin: ENV.CONV_FEE_LUXURY_NONPEAK_MIN || 50,
    nonPeakMax: ENV.CONV_FEE_LUXURY_NONPEAK_MAX || 70,
    peakMin:    ENV.CONV_FEE_LUXURY_PEAK_MIN    || 80,
    peakMax:    ENV.CONV_FEE_LUXURY_PEAK_MAX    || 120,
},
    },

    surge: {
        defaultMultiplier: 1.0,
        maxCap:      ENV.SURGE_MAX_MULTIPLIER  || 1.75,
        thresholds: {
            noSurge:        ENV.PEAK_RATIO_THRESHOLD || 1.2,
            normalSurgeMax: 1.3
        },
        normalRangeMin: 1.1,
        normalRangeMax: 1.2
    },

    waitingCharges: {
    freeWaitingMinutes: ENV.WAITING_GRACE_MINUTES || 3,
    bike:    ENV.WAITING_RATE_BIKE    || 1,
    auto:    ENV.WAITING_RATE_AUTO    || 1.5,
    car:     ENV.WAITING_RATE_CAR     || 2,
    xl:      ENV.WAITING_RATE_XL      || 2.5,
    premium: ENV.WAITING_RATE_PREMIUM || 3,
    luxury:  ENV.WAITING_RATE_LUXURY  || 4,
},

    

    trafficDelay: {
        graceBufferMinutes: ENV.TRAFFIC_GRACE_BUFFER_MINUTES || 30,
        compensationPerMinute: {
            bike: ENV.TRAFFIC_RATE_BIKE || 0.5,
            auto: ENV.TRAFFIC_RATE_AUTO || 1,
            car:  ENV.TRAFFIC_RATE_CAR  || 1.5,

            xl:      ENV.TRAFFIC_RATE_XL      || 2,
premium: ENV.TRAFFIC_RATE_PREMIUM || 2.5,
luxury:  ENV.TRAFFIC_RATE_LUXURY  || 3,
        }
    },

    pickupCompensation: {
        defaultRadiusKm: ENV.PICKUP_BASE_RADIUS_KM || 2.5,
        extraPerKm: {
            bike: ENV.PICKUP_COMP_BIKE || 3,
            auto: ENV.PICKUP_COMP_AUTO || 5,
            car:  ENV.PICKUP_COMP_CAR  || 7,

            xl:      ENV.PICKUP_COMP_XL      || 9,
premium: ENV.PICKUP_COMP_PREMIUM || 12,
luxury:  ENV.PICKUP_COMP_LUXURY  || 15,
        }
    },

    platformFee: {
        dailyRideCap: ENV.PLATFORM_FEE_DAILY_CAP || 10,
        perRide: {
            bike: ENV.PLATFORM_FEE_BIKE || 1,
            auto: ENV.PLATFORM_FEE_AUTO || 1.5,
            car:  ENV.PLATFORM_FEE_CAR  || 5,

            xl:      ENV.PLATFORM_FEE_XL      || 8,
premium: ENV.PLATFORM_FEE_PREMIUM || 12,
luxury:  ENV.PLATFORM_FEE_LUXURY  || 20,
            
        }
    },

    cancellation: {
        freeCancellationMinutes:  5,
        passengerCancellationFee: 10,
        driverCancellationPenalty: 20,
        proximityPenaltyMeters:   ENV.CANCELLATION_DISTANCE_THRESHOLD || 500,
        proximityPenaltyAmount:   ENV.CANCELLATION_PENALTY            || 50,
        driverShareAmount:        ENV.CANCELLATION_PENALTY * (ENV.CANCELLATION_DRIVER_SHARE_PERCENT / 100) || 40,
        platformShareAmount:      ENV.CANCELLATION_PENALTY * (ENV.CANCELLATION_PLATFORM_SHARE_PERCENT / 100) || 10
    },

    pagination: {
        defaultLimit: ENV.PAGINATION_DEFAULT_LIMIT || 20,
        maxLimit:     ENV.PAGINATION_MAX_LIMIT     || 100
    }
};
