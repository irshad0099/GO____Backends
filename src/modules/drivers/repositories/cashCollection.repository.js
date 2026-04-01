import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Get driver's cash balance ──────────────────────────────────────────────
export const findCashBalance = async (driverId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM driver_cash_balance WHERE driver_id = $1`,
            [driverId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find cash balance repository error:', error);
        throw error;
    }
};

// ─── Initialize cash balance (pehli baar cash ride hone pe) ─────────────────
export const initCashBalance = async (driverId) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO driver_cash_balance (driver_id)
             VALUES ($1)
             ON CONFLICT (driver_id) DO NOTHING
             RETURNING *`,
            [driverId]
        );
        return rows[0] || await findCashBalance(driverId);
    } catch (error) {
        logger.error('Init cash balance repository error:', error);
        throw error;
    }
};

// ─── Add to pending (cash ride complete hone pe platform share add) ─────────
export const addToPending = async (client, driverId, platformShare, cashCollected) => {
    try {
        const { rows } = await (client || db).query(
            `UPDATE driver_cash_balance
             SET pending_amount = pending_amount + $2,
                 total_cash_collected = total_cash_collected + $3,
                 total_platform_share = total_platform_share + $2,
                 is_limit_exceeded = CASE
                    WHEN (pending_amount + $2) >= cash_limit THEN TRUE
                    ELSE is_limit_exceeded
                 END,
                 updated_at = NOW()
             WHERE driver_id = $1
             RETURNING *`,
            [driverId, platformShare, cashCollected]
        );
        return rows[0];
    } catch (error) {
        logger.error('Add to pending cash repository error:', error);
        throw error;
    }
};

// ─── Deduct from pending (deposit verified hone pe) ─────────────────────────
export const deductFromPending = async (client, driverId, amount) => {
    try {
        const { rows } = await (client || db).query(
            `UPDATE driver_cash_balance
             SET pending_amount = GREATEST(pending_amount - $2, 0),
                 total_deposited = total_deposited + $2,
                 is_limit_exceeded = CASE
                    WHEN (pending_amount - $2) < cash_limit THEN FALSE
                    ELSE is_limit_exceeded
                 END,
                 updated_at = NOW()
             WHERE driver_id = $1
             RETURNING *`,
            [driverId, amount]
        );
        return rows[0];
    } catch (error) {
        logger.error('Deduct from pending cash repository error:', error);
        throw error;
    }
};

// ─── Create deposit entry ───────────────────────────────────────────────────
export const insertDeposit = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO cash_deposits
             (driver_id, amount, deposit_method, reference_number, deposit_proof)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [data.driver_id, data.amount, data.deposit_method, data.reference_number || null, data.deposit_proof || null]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert cash deposit repository error:', error);
        throw error;
    }
};

// ─── Get deposit history ────────────────────────────────────────────────────
export const findDeposits = async (driverId, { limit = 20, offset = 0 }) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM cash_deposits
             WHERE driver_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [driverId, limit, offset]
        );
        return rows;
    } catch (error) {
        logger.error('Find deposits repository error:', error);
        throw error;
    }
};

// ─── Verify deposit (admin) ─────────────────────────────────────────────────
export const verifyDeposit = async (depositId, adminId, status, rejectionReason) => {
    try {
        const { rows } = await db.query(
            `UPDATE cash_deposits
             SET status = $3,
                 verified_by = $2,
                 verified_at = NOW(),
                 rejection_reason = $4,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [depositId, adminId, status, rejectionReason || null]
        );
        return rows[0];
    } catch (error) {
        logger.error('Verify deposit repository error:', error);
        throw error;
    }
};
