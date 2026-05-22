import * as incentiveRepo from '../repositories/incentive.repository.js';
import * as driverRepo from '../repositories/driver.repository.js';
import * as earningsRepo from '../repositories/earnings.repository.js';
import { creditWallet } from '../../wallet/repositories/wallet.repository.js';
import { pool } from '../../../infrastructure/database/postgres.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

// ─── Active incentive plans list (driver app pe dikhane ke liye) ─────────────
export const getActiveIncentives = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        // Driver ki vehicle type ke hisab se filter
        const vehicle = await driverRepo.getVehicleByDriverId(driver.id);
        const vehicleType = vehicle?.vehicle_type || null;

        const plans = await incentiveRepo.findActiveIncentives(vehicleType);

        // Har plan ke saath driver ka progress bhi bhejo
        const progress = await incentiveRepo.findDriverAllProgress(driver.id);
        const progressMap = {};
        progress.forEach(p => { progressMap[p.incentive_plan_id] = p; });

        return plans.map(plan => ({
            id: plan.id,
            title: plan.title,
            description: plan.description,
            type: plan.type,
            targetValue: parseFloat(plan.target_value),
            bonusAmount: parseFloat(plan.bonus_amount),
            vehicleType: plan.vehicle_type,
            durationType: plan.duration_type,
            validUntil: plan.valid_until,
            peakHours: plan.peak_start_hour != null ? {
                start: plan.peak_start_hour,
                end: plan.peak_end_hour
            } : null,
            progress: progressMap[plan.id] ? {
                currentValue: parseFloat(progressMap[plan.id].current_value),
                isCompleted: progressMap[plan.id].is_completed,
                isBonusCredited: progressMap[plan.id].is_bonus_credited,
                percentDone: Math.min(
                    100,
                    Math.round((parseFloat(progressMap[plan.id].current_value) / parseFloat(plan.target_value)) * 100)
                )
            } : {
                currentValue: 0,
                isCompleted: false,
                isBonusCredited: false,
                percentDone: 0
            }
        }));
    } catch (error) {
        logger.error('Get active incentives service error:', error);
        throw error;
    }
};

