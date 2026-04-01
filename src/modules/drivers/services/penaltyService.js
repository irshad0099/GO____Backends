import * as penaltyRepo from '../repositories/penalty.repository.js';
import * as driverRepo from '../repositories/driver.repository.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

// ─── Driver ki penalties list ───────────────────────────────────────────────
export const getMyPenalties = async (userId, { limit = 20, offset = 0 }) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const [penalties, total, summary] = await Promise.all([
            penaltyRepo.findPenaltiesByDriver(driver.id, { limit, offset }),
            penaltyRepo.countPenaltiesByDriver(driver.id),
            penaltyRepo.findPenaltySummary(driver.id)
        ]);

        return {
            summary: summary ? {
                totalPoints: summary.total_points,
                totalWarnings: summary.total_warnings,
                totalFines: summary.total_fines,
                totalFineAmount: parseFloat(summary.total_fine_amount),
                totalBans: summary.total_bans,
                isBanned: summary.is_banned,
                banUntil: summary.ban_until
            } : {
                totalPoints: 0, totalWarnings: 0, totalFines: 0,
                totalFineAmount: 0, totalBans: 0, isBanned: false, banUntil: null
            },
            penalties: penalties.map(p => ({
                id: p.id,
                offenseType: p.offense_type,
                penaltyType: p.penalty_type,
                fineAmount: parseFloat(p.fine_amount),
                points: p.points,
                description: p.description,
                rideId: p.ride_id,
                isAcknowledged: p.is_acknowledged,
                isAppealed: p.is_appealed,
                appealStatus: p.appeal_status,
                createdAt: p.created_at
            })),
            pagination: { limit, offset, total }
        };
    } catch (error) {
        logger.error('Get my penalties service error:', error);
        throw error;
    }
};

// ─── Acknowledge penalty ────────────────────────────────────────────────────
export const acknowledgePenalty = async (userId, penaltyId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const result = await penaltyRepo.acknowledgePenalty(penaltyId, driver.id);
        if (!result) throw new NotFoundError('Penalty');

        return { acknowledged: true, penaltyId: result.id };
    } catch (error) {
        logger.error('Acknowledge penalty service error:', error);
        throw error;
    }
};

// ─── Appeal penalty ─────────────────────────────────────────────────────────
export const appealPenalty = async (userId, penaltyId, reason) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        const result = await penaltyRepo.appealPenalty(penaltyId, driver.id, reason);
        if (!result) throw new NotFoundError('Penalty');

        return {
            penaltyId: result.id,
            appealStatus: result.appeal_status,
            appealReason: result.appeal_reason
        };
    } catch (error) {
        logger.error('Appeal penalty service error:', error);
        throw error;
    }
};

// ─── Acceptance rate ────────────────────────────────────────────────────────
export const getAcceptanceRate = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        return await penaltyRepo.getAcceptanceRate(driver.id);
    } catch (error) {
        logger.error('Get acceptance rate service error:', error);
        throw error;
    }
};

// ─── Check ban status ───────────────────────────────────────────────────────
export const checkBanStatus = async (userId) => {
    try {
        const driver = await driverRepo.findDriverByUserId(userId);
        if (!driver) throw new NotFoundError('Driver profile');

        return await penaltyRepo.isDriverBanned(driver.id);
    } catch (error) {
        logger.error('Check ban status service error:', error);
        throw error;
    }
};
