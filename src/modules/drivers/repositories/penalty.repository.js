import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Driver ki saari penalties (paginated) ──────────────────────────────────
export const findPenaltiesByDriver = async (driverId, { limit = 20, offset = 0 }) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM driver_penalties
             WHERE driver_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [driverId, limit, offset]
        );
        return rows;
    } catch (error) {
        logger.error('Find penalties by driver repository error:', error);
        throw error;
    }
};

export const countPenaltiesByDriver = async (driverId) => {
    try {
        const { rows } = await db.query(
            `SELECT COUNT(*) as total FROM driver_penalties WHERE driver_id = $1`,
            [driverId]
        );
        return parseInt(rows[0].total);
    } catch (error) {
        logger.error('Count penalties by driver repository error:', error);
        throw error;
    }
};

// ─── Penalty Summary (cached aggregate) ─────────────────────────────────────
export const findPenaltySummary = async (driverId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM driver_penalty_summary WHERE driver_id = $1`,
            [driverId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find penalty summary repository error:', error);
        throw error;
    }
};

// ─── Insert new penalty ─────────────────────────────────────────────────────
export const insertPenalty = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO driver_penalties
             (driver_id, offense_type, penalty_type, fine_amount, ban_until,
              points, description, ride_id, issued_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                data.driver_id, data.offense_type, data.penalty_type,
                data.fine_amount || 0, data.ban_until || null,
                data.points || 0, data.description,
                data.ride_id || null, data.issued_by || null
            ]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert penalty repository error:', error);
        throw error;
    }
};

// ─── Upsert penalty summary ─────────────────────────────────────────────────
export const upsertPenaltySummary = async (driverId, penaltyType, fineAmount, points, banUntil) => {
    try {
        const incrementColumns = {
            warning: 'total_warnings',
            fine: 'total_fines',
            temporary_ban: 'total_bans',
            permanent_ban: 'total_bans'
        };
        const col = incrementColumns[penaltyType] || 'total_warnings';

        const { rows } = await db.query(
            `INSERT INTO driver_penalty_summary
             (driver_id, total_points, ${col}, total_fine_amount, is_banned, ban_until)
             VALUES ($1, $2, 1, $3, $4, $5)
             ON CONFLICT (driver_id) DO UPDATE SET
                total_points = driver_penalty_summary.total_points + $2,
                ${col} = driver_penalty_summary.${col} + 1,
                total_fine_amount = driver_penalty_summary.total_fine_amount + $3,
                is_banned = CASE WHEN $4 THEN TRUE ELSE driver_penalty_summary.is_banned END,
                ban_until = CASE WHEN $5 IS NOT NULL THEN $5 ELSE driver_penalty_summary.ban_until END,
                ban_reason = CASE WHEN $4 THEN $6 ELSE driver_penalty_summary.ban_reason END,
                updated_at = NOW()
             RETURNING *`,
            [
                driverId, points, fineAmount || 0,
                penaltyType === 'temporary_ban' || penaltyType === 'permanent_ban',
                banUntil || null,
                penaltyType === 'permanent_ban' ? 'Permanent ban' : null
            ]
        );
        return rows[0];
    } catch (error) {
        logger.error('Upsert penalty summary repository error:', error);
        throw error;
    }
};

// ─── Acknowledge penalty (driver ne dekha) ──────────────────────────────────
export const acknowledgePenalty = async (penaltyId, driverId) => {
    try {
        const { rows } = await db.query(
            `UPDATE driver_penalties
             SET is_acknowledged = TRUE, acknowledged_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND driver_id = $2
             RETURNING *`,
            [penaltyId, driverId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Acknowledge penalty repository error:', error);
        throw error;
    }
};

// ─── Appeal penalty ─────────────────────────────────────────────────────────
export const appealPenalty = async (penaltyId, driverId, reason) => {
    try {
        const { rows } = await db.query(
            `UPDATE driver_penalties
             SET is_appealed = TRUE, appeal_reason = $3, appeal_status = 'pending', updated_at = NOW()
             WHERE id = $1 AND driver_id = $2
             RETURNING *`,
            [penaltyId, driverId, reason]
        );
        return rows[0];
    } catch (error) {
        logger.error('Appeal penalty repository error:', error);
        throw error;
    }
};

// ─── Check if driver is banned ──────────────────────────────────────────────
export const isDriverBanned = async (driverId) => {
    try {
        const { rows } = await db.query(
            `SELECT is_banned, ban_until, ban_reason
             FROM driver_penalty_summary
             WHERE driver_id = $1`,
            [driverId]
        );
        if (!rows[0]) return { isBanned: false };

        const summary = rows[0];
        // Auto-unban: temporary ban expire ho gaya to unban
        if (summary.is_banned && summary.ban_until && new Date(summary.ban_until) < new Date()) {
            await db.query(
                `UPDATE driver_penalty_summary SET is_banned = FALSE, ban_until = NULL, ban_reason = NULL, updated_at = NOW() WHERE driver_id = $1`,
                [driverId]
            );
            return { isBanned: false };
        }

        return {
            isBanned: summary.is_banned,
            banUntil: summary.ban_until,
            banReason: summary.ban_reason
        };
    } catch (error) {
        logger.error('Check driver banned repository error:', error);
        throw error;
    }
};

// ─── Acceptance rate (last 7 days) ──────────────────────────────────────────
export const getAcceptanceRate = async (driverId) => {
    try {
        const { rows } = await db.query(
            `SELECT
                (SELECT COUNT(*) FROM rides WHERE driver_id = $1 AND requested_at >= NOW() - INTERVAL '7 days') AS accepted,
                (SELECT COUNT(*) FROM ride_rejections WHERE driver_id = $1 AND rejected_at >= NOW() - INTERVAL '7 days') AS rejected`,
            [driverId]
        );
        const { accepted, rejected } = rows[0];
        const total = parseInt(accepted) + parseInt(rejected);
        if (total === 0) return 100;
        return Math.round((parseInt(accepted) / total) * 100);
    } catch (error) {
        logger.error('Get acceptance rate repository error:', error);
        throw error;
    }
};
