import * as incentiveRepo from '../repositories/incentive.repository.js';
import * as driverRepo from '../repositories/driver.repository.js';
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
