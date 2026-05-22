import { Worker } from 'bullmq';
import { getRedisConnectionOptions } from '../queue.config.js';
import { findRideById, expireRide } from '../../../modules/rides/repositories/ride.repository.js';
import { emitToPassenger } from '../../websocket/socket.events.js';
import { sendNotification } from '../../../core/services/firebaseService.js';
import logger from '../../../core/logger/logger.js';

const connection = getRedisConnectionOptions();

const rideExpiryWorker = new Worker('ride-expiry', async (job) => {
    const { rideId } = job.data;

    logger.info(`[RideExpiryWorker] Processing | rideId: ${rideId} | job: ${job.id}`);

    const ride = await findRideById(rideId);
    if (!ride) {
        logger.warn(`[RideExpiryWorker] Ride not found | rideId: ${rideId}`);
        return { skipped: true, reason: 'not_found' };
    }

    if (ride.status !== 'requested') {
        logger.info(`[RideExpiryWorker] Skipping — already ${ride.status} | rideId: ${rideId}`);
        return { skipped: true, reason: 'not_requested', status: ride.status };
    }

    const expired = await expireRide(rideId);
    if (!expired) {
        // Race condition: koi aur process ne already accept/cancel kar diya
        logger.info(`[RideExpiryWorker] Already transitioned before expiry | rideId: ${rideId}`);
        return { skipped: true, reason: 'race_condition' };
    }

    // Socket — passenger app ko turant batao
    try {
        emitToPassenger(ride.passenger_id, 'ride:expired', {
            rideId,
            rideNumber: ride.ride_number,
            message: 'No driver found. Please try booking again.',
        });
    } catch (err) {
        logger.warn(`[RideExpiryWorker] Socket emit failed | rideId: ${rideId} | ${err.message}`);
    }

    // FCM — agar passenger app background mein ho
    if (ride.passenger_fcm_token) {
        try {
            await sendNotification(
                ride.passenger_fcm_token,
                'No Driver Found',
                'We couldn\'t find a driver nearby. Please try again.',
                {
                    type:       'ride_expired',
                    rideId:     String(rideId),
                    rideNumber: ride.ride_number,
                }
            );
        } catch (err) {
            logger.warn(`[RideExpiryWorker] FCM failed | rideId: ${rideId} | ${err.message}`);
        }
    }

    logger.info(`[RideExpiryWorker] Ride expired | rideId: ${rideId}`);
    return { success: true };
}, {
    connection,
    concurrency: 10,
});

rideExpiryWorker.on('failed', (job, err) => {
    logger.error(`[RideExpiryWorker] Job ${job?.id} failed after ${job?.attemptsMade} attempts | rideId: ${job?.data?.rideId} | ${err.message}`);
});

rideExpiryWorker.on('error', (err) => {
    logger.error(`[RideExpiryWorker] Worker error: ${err.message}`);
});

export default rideExpiryWorker;