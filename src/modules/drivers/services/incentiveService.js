import { db } from '../../../infrastructure/database/postgres.js';
import * as incentiveRepo from '../repositories/incentive.repository.js';
import * as driverRepo from '../repositories/driver.repository.js';
import { insertLedgerEntry } from '../repositories/earnings.repository.js';
import { creditWallet } from '../../wallet/repositories/wallet.repository.js';
import { NotFoundError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

// ─── Period boundaries ──────────────────────────────────────────────────────
// Server local time. If we ever multi-region, this needs the city's TZ.
const getPeriodStart = (durationType, date = new Date()) => {
    const d = new Date(date);
    if (durationType === 'daily') {
        d.setHours(0, 0, 0, 0);
    } else if (durationType === 'weekly') {
        // Week starts on Monday — Sunday rides count toward the previous week.
        const day = d.getDay();                  // 0 = Sun, 1 = Mon, …
        const diff = (day === 0 ? -6 : 1 - day);
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
    } else if (durationType === 'monthly') {
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
    }
    return d;
};

// Peak-hour check that handles wrap-around (e.g. 22 → 02).
const isInPeakHours = (plan, date) => {
    if (plan.peak_start_hour == null || plan.peak_end_hour == null) return true;
    const h = date.getHours();
    const s = plan.peak_start_hour;
    const e = plan.peak_end_hour;
    return s <= e ? (h >= s && h <= e) : (h >= s || h <= e);
};

const computeIncrement = (plan, ride, now) => {
    if (plan.type === 'ride_count')    return 1;
    if (plan.type === 'peak_rides')    return isInPeakHours(plan, now) ? 1 : 0;
    if (plan.type === 'earning_target') {
        // Drivers' net for THIS ride. Caller passes finalResult.driver.netEarnings
        // on ride.driver_earning so we don't have to recompute.
        return parseFloat(ride.driver_earning || ride.net_earnings || 0);
    }
    return 0;
};

// ─── Ride-completion hook ───────────────────────────────────────────────────
// Called from rideService after a ride is marked completed. Atomically:
//   1. Insert the ride into the per-plan ride log (idempotent).
//   2. If we just crossed the plan's target → credit wallet, write ledger,
//      record reward row (unique-constraint protected).
//
// Each plan runs in its own transaction so a failure on one plan doesn't
// block the others. Never throws into the ride flow.
export const onRideCompletion = async (driverId, driverUserId, vehicleType, ride) => {
    const rideId = ride?.id;
    if (!rideId || !driverId || !driverUserId) {
        logger.warn(`[Incentive] onRideCompletion missing args | driver=${driverId} ride=${rideId}`);
        return { processed: 0, credited: 0 };
    }

    let plans;
    try {
        plans = await incentiveRepo.findActivePlansForDriver(vehicleType);
    } catch (err) {
        logger.error(`[Incentive] plan lookup failed | driver=${driverId}:`, err.message);
        return { processed: 0, credited: 0 };
    }
    if (!plans.length) return { processed: 0, credited: 0 };

    const now = new Date();
    let processed = 0;
    let credited  = 0;

    for (const plan of plans) {
        const periodStart = getPeriodStart(plan.duration_type, now);
        const increment   = computeIncrement(plan, ride, now);
        if (increment <= 0) continue;

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const logged = await incentiveRepo.insertRideLog(
                client, driverId, plan.id, rideId, periodStart, increment
            );
            if (!logged) {
                // Same ride already counted for this plan (worker retry) — skip silently.
                await client.query('ROLLBACK');
                continue;
            }
            processed++;

            const totalSoFar = await incentiveRepo.sumProgressInPeriodTx(
                client, driverId, plan.id, periodStart
            );

            if (totalSoFar >= parseFloat(plan.target_value)) {
                const bonus = parseFloat(plan.bonus_amount);

                await creditWallet(client, driverUserId, bonus);

                const ledger = await insertLedgerEntry(client, {
                    driver_id:    driverId,
                    type:         'incentive',
                    amount:       bonus,
                    ride_id:      rideId,
                    reference_id: `plan:${plan.id}:${periodStart.toISOString().slice(0, 10)}`,
                    note:         `${plan.title} bonus`,
                });

                const reward = await incentiveRepo.insertReward(
                    client, driverId, plan.id, periodStart, bonus, ledger.id
                );

                if (!reward) {
                    // Concurrent tx beat us to it — roll back the wallet credit
                    // + ledger insert so we don't double-pay.
                    await client.query('ROLLBACK');
                    logger.info(`[Incentive] Reward already credited (race) | driver=${driverId} plan=${plan.id}`);
                    continue;
                }

                await client.query('COMMIT');
                credited++;
                logger.info(`[Incentive] Bonus credited | driver=${driverId} plan=${plan.id} (${plan.title}) ₹${bonus}`);
            } else {
                await client.query('COMMIT');
            }
        } catch (err) {
            await client.query('ROLLBACK');
            logger.error(`[Incentive] onRideCompletion error | driver=${driverId} plan=${plan.id}:`, err.message);
        } finally {
            client.release();
        }
    }

    return { processed, credited };
};

// ─── Driver-facing read API ─────────────────────────────────────────────────
// Returns the same payload shape the controller has always emitted, sourced
// from the new tables. Null = driver has no active plan (very rare now that
// a default plan exists).
export const getIncentiveProgress = async (userId) => {
    const driver = await driverRepo.findDriverByUserId(userId);
    if (!driver) throw new NotFoundError('Driver profile');

    const vehicle = await driverRepo.getVehicleByDriverId(driver.id);
    const vehicleType = vehicle?.vehicle_type || null;

    const plan = await incentiveRepo.findPrimaryPlanForDriver(vehicleType);
    if (!plan) return null;

    const periodStart = getPeriodStart(plan.duration_type, new Date());
    const [done, reward] = await Promise.all([
        incentiveRepo.sumProgressInPeriod(driver.id, plan.id, periodStart),
        incentiveRepo.findRewardForPeriod(driver.id, plan.id, periodStart),
    ]);

    const target = parseFloat(plan.target_value);
    const remaining   = Math.max(0, target - done);
    const percentDone = Math.min(100, Math.round((done / target) * 100));

    return {
        bonusAmount:     parseFloat(plan.bonus_amount),
        ridesCompleted:  Math.round(done),
        ridesNeeded:     Math.round(target),
        ridesRemaining:  Math.round(remaining),
        progress:        `${Math.round(done)}/${Math.round(target)}`,
        percentDone,
        planType:        plan.type,
        planTitle:       plan.title,
        isCompleted:     done >= target,
        isBonusCredited: !!reward,
        completedAt:     reward?.credited_at || null,
    };
};
