import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const createSession = async ({ userId, accessToken, ipAddress, userAgent, deviceId, deviceType }) => {
    try {
        // Calculate expiry (7 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const result = await db.query(
            `INSERT INTO sessions 
             (user_id, access_token, ip_address, user_agent, device_id, device_type, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, user_id, created_at`,
            [userId, accessToken, ipAddress, userAgent, deviceId, deviceType, expiresAt]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Create session repository error:', error);
        throw error;
    }
};

export const findSession = async (accessToken) => {
    try {
        const result = await db.query(
            `SELECT s.*, u.is_active 
             FROM sessions s
             JOIN users u ON s.user_id = u.id
             WHERE s.access_token = $1 AND s.expires_at > NOW() AND s.is_revoked = false`,
            [accessToken]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Find session repository error:', error);
        throw error;
    }
};

export const findSessionsByUserId = async (userId) => {
    try {
        const result = await db.query(
            `SELECT * FROM sessions 
             WHERE user_id = $1 AND expires_at > NOW() AND is_revoked = false
             ORDER BY created_at DESC`,
            [userId]
        );

        return result.rows;
    } catch (error) {
        logger.error('Find sessions by user ID repository error:', error);
        throw error;
    }
};

export const deleteSession = async (accessToken) => {
    try {
        await db.query(
            `DELETE FROM sessions WHERE access_token = $1`,
            [accessToken]
        );
    } catch (error) {
        logger.error('Delete session repository error:', error);
        throw error;
    }
};

export const revokeSession = async (accessToken) => {
    try {
        await db.query(
            `UPDATE sessions 
             SET is_revoked = true, updated_at = NOW()
             WHERE access_token = $1`,
            [accessToken]
        );
    } catch (error) {
        logger.error('Revoke session repository error:', error);
        throw error;
    }
};

export const updateSessionToken = async (oldAccessToken, newAccessToken) => {
    try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await db.query(
            `UPDATE sessions 
             SET access_token = $1, expires_at = $2, updated_at = NOW()
             WHERE access_token = $3 AND is_revoked = false`,
            [newAccessToken, expiresAt, oldAccessToken]
        );
    } catch (error) {
        logger.error('Update session token repository error:', error);
        throw error;
    }
};

export const revokeAllUserSessions = async (userId) => {
    try {
        await db.query(
            `UPDATE sessions 
             SET is_revoked = true, updated_at = NOW()
             WHERE user_id = $1 AND is_revoked = false`,
            [userId]
        );
    } catch (error) {
        logger.error('Revoke all user sessions repository error:', error);
        throw error;
    }
};

export const cleanupExpiredSessions = async () => {
    try {
        const result = await db.query(
            `DELETE FROM sessions WHERE expires_at <= NOW()`
        );

        logger.info(`Cleaned up ${result.rowCount} expired sessions`);
        return result.rowCount;
    } catch (error) {
        logger.error('Cleanup expired sessions repository error:', error);
        throw error;
    }
};