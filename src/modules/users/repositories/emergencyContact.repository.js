import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const findByUser = async (userId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM emergency_contacts WHERE user_id = $1 ORDER BY created_at`,
            [userId]
        );
        return rows;
    } catch (error) {
        logger.error('Find emergency contacts repository error:', error);
        throw error;
    }
};

export const countByUser = async (userId) => {
    try {
        const { rows } = await db.query(
            `SELECT COUNT(*) AS count FROM emergency_contacts WHERE user_id = $1`,
            [userId]
        );
        return parseInt(rows[0].count);
    } catch (error) {
        logger.error('Count emergency contacts repository error:', error);
        throw error;
    }
};

export const insert = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO emergency_contacts (user_id, name, phone, relationship)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [data.user_id, data.name, data.phone, data.relationship || null]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert emergency contact repository error:', error);
        throw error;
    }
};

export const update = async (id, userId, data) => {
    try {
        const { rows } = await db.query(
            `UPDATE emergency_contacts
             SET name = COALESCE($3, name),
                 phone = COALESCE($4, phone),
                 relationship = COALESCE($5, relationship),
                 updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [id, userId, data.name, data.phone, data.relationship]
        );
        return rows[0];
    } catch (error) {
        logger.error('Update emergency contact repository error:', error);
        throw error;
    }
};

export const remove = async (id, userId) => {
    try {
        const { rowCount } = await db.query(
            `DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );
        return rowCount > 0;
    } catch (error) {
        logger.error('Delete emergency contact repository error:', error);
        throw error;
    }
};
