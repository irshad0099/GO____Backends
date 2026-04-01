import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Active incentive plans fetch (driver app pe dikhane ke liye) ────────────
export const findActiveIncentives = async (vehicleType) => {
    try {
        let query = `
            SELECT * FROM incentive_plans
            WHERE is_active = TRUE
              AND valid_until > NOW()
              AND valid_from <= NOW()
        `;
        const params = [];
        let idx = 1;

        if (vehicleType) {
            query += ` AND (vehicle_type = $${idx++} OR vehicle_type IS NULL)`;
            params.push(vehicleType);
        }

        query += ` ORDER BY bonus_amount DESC`;

        const { rows } = await db.query(query, params);
        return rows;
    } catch (error) {
        logger.error('Find active incentives repository error:', error);
        throw error;
    }
};

// ─── Driver ka progress ek specific incentive plan ke liye ──────────────────
export const findDriverProgress = async (driverId, incentivePlanId, periodStart) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM driver_incentive_progress
             WHERE driver_id = $1
               AND incentive_plan_id = $2
               AND period_start = $3`,
            [driverId, incentivePlanId, periodStart]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find driver incentive progress repository error:', error);
        throw error;
    }
};

// ─── Driver ke saare active incentive progress (with plan details) ──────────
export const findDriverAllProgress = async (driverId) => {
    try {
        const { rows } = await db.query(
            `SELECT dip.*, ip.title, ip.type, ip.target_value, ip.bonus_amount,
                    ip.duration_type, ip.vehicle_type, ip.valid_until,
                    ip.peak_start_hour, ip.peak_end_hour
             FROM driver_incentive_progress dip
             JOIN incentive_plans ip ON dip.incentive_plan_id = ip.id
             WHERE dip.driver_id = $1
               AND ip.is_active = TRUE
               AND ip.valid_until > NOW()
             ORDER BY dip.is_completed ASC, dip.created_at DESC`,
            [driverId]
        );
        return rows;
    } catch (error) {
        logger.error('Find driver all progress repository error:', error);
        throw error;
    }
};

// ─── Upsert progress (ride complete hone pe increment) ──────────────────────
export const upsertProgress = async (driverId, incentivePlanId, periodStart, periodEnd, incrementValue) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO driver_incentive_progress
             (driver_id, incentive_plan_id, current_value, period_start, period_end)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (driver_id, incentive_plan_id, period_start) DO UPDATE SET
                current_value = driver_incentive_progress.current_value + $3,
                updated_at = NOW()
             RETURNING *`,
            [driverId, incentivePlanId, incrementValue, periodStart, periodEnd]
        );
        return rows[0];
    } catch (error) {
        logger.error('Upsert incentive progress repository error:', error);
        throw error;
    }
};

// ─── Mark completed + bonus credited ────────────────────────────────────────
export const markCompleted = async (progressId) => {
    try {
        const { rows } = await db.query(
            `UPDATE driver_incentive_progress
             SET is_completed = TRUE, completed_at = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [progressId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Mark incentive completed repository error:', error);
        throw error;
    }
};

export const markBonusCredited = async (progressId) => {
    try {
        const { rows } = await db.query(
            `UPDATE driver_incentive_progress
             SET is_bonus_credited = TRUE, credited_at = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [progressId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Mark bonus credited repository error:', error);
        throw error;
    }
};

// ─── Pending bonus credits (cron job ke liye) ───────────────────────────────
export const findPendingBonusCredits = async () => {
    try {
        const { rows } = await db.query(
            `SELECT dip.*, ip.bonus_amount, ip.title,
                    d.user_id
             FROM driver_incentive_progress dip
             JOIN incentive_plans ip ON dip.incentive_plan_id = ip.id
             JOIN drivers d ON dip.driver_id = d.id
             WHERE dip.is_completed = TRUE
               AND dip.is_bonus_credited = FALSE`
        );
        return rows;
    } catch (error) {
        logger.error('Find pending bonus credits repository error:', error);
        throw error;
    }
};
