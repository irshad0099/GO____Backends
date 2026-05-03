import cron from 'node-cron';
import * as schedRepo from '../../modules/rides/repositories/scheduledRide.repository.js';
import { requestRide } from '../../modules/rides/services/rideService.js';
import { db } from '../../infrastructure/database/postgres.js';
import logger from '../../core/logger/logger.js';

// Every 2 minutes: rides check karo jinka pickup_time 15 min ke andar hai
export const startScheduledRideCron = () => {
    cron.schedule('*/2 * * * *', async () => {
        let rides;
        try {
            rides = await schedRepo.findReadyToTrigger(15);
        } catch (err) {
            logger.error(`[ScheduledRideCron] DB fetch error: ${err.message}`);
            return;
        }

        if (!rides.length) return;

        logger.info(`[ScheduledRideCron] ${rides.length} ride(s) ready to trigger`);

        for (const ride of rides) {
            // Optimistic lock: immediately set to 'triggered' before async work
            // Agar do instances hain to dono same ride nahi utha sakte
            const claimed = await schedRepo.updateStatus(ride.id, 'triggered', null);
            if (!claimed) continue; // already claimed by another instance

            try {
                const newRide = await requestRide(ride.passenger_id, {
                    pickupLatitude:      parseFloat(ride.pickup_latitude),
                    pickupLongitude:     parseFloat(ride.pickup_longitude),
                    pickupAddress:       ride.pickup_address,
                    pickupLocationName:  ride.pickup_location_name,
                    dropoffLatitude:     parseFloat(ride.dropoff_latitude),
                    dropoffLongitude:    parseFloat(ride.dropoff_longitude),
                    dropoffAddress:      ride.dropoff_address,
                    dropoffLocationName: ride.dropoff_location_name,
                    vehicleType:         ride.vehicle_type,
                    paymentMethod:       ride.payment_method,
                });

                await schedRepo.updateStatus(ride.id, 'ride_created', newRide.rideId || newRide.id);
                logger.info(`[ScheduledRideCron] Triggered | scheduledId: ${ride.id} → rideId: ${newRide.rideId || newRide.id}`);
            } catch (err) {
                await schedRepo.updateStatus(ride.id, 'failed', null);
                logger.error(`[ScheduledRideCron] Trigger FAILED | scheduledId: ${ride.id} | ${err.message}`);
            }
        }
    });

    logger.info('[ScheduledRideCron] Started — checking every 2 minutes');
};

// Daily at 3 AM: api_logs 30 din se purana data delete karo
export const startApiLogCleanupCron = () => {
    cron.schedule('0 3 * * *', async () => {
        try {
            const result = await db.query(
                `DELETE FROM api_logs WHERE created_at < NOW() - INTERVAL '30 days'`
            );
            logger.info(`[ApiLogCleanup] Deleted ${result.rowCount} old log entries`);
        } catch (err) {
            logger.error(`[ApiLogCleanup] Error: ${err.message}`);
        }
    });

    logger.info('[ApiLogCleanup] Started — runs daily at 3 AM');
};
