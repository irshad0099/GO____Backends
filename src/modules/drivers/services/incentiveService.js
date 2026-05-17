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

// ─── Credit pending incentive bonuses (called after each ride completion) ────
export const creditPendingIncentives = async (driverId) => {
    const client = await pool.connect();
    try {
        // Find completed but uncredited incentives for this driver
        const { rows: pending } = await client.query(
            `SELECT dip.id, dip.incentive_plan_id, ip.bonus_amount, ip.title, d.user_id
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
        for (const incentive of pending) {
            const bonusAmount = parseFloat(incentive.bonus_amount);

            await creditWallet(client, incentive.user_id, bonusAmount);

            await earningsRepo.insertLedgerEntry(client, {
                driver_id:   driverId,
                type:        'incentive',
                amount:      bonusAmount,
                reference_id: String(incentive.incentive_plan_id),
                note:        incentive.title,
            });

            await incentiveRepo.markBonusCredited(incentive.id);

            totalCredited += bonusAmount;
            logger.info(`[Incentive] Bonus credited | Driver: ${driverId} | Plan: ${incentive.incentive_plan_id} | Amount: ₹${bonusAmount}`);
        }

        await client.query('COMMIT');
        return { credited: totalCredited, count: pending.length };
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
