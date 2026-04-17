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


export const appConfig = {
    name: 'Ride Sharing API',
    version: '1.0.0',
    
    vehicleTypes: {
        bike: {
            label: 'Bike',
            baseFare: 20,
            perKm: 8,
            perMinute: 1,
            minimumFare: 25,
            surgeMultiplier: 1.5    
        },
        auto: {
            label: 'Auto',
            baseFare: 30,
            perKm: 12,
            perMinute: 1.5,
            minimumFare: 35,
            surgeMultiplier: 1.5
        },
        car: {
            label: 'Car',
            baseFare: 50,
            perKm: 15,
            perMinute: 2,
            minimumFare: 60,
            surgeMultiplier: 2.0
        }
    },

    peakHours: [
        { start: '08:00', end: '10:00' },
        { start: '18:00', end: '21:00' }
    ],

    convenienceFee: {
        bike: { nonPeak: 5, peakMin: 10, peakMax: 12 },
        auto: { nonPeakMin: 12, nonPeakMax: 15, peakMin: 20, peakMax: 25 },
        car:  { nonPeakMin: 20, nonPeakMax: 25, peakMin: 30, peakMax: 50 }
    },

    surge: {
        defaultMultiplier: 1.0,
        maxCap: 1.75,
        thresholds: {
            noSurge:         1.1,
            normalSurgeMax:  1.3
        },
        normalRangeMin: 1.1,
        normalRangeMax: 1.2
    },

    waitingCharges: {
        freeWaitingMinutes: 3,
        bike: 1,
        auto: 1.5,
        car:  2
    },

    trafficDelay: {
        graceBufferMinutes: 30,
        compensationPerMinute: {
            bike: 0.5,
            auto: 1,
            car:  1.5
        }
    },

    pickupCompensation: {
        defaultRadiusKm: 2.5,
        extraPerKm: {
            bike: 3,
            auto: 5,
            car:  7
        }
    },

    platformFee: {
        dailyRideCap: 10,
        perRide: {
            bike: 1,
            auto: 1.5,
            car:  5
        }
    },

    cancellation: {
        freeCancellationMinutes: 5,
        passengerCancellationFee: 10,
        driverCancellationPenalty: 20,
        proximityPenaltyMeters: 500,
        proximityPenaltyAmount: 50,
        driverShareAmount: 40,
        platformShareAmount: 10
    },
    
    pagination: {
        defaultLimit: 20,
        maxLimit: 100
    }
};
