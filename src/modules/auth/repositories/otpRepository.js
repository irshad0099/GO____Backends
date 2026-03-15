import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const saveOTP = async ({ phoneNumber, otpCode, purpose, expiresAt }) => {
    try {
        // Delete old OTPs for this phone and purpose
        await db.query(
            `DELETE FROM otps 
             WHERE phone_number = $1 AND purpose = $2`,
            [phoneNumber, purpose]
        );

        // Insert new OTP
        const result = await db.query(
            `INSERT INTO otps (phone_number, otp_code, purpose, expires_at)
             VALUES ($1, $2, $3, $4)
             RETURNING id, phone_number, created_at`,
            [phoneNumber, otpCode, purpose, expiresAt]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Save OTP repository error:', error);
        throw error;
    }
};

export const getValidOTP = async (phoneNumber, purpose) => {
    try {
        const result = await db.query(
            `SELECT * FROM otps 
             WHERE phone_number = $1 
               AND purpose = $2 
               AND is_used = false 
               AND expires_at > NOW()
             ORDER BY created_at DESC 
             LIMIT 1`,
            [phoneNumber, purpose]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Get valid OTP repository error:', error);
        throw error;
    }
};

export const getOTP = async (phoneNumber) => {
    try {
        const result = await db.query(
            `SELECT * FROM otps 
             WHERE phone_number = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [phoneNumber]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Get OTP repository error:', error);
        throw error;
    }
};

export const incrementAttempts = async (id) => {
    try {
        await db.query(
            `UPDATE otps 
             SET attempts = attempts + 1, updated_at = NOW()
             WHERE id = $1`,
            [id]
        );
    } catch (error) {
        logger.error('Increment attempts repository error:', error);
        throw error;
    }
};

export const markOTPAsUsed = async (id) => {
    try {
        await db.query(
            `UPDATE otps 
             SET is_used = true, updated_at = NOW()
             WHERE id = $1`,
            [id]
        );
    } catch (error) {
        logger.error('Mark OTP as used repository error:', error);
        throw error;
    }
};

export const deleteOTP = async (phoneNumber, purpose) => {
    try {
        await db.query(
            `DELETE FROM otps 
             WHERE phone_number = $1 AND purpose = $2`,
            [phoneNumber, purpose]
        );
    } catch (error) {
        logger.error('Delete OTP repository error:', error);
        throw error;
    }
};