import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const insert = async (rideId, otpCode, expiresAt) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO ride_otps (ride_id, otp_code, expires_at)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [rideId, otpCode, expiresAt]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert ride OTP repository error:', error);
        throw error;
    }
};

export const findLatest = async (rideId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM ride_otps
             WHERE ride_id = $1 AND is_verified = FALSE AND expires_at > NOW()
             ORDER BY created_at DESC
             LIMIT 1`,
            [rideId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find latest ride OTP repository error:', error);
        throw error;
    }
};

export const verify = async (rideId, otpCode) => {
    try {
        // Pehle latest active OTP dhundho
        const otp = await findLatest(rideId);
        if (!otp) return { success: false, reason: 'no_active_otp' };

        if (otp.attempts >= otp.max_attempts) {
            return { success: false, reason: 'max_attempts_exceeded' };
        }

        if (otp.otp_code !== otpCode) {
            // Increment attempts
            await db.query(
                `UPDATE ride_otps SET attempts = attempts + 1 WHERE id = $1`,
                [otp.id]
            );
            return { success: false, reason: 'invalid_otp', attemptsLeft: otp.max_attempts - otp.attempts - 1 };
        }

        // OTP match! Mark verified
        const { rows } = await db.query(
            `UPDATE ride_otps
             SET is_verified = TRUE, verified_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [otp.id]
        );
        return { success: true, data: rows[0] };
    } catch (error) {
        logger.error('Verify ride OTP repository error:', error);
        throw error;
    }
};
