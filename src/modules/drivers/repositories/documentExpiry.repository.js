import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Driver ke saare document expiry status ─────────────────────────────────
export const findAllByDriver = async (driverId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM driver_document_expiry
             WHERE driver_id = $1
             ORDER BY
                CASE status
                    WHEN 'expired' THEN 1
                    WHEN 'expiring_soon' THEN 2
                    WHEN 'not_uploaded' THEN 3
                    WHEN 'rejected' THEN 4
                    WHEN 'valid' THEN 5
                END`,
            [driverId]
        );
        return rows;
    } catch (error) {
        logger.error('Find all document expiry repository error:', error);
        throw error;
    }
};

// ─── Upsert document expiry (KYC upload hone pe update) ─────────────────────
export const upsertExpiry = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO driver_document_expiry
             (driver_id, document_type, document_number, expiry_date, status, last_verified_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (driver_id, document_type) DO UPDATE SET
                document_number = EXCLUDED.document_number,
                expiry_date = EXCLUDED.expiry_date,
                status = EXCLUDED.status,
                last_verified_at = NOW(),
                expiry_notified = FALSE,
                updated_at = NOW()
             RETURNING *`,
            [data.driver_id, data.document_type, data.document_number || null, data.expiry_date || null, data.status]
        );
        return rows[0];
    } catch (error) {
        logger.error('Upsert document expiry repository error:', error);
        throw error;
    }
};

// ─── Expiring soon wale documents (cron: next 30 days mein expire) ──────────
export const findExpiringSoon = async (daysAhead = 30) => {
    try {
        const { rows } = await db.query(
            `SELECT de.*, d.user_id, u.full_name, u.phone_number
             FROM driver_document_expiry de
             JOIN drivers d ON de.driver_id = d.id
             JOIN users u ON d.user_id = u.id
             WHERE de.expiry_date IS NOT NULL
               AND de.expiry_date <= CURRENT_DATE + INTERVAL '1 day' * $1
               AND de.expiry_date > CURRENT_DATE
               AND de.status = 'valid'
               AND de.expiry_notified = FALSE`,
            [daysAhead]
        );
        return rows;
    } catch (error) {
        logger.error('Find expiring soon repository error:', error);
        throw error;
    }
};

// ─── Expired documents (cron: status update karo) ───────────────────────────
export const markExpired = async () => {
    try {
        const { rows } = await db.query(
            `UPDATE driver_document_expiry
             SET status = 'expired', updated_at = NOW()
             WHERE expiry_date IS NOT NULL
               AND expiry_date < CURRENT_DATE
               AND status IN ('valid', 'expiring_soon')
             RETURNING driver_id, document_type`
        );
        return rows;
    } catch (error) {
        logger.error('Mark expired documents repository error:', error);
        throw error;
    }
};

// ─── Mark as expiring soon ──────────────────────────────────────────────────
export const markExpiringSoon = async (daysAhead = 30) => {
    try {
        const { rows } = await db.query(
            `UPDATE driver_document_expiry
             SET status = 'expiring_soon', updated_at = NOW()
             WHERE expiry_date IS NOT NULL
               AND expiry_date <= CURRENT_DATE + INTERVAL '1 day' * $1
               AND expiry_date > CURRENT_DATE
               AND status = 'valid'
             RETURNING driver_id, document_type`,
            [daysAhead]
        );
        return rows;
    } catch (error) {
        logger.error('Mark expiring soon repository error:', error);
        throw error;
    }
};

// ─── Mark notified (duplicate notification prevent) ─────────────────────────
export const markNotified = async (driverId, documentType) => {
    try {
        await db.query(
            `UPDATE driver_document_expiry
             SET expiry_notified = TRUE, notified_at = NOW()
             WHERE driver_id = $1 AND document_type = $2`,
            [driverId, documentType]
        );
    } catch (error) {
        logger.error('Mark notified repository error:', error);
        throw error;
    }
};
