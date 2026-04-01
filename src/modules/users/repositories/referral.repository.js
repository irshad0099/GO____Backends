import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Referral code CRUD ─────────────────────────────────────────────────────
export const findCodeByUser = async (userId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM referral_codes WHERE user_id = $1`,
            [userId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find referral code repository error:', error);
        throw error;
    }
};

export const findByCode = async (code) => {
    try {
        const { rows } = await db.query(
            `SELECT rc.*, u.full_name, u.phone_number
             FROM referral_codes rc
             JOIN users u ON rc.user_id = u.id
             WHERE rc.code = $1 AND rc.is_active = TRUE`,
            [code]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find by referral code repository error:', error);
        throw error;
    }
};

export const insertCode = async (userId, code) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO referral_codes (user_id, code)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO NOTHING
             RETURNING *`,
            [userId, code]
        );
        return rows[0] || await findCodeByUser(userId);
    } catch (error) {
        logger.error('Insert referral code repository error:', error);
        throw error;
    }
};

// ─── Referral tracking ──────────────────────────────────────────────────────
export const findReferralByReferred = async (referredId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM referrals WHERE referred_id = $1`,
            [referredId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find referral by referred repository error:', error);
        throw error;
    }
};

export const insertReferral = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO referrals
             (referrer_id, referred_id, referral_code, referrer_bonus, referred_bonus, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [data.referrer_id, data.referred_id, data.referral_code,
             data.referrer_bonus, data.referred_bonus, data.expires_at]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert referral repository error:', error);
        throw error;
    }
};

export const completeReferral = async (referredId) => {
    try {
        const { rows } = await db.query(
            `UPDATE referrals
             SET status = 'completed', completed_at = NOW()
             WHERE referred_id = $1 AND status = 'pending'
             RETURNING *`,
            [referredId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Complete referral repository error:', error);
        throw error;
    }
};

export const findReferralsByReferrer = async (referrerId) => {
    try {
        const { rows } = await db.query(
            `SELECT r.*, u.full_name AS referred_name, u.phone_number AS referred_phone
             FROM referrals r
             JOIN users u ON r.referred_id = u.id
             WHERE r.referrer_id = $1
             ORDER BY r.created_at DESC`,
            [referrerId]
        );
        return rows;
    } catch (error) {
        logger.error('Find referrals by referrer repository error:', error);
        throw error;
    }
};

export const incrementReferralCount = async (userId, bonusAmount) => {
    try {
        await db.query(
            `UPDATE referral_codes
             SET total_referrals = total_referrals + 1,
                 total_earned = total_earned + $2
             WHERE user_id = $1`,
            [userId, bonusAmount]
        );
    } catch (error) {
        logger.error('Increment referral count repository error:', error);
        throw error;
    }
};