// ─── Credit pending incentive bonuses (IDEMPOTENT - safe to call multiple times) ────
export const creditPendingIncentives = async (driverId) => {
    const client = await pool.connect();
    try {
        // Find completed but uncredited incentives for this driver
        const { rows: pending } = await client.query(
            `SELECT dip.id, dip.ride_id, dip.incentive_plan_id, ip.bonus_amount, ip.title, d.user_id
             FROM driver_incentive_progress dip
             JOIN incentive_plans ip ON dip.incentive_plan_id = ip.id
             JOIN drivers d ON dip.driver_id = d.id
             WHERE dip.driver_id = $1
               AND dip.is_completed = TRUE
               AND dip.is_bonus_credited = FALSE`,
            [driverId]
        );

        if (pending.length === 0) return { credited: 0 };

        await client.query('BEGIN');

        let totalCredited = 0;
        let creditedCount = 0;

        for (const incentive of pending) {
            const bonusAmount = parseFloat(incentive.bonus_amount);

            // IDEMPOTENCY CHECK: Already credited for this (driver, plan, ride)?
            const alreadyCredited = await client.query(
                `SELECT id FROM driver_ledger
                 WHERE driver_id = $1 AND type = 'incentive'
                   AND reference_id = $2 AND ride_id = $3`,
                [driverId, String(incentive.incentive_plan_id), incentive.ride_id]
            );

            if (alreadyCredited.rows.length > 0) {
                // Already credited - just mark as credited and skip
                await incentiveRepo.markBonusCredited(incentive.id);
                logger.warn(`[Incentive] Already credited (skipped duplicate) | Driver: ${driverId} | Plan: ${incentive.incentive_plan_id} | Ride: ${incentive.ride_id}`);
                continue;
            }

            // Credit wallet
            await creditWallet(client, incentive.user_id, bonusAmount);

            // Insert ledger entry
            await earningsRepo.insertLedgerEntry(client, {
                driver_id:   driverId,
                type:        'incentive',
                amount:      bonusAmount,
                reference_id: String(incentive.incentive_plan_id),
                ride_id:     incentive.ride_id,
                note:        incentive.title,
            });

            // ── Transaction table entry (user-facing) ────────────────────────────
            try {
                const walletRecord = await client.query(
                    `SELECT id FROM wallets WHERE user_id = $1`,
                    [incentive.user_id]
                );
                const walletId = walletRecord.rows[0]?.id;

                await client.query(
                    `INSERT INTO transactions (
                        transaction_number, user_id, wallet_id, ride_id,
                        amount, type, category,
                        status, description,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [
                        `INCENTIVE-${incentive.incentive_plan_id}-${Date.now()}`,
                        incentive.user_id,
                        walletId,
                        incentive.ride_id || null,
                        bonusAmount,
                        'credit',
                        'incentive_bonus',
                        'success',
                        `${incentive.title} bonus`
                    ]
                );
            } catch (txnErr) {
                logger.warn(`[Incentive] Transaction entry failed (non-fatal) | Driver: ${driverId} | Plan: ${incentive.incentive_plan_id}: ${txnErr.message}`);
            }

            // Mark as credited
            await incentiveRepo.markBonusCredited(incentive.id);

            totalCredited += bonusAmount;
            creditedCount++;
            logger.info(`[Incentive] Bonus credited | Driver: ${driverId} | Plan: ${incentive.incentive_plan_id} | Ride: ${incentive.ride_id} | Amount: ₹${bonusAmount}`);
        }

        await client.query('COMMIT');
        return { credited: totalCredited, count: creditedCount };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`[Incentive] creditPendingIncentives error | Driver: ${driverId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

// ─── Driver ka incentive progress detail ────────────────────────────────────
export const getIncentiveProgress = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const progress = await incentiveRepo.findDriverAllProgress(driver.id);

        return progress.map(p => ({
            planTitle: p.title,
            planType: p.type,
            targetValue: parseFloat(p.target_value),
            bonusAmount: parseFloat(p.bonus_amount),
            currentValue: parseFloat(p.current_value),
            isCompleted: p.is_completed,
            isBonusCredited: p.is_bonus_credited,
            completedAt: p.completed_at,
            periodStart: p.period_start,
            periodEnd: p.period_end,
            percentDone: Math.min(
                100,
                Math.round((parseFloat(p.current_value) / parseFloat(p.target_value)) * 100)
            )
        }));
    } catch (error) {
        logger.error('Get incentive progress service error:', error);
        throw error;
    }
};

// ─── Update incentive progress on ride completion ────────────────────────────
export const updateIncentiveProgressOnRideCompletion = async (driverId, vehicleType, rideData) => {
    try {
        // Get active plans for driver's vehicle type only
        const activePlans = await incentiveRepo.findActiveIncentives(vehicleType);

        if (activePlans.length === 0) return { updated: 0 };

        const today = new Date();
        const rideId = rideData.id || rideData.rideId; // Extract ride ID
        let updatedCount = 0;

        for (const plan of activePlans) {
            let incrementValue = 0;
            const periodStart = getPeriodStart(plan.duration_type, today);
            const periodEnd = getPeriodEnd(plan.duration_type, today);

            // Plan type ke hisaab se increment
            if (plan.type === 'ride_count') {
                incrementValue = 1; // 1 ride ka credit
            } else if (plan.type === 'earning_target') {
                incrementValue = rideData.netEarnings || 0; // Earnings add karo
            } else if (plan.type === 'peak_rides') {
                const rideHour = today.getHours();
                if (rideHour >= plan.peak_start_hour && rideHour <= plan.peak_end_hour) {
                    incrementValue = 1; // Peak hour ride
                } else {
                    continue; // Skip if not peak hour
                }
            } else if (plan.type === 'acceptance_rate') {
                continue; // Acceptance rate is tracked separately
            }

            if (incrementValue <= 0) continue;

            // Upsert progress with rideId for idempotency
            const progress = await incentiveRepo.upsertProgress(
                driverId,
                plan.id,
                periodStart,
                periodEnd,
                incrementValue,
                rideId
            );

            // Check if completed
            if (parseFloat(progress.current_value) >= parseFloat(plan.target_value)) {
                await incentiveRepo.markCompleted(progress.id);
                updatedCount++;

                logger.info(`[Incentive] Completed | Driver: ${driverId} | Plan: ${plan.id} (${plan.title}) | Progress: ${progress.current_value}/${plan.target_value}`);
            }
        }

        return { updated: updatedCount };
    } catch (error) {
        logger.error('Update incentive progress on ride completion error:', error);
        throw error;
    }
};

// Helper: Get period start date based on duration type
const getPeriodStart = (durationType, date) => {
    const d = new Date(date);
    if (durationType === 'daily') {
        d.setHours(0, 0, 0, 0);
    } else if (durationType === 'weekly') {
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
    } else if (durationType === 'monthly') {
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
    }
    return d;
};

// Helper: Get period end date based on duration type
const getPeriodEnd = (durationType, date) => {
    const d = new Date(date);
    if (durationType === 'daily') {
        d.setHours(23, 59, 59, 999);
    } else if (durationType === 'weekly') {
        d.setDate(d.getDate() + (6 - d.getDay()));
        d.setHours(23, 59, 59, 999);
    } else if (durationType === 'monthly') {
        d.setMonth(d.getMonth() + 1);
        d.setDate(0);
        d.setHours(23, 59, 59, 999);
    }
    return d;
};
