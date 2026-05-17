import { Worker } from 'bullmq';
import { getRedisConnectionOptions } from '../queue.config.js';
import * as driverRepo from '../../../modules/drivers/repositories/driver.repository.js';
import * as couponService from '../../../modules/coupons/services/couponService.js';
import { creditPendingIncentives } from '../../../modules/drivers/services/incentiveService.js';
import logger from '../../../core/logger/logger.js';

const connection = getRedisConnectionOptions();

/**
 * Ride Completion Worker — ride complete hone ke baad ka heavy work.
 *
 * Expected job.data shape:
 * {
 *   rideId:              string,
 *   driverId:            number,
 *   driverTotalRides:    number,
 *   driverTotalEarnings: number,
 *   netEarnings:         number,
 *   couponId:            number | null,
 *   passengerId:         number,
 *   couponDiscount:      number,
 *   finalFare:           number,
 * }
 */
const rideCompletionWorker = new Worker('ride-completion', async (job) => {
    const {
        rideId,
        driverId,
        driverTotalRides,
        couponId,
        passengerId,
        couponDiscount,
        finalFare,
    } = job.data;

    logger.info(`[RideCompletionWorker] Processing | rideId: ${rideId} | job: ${job.id}`);

    // 1. Driver total_rides update only
    // total_earnings is handled by earningsService.creditDriverEarnings — updating here would double-count
    await driverRepo.updateDriver(driverId, {
        total_rides: driverTotalRides + 1,
    });

    // 2. Coupon usage record — agar ride pe coupon laga tha
    if (couponId) {
        await couponService.recordUsage(couponId, passengerId, rideId, Number(couponDiscount), finalFare);
        logger.info(`[RideCompletionWorker] Coupon ${couponId} usage recorded | rideId: ${rideId}`);
    }

    // 3. Credit any completed incentive bonuses
    try {
        const incentiveResult = await creditPendingIncentives(driverId);
        if (incentiveResult.count > 0) {
            logger.info(`[RideCompletionWorker] Incentives credited | Driver: ${driverId} | Count: ${incentiveResult.count} | Total: ₹${incentiveResult.credited}`);
        }
    } catch (err) {
        logger.error(`[RideCompletionWorker] Incentive credit failed (non-fatal) | Driver: ${driverId} | ${err.message}`);
    }

    logger.info(`[RideCompletionWorker] Done | rideId: ${rideId} | driver ${driverId} earnings updated`);
    return { success: true };
}, {
    connection,
    concurrency: 5,
});

rideCompletionWorker.on('failed', (job, err) => {
    logger.error(`[RideCompletionWorker] Job ${job?.id} failed after ${job?.attemptsMade} attempts | rideId: ${job?.data?.rideId} | ${err.message}`);
});

rideCompletionWorker.on('error', (err) => {
    logger.error(`[RideCompletionWorker] Worker error: ${err.message}`);
});

export default rideCompletionWorker;
