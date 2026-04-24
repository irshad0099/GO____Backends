import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const insertNotification = async ({ userId, type, title, body, rideId = null }) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO notifications (user_id, type, title, body, ride_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, type, title, body, rideId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert notification repository error:', error);
        throw error;
    }
};

export const findByUser = async (userId, { limit = 20, offset = 0 }) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        return rows;
    } catch (error) {
        logger.error('Find notifications repository error:', error);
        throw error;
    }
};

export const countUnread = async (userId) => {
    try {
        const { rows } = await db.query(
            `SELECT COUNT(*) AS count FROM notifications
             WHERE user_id = $1 AND is_read = FALSE`,
            [userId]
        );
        return parseInt(rows[0].count);
    } catch (error) {
        logger.error('Count unread notifications repository error:', error);
        throw error;
    }
};

export const markAsRead = async (notificationId, userId) => {
    try {
        const { rows } = await db.query(
            `UPDATE notifications SET is_read = TRUE
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [notificationId, userId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Mark notification read repository error:', error);
        throw error;
    }
};

export const markAllAsRead = async (userId) => {
    try {
        await db.query(
            `UPDATE notifications SET is_read = TRUE
             WHERE user_id = $1 AND is_read = FALSE`,
            [userId]
        );
    } catch (error) {
        logger.error('Mark all notifications read repository error:', error);
        throw error;
    }
};
