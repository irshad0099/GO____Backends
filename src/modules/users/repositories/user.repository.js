import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const findUserByPhone = async (phone) => {
    try {
        const result = await db.query(
            `SELECT id, phone_number, email, full_name, profile_picture, 
                    role, is_verified, is_active, last_login, created_at, updated_at
             FROM users 
             WHERE phone_number = $1`,
            [phone]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find user by phone repository error:', error);
        throw error;
    }
};

export const findUserByPhoneAndRole = async (phone,role) => {
    try {
        const result = await db.query(
            `SELECT id, phone_number, email, full_name, profile_picture, 
                    role, is_verified, is_active, last_login, created_at, updated_at
             FROM users 
             WHERE phone_number = $1 AND role = $2`,
            [phone, role]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find user by phone and role repository error:', error);
        throw error;
    }
};

export const findUserByEmail = async (email) => {
    try {
        const result = await db.query(
            `SELECT id, phone_number, email, full_name, profile_picture, 
                    role, is_verified, is_active, last_login, created_at, updated_at
             FROM users 
             WHERE email = $1`,
            [email]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find user by email repository error:', error);
        throw error;
    }
};

export const findUserByEmailAndRole = async (email, role) => {
    try {
        const result = await db.query(
            `SELECT id, phone_number, email, full_name, profile_picture, 
                    role, is_verified, is_active, last_login, created_at, updated_at
             FROM users 
             WHERE email = $1 AND role = $2`,
            [email, role]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find user by email repository error:', error);
        throw error;
    }
};
export const findUserById = async (id) => {
    try {
        const result = await db.query(
            `SELECT id, phone_number, email, full_name, profile_picture, 
                    role, is_verified, is_active, last_login, created_at, updated_at
             FROM users 
             WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find user by ID repository error:', error);
        throw error;
    }
};

export const createUser = async (userData) => {
    try {
        const { phone_number, email, full_name, role = 'passenger' } = userData;
        
        const result = await db.query(
            `INSERT INTO users (phone_number, email, full_name, role, is_verified)
             VALUES ($1, $2, $3, $4, true)
             RETURNING id, phone_number, email, full_name, role, is_verified, created_at`,
            [phone_number, email, full_name, role]
        );

        // Create wallet for user
        await db.query(
            `INSERT INTO wallets (user_id) VALUES ($1)`,
            [result.rows[0].id]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Create user repository error:', error);
        throw error;
    }
};

export const updateUser = async (id, updates) => {
    try {
        const setClause = [];
        const values = [];
        let paramIndex = 1;

        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                setClause.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        });

        if (setClause.length === 0) {
            return await findUserById(id);
        }

        values.push(id);
        const query = `
            UPDATE users 
            SET ${setClause.join(', ')}, updated_at = NOW()
            WHERE id = $${paramIndex}
           RETURNING id, phone_number, email, full_name, profile_picture, 
          role, is_verified, is_active, last_login, created_at, updated_at, fcm_token
        `;

        const result = await db.query(query, values);
        return result.rows[0];
    } catch (error) {
        logger.error('Update user repository error:', error);
        throw error;
    }
};

export const softDeleteUser = async (id) => {
    try {
        const result = await db.query(
            `UPDATE users
             SET is_active      = false,
                 phone_number   = phone_number || '-deleted-' || $1,
                 email          = CASE WHEN email IS NOT NULL THEN email || '-deleted-' || $1 ELSE NULL END,
                 updated_at     = NOW()
             WHERE id = $1
             RETURNING id`,
            [id]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Soft delete user repository error:', error);
        throw error;
    }
};

export const verifyUser = async (id) => {
    try {
        const result = await db.query(
            `UPDATE users 
             SET is_verified = true, updated_at = NOW()
             WHERE id = $1
             RETURNING id, phone_number, email, full_name, role, is_verified`,
            [id]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Verify user repository error:', error);
        throw error;
    }
};