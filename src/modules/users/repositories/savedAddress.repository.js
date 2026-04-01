import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const findByUser = async (userId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM saved_addresses
             WHERE user_id = $1
             ORDER BY
                CASE type WHEN 'home' THEN 1 WHEN 'work' THEN 2 ELSE 3 END,
                created_at DESC`,
            [userId]
        );
        return rows;
    } catch (error) {
        logger.error('Find saved addresses repository error:', error);
        throw error;
    }
};

export const findById = async (id, userId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM saved_addresses WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find saved address by id repository error:', error);
        throw error;
    }
};

export const insert = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO saved_addresses
             (user_id, label, type, latitude, longitude, address, landmark, place_id, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (user_id, type, label) DO UPDATE SET
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                address = EXCLUDED.address,
                landmark = EXCLUDED.landmark,
                place_id = EXCLUDED.place_id,
                updated_at = NOW()
             RETURNING *`,
            [data.user_id, data.label, data.type, data.latitude, data.longitude,
             data.address, data.landmark || null, data.place_id || null, data.is_default || false]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert saved address repository error:', error);
        throw error;
    }
};

export const update = async (id, userId, data) => {
    try {
        const fields = [];
        const values = [];
        let idx = 1;

        for (const [key, val] of Object.entries(data)) {
            if (val !== undefined) {
                fields.push(`${key} = $${idx++}`);
                values.push(val);
            }
        }
        if (fields.length === 0) return await findById(id, userId);

        values.push(id, userId);
        const { rows } = await db.query(
            `UPDATE saved_addresses
             SET ${fields.join(', ')}, updated_at = NOW()
             WHERE id = $${idx++} AND user_id = $${idx}
             RETURNING *`,
            values
        );
        return rows[0];
    } catch (error) {
        logger.error('Update saved address repository error:', error);
        throw error;
    }
};

export const remove = async (id, userId) => {
    try {
        const { rowCount } = await db.query(
            `DELETE FROM saved_addresses WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );
        return rowCount > 0;
    } catch (error) {
        logger.error('Delete saved address repository error:', error);
        throw error;
    }
};
