export const appConfig = {
    name: 'Ride Sharing API',
    version: '1.0.0',
    
    // Vehicle types and base fares
    vehicleTypes: {
        bike: {
            baseFare: 20,
            perKm: 8,
            perMinute: 1,
            minimumFare: 25,
            surgeMultiplier: 1.5
        },
        auto: {
            baseFare: 30,
            perKm: 12,
            perMinute: 1.5,
            minimumFare: 35,
            surgeMultiplier: 1.5
        },
        car: {
            baseFare: 50,
            perKm: 15,
            perMinute: 2,
            minimumFare: 60,
            surgeMultiplier: 2.0
        }
    },
    
    // Cancellation policies
    cancellation: {
        freeCancellationMinutes: 5,
        passengerCancellationFee: 10,
        driverCancellationPenalty: 20
    },
    
    // Pagination defaults
    pagination: {
        defaultLimit: 20,
        maxLimit: 100
    }
};