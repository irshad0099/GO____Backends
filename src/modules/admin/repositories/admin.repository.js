



import { pool } from '../../../infrastructure/database/postgres.js';
import logger    from '../../../core/logger/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
//  DASHBOARD STATS
// ─────────────────────────────────────────────────────────────────────────────

export const getDashboardStats = async () => {
    try {
        const result = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users)                                         AS total_users,
                (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURRENT_DATE)  AS new_users_today,
                (SELECT COUNT(*) FROM users WHERE is_active = TRUE)                 AS active_users,

                (SELECT COUNT(*) FROM drivers)                                       AS total_drivers,
                (SELECT COUNT(*) FROM drivers WHERE is_online = TRUE)               AS online_drivers,
                (SELECT COUNT(*) FROM drivers WHERE is_verified = TRUE)             AS verified_drivers,

                (SELECT COUNT(*) FROM rides)                                         AS total_rides,
                (SELECT COUNT(*) FROM rides WHERE DATE(created_at) = CURRENT_DATE)  AS rides_today,
                (SELECT COUNT(*) FROM rides WHERE status = 'ongoing')               AS ongoing_rides,
                (SELECT COUNT(*) FROM rides WHERE status = 'completed')             AS completed_rides,
                (SELECT COUNT(*) FROM rides WHERE status = 'cancelled')             AS cancelled_rides,

                (SELECT COALESCE(SUM(amount), 0) FROM transactions
                 WHERE type = 'credit' AND status = 'success'
                 AND DATE(created_at) = CURRENT_DATE)                               AS revenue_today,

                (SELECT COALESCE(SUM(amount), 0) FROM transactions
                 WHERE type = 'credit' AND status = 'success'
                 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) AS revenue_month
        `);
        return result.rows[0];
    } catch (error) {
        logger.error('getDashboardStats error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const getAllUsers = async ({ limit, offset, search, status }) => {
    try {
        let query  = `SELECT id, full_name, email, phone_number, is_active, created_at FROM users WHERE 1=1`;
        const params = [];
        let idx = 1;

        if (search) {
            query += ` AND (full_name ILIKE $${idx} OR email ILIKE $${idx} OR phone_number ILIKE $${idx})`;
            params.push(`%${search}%`); idx++;
        }
        if (status === 'active')   { query += ` AND is_active = TRUE`; }
        if (status === 'inactive') { query += ` AND is_active = FALSE`; }

        query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('getAllUsers error:', error);
        throw error;
    }
};

export const getAllUsersCount = async ({ search, status }) => {
    try {
        let query  = `SELECT COUNT(*) FROM users WHERE 1=1`;
        const params = [];
        let idx = 1;

        if (search) {
            query += ` AND (full_name ILIKE $${idx} OR email ILIKE $${idx} OR phone_number ILIKE $${idx})`;
            params.push(`%${search}%`); idx++;
        }
        if (status === 'active')   { query += ` AND is_active = TRUE`; }
        if (status === 'inactive') { query += ` AND is_active = FALSE`; }

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('getAllUsersCount error:', error);
        throw error;
    }
};

export const getUserById = async (userId) => {
    try {
        const result = await pool.query(
            `SELECT u.*,
                    w.balance          AS wallet_balance
             FROM users u
             LEFT JOIN wallets w ON w.user_id = u.id
             WHERE u.id = $1`,
            [userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getUserById error:', error);
        throw error;
    }
};

export const toggleUserStatus = async (userId, isActive) => {
    try {
        const result = await pool.query(
            `UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING id, full_name, email, is_active`,
            [isActive, userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('toggleUserStatus error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DRIVER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const getAllDrivers = async ({ limit, offset, search, status, isVerified }) => {
    try {
        let query  = `
            SELECT d.*, u.full_name, u.email, u.phone_number, u.is_active
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            WHERE 1=1`;
        const params = [];
        let idx = 1;

        if (search) {
            query += ` AND (u.full_name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.phone_number ILIKE $${idx})`;
            params.push(`%${search}%`); idx++;
        }
        if (status === 'online')  { query += ` AND d.is_online = TRUE`; }
        if (status === 'offline') { query += ` AND d.is_online = FALSE`; }
        if (isVerified === true)  { query += ` AND d.is_verified = TRUE`; }
        if (isVerified === false) { query += ` AND d.is_verified = FALSE`; }

        query += ` ORDER BY d.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('getAllDrivers error:', error);
        throw error;
    }
};

export const getAllDriversCount = async ({ search, status, isVerified }) => {
    try {
        let query  = `SELECT COUNT(*) FROM drivers d JOIN users u ON d.user_id = u.id WHERE 1=1`;
        const params = [];
        let idx = 1;

        if (search) {
            query += ` AND (u.full_name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.phone_number ILIKE $${idx})`;
            params.push(`%${search}%`); idx++;
        }
        if (status === 'online')  { query += ` AND d.is_online = TRUE`; }
        if (status === 'offline') { query += ` AND d.is_online = FALSE`; }
        if (isVerified === true)  { query += ` AND d.is_verified = TRUE`; }
        if (isVerified === false) { query += ` AND d.is_verified = FALSE`; }

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('getAllDriversCount error:', error);
        throw error;
    }
};

export const getDriverById = async (driverId) => {
    try {
        const result = await pool.query(
            `SELECT d.*, u.full_name, u.email, u.phone_number, u.is_active,
                    w.balance AS wallet_balance
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             LEFT JOIN wallets w ON w.user_id = u.id
             WHERE d.id = $1`,
            [driverId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('getDriverById error:', error);
        throw error;
    }
};

export const verifyDriver = async (driverId, isVerified) => {
    try {
        const result = await pool.query(
            `UPDATE drivers SET is_verified = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING *`,
            [isVerified, driverId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('verifyDriver error:', error);
        throw error;
    }
};

export const toggleDriverStatus = async (driverId, isActive) => {
    try {
        const driver = await pool.query(`SELECT user_id FROM drivers WHERE id = $1`, [driverId]);
        if (!driver.rows[0]) return null;

        const result = await pool.query(
            `UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 RETURNING id, full_name, is_active`,
            [isActive, driver.rows[0].user_id]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.error('toggleDriverStatus error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  RIDE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const getAllRides = async ({ limit, offset, status, vehicleType, startDate, endDate }) => {
    try {
        let query = `
            SELECT r.*,
                   u.full_name    AS passenger_name,
                   u.phone_number AS passenger_phone,
                   d.id           AS driver_id,
                   du.full_name   AS driver_name
            FROM rides r
            JOIN users u ON r.passenger_id = u.id
            LEFT JOIN drivers d  ON r.driver_id = d.id
            LEFT JOIN users  du  ON d.user_id = du.id
            WHERE 1=1`;
        const params = [];
        let idx = 1;

        if (status)      { query += ` AND r.status = $${idx++}`;        params.push(status); }
        if (vehicleType) { query += ` AND r.vehicle_type = $${idx++}`;  params.push(vehicleType); }
        if (startDate)   { query += ` AND r.created_at >= $${idx++}`;   params.push(startDate); }
        if (endDate)     { query += ` AND r.created_at <= $${idx++}`;   params.push(endDate); }

        query += ` ORDER BY r.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('getAllRides error:', error);
        throw error;
    }
};

export const getAllRidesCount = async ({ status, vehicleType, startDate, endDate }) => {
    try {
        let query  = `SELECT COUNT(*) FROM rides r WHERE 1=1`;
        const params = [];
        let idx = 1;

        if (status)      { query += ` AND r.status = $${idx++}`;       params.push(status); }
        if (vehicleType) { query += ` AND r.vehicle_type = $${idx++}`; params.push(vehicleType); }
        if (startDate)   { query += ` AND r.created_at >= $${idx++}`;  params.push(startDate); }
        if (endDate)     { query += ` AND r.created_at <= $${idx++}`;  params.push(endDate); }

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('getAllRidesCount error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  TRANSACTION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const getAllTransactions = async ({ limit, offset, type, category, status, startDate, endDate }) => {
    try {
        let query = `
            SELECT t.*, u.full_name AS user_name, u.phone_number AS user_phone
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            WHERE 1=1`;
        const params = [];
        let idx = 1;

        if (type)      { query += ` AND t.type = $${idx++}`;       params.push(type); }
        if (category)  { query += ` AND t.category = $${idx++}`;   params.push(category); }
        if (status)    { query += ` AND t.status = $${idx++}`;     params.push(status); }
        if (startDate) { query += ` AND t.created_at >= $${idx++}`; params.push(startDate); }
        if (endDate)   { query += ` AND t.created_at <= $${idx++}`; params.push(endDate); }

        query += ` ORDER BY t.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        logger.error('getAllTransactions error:', error);
        throw error;
    }
};

export const getAllTransactionsCount = async ({ type, category, status, startDate, endDate }) => {
    try {
        let query  = `SELECT COUNT(*) FROM transactions WHERE 1=1`;
        const params = [];
        let idx = 1;

        if (type)      { query += ` AND type = $${idx++}`;        params.push(type); }
        if (category)  { query += ` AND category = $${idx++}`;    params.push(category); }
        if (status)    { query += ` AND status = $${idx++}`;      params.push(status); }
        if (startDate) { query += ` AND created_at >= $${idx++}`; params.push(startDate); }
        if (endDate)   { query += ` AND created_at <= $${idx++}`; params.push(endDate); }

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count);
    } catch (error) {
        logger.error('getAllTransactionsCount error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  REVENUE ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

export const getRevenueByDay = async (days = 7) => {
    try {
        const result = await pool.query(
            `SELECT
                DATE(created_at)               AS date,
                COUNT(*)                       AS total_rides,
                COALESCE(SUM(estimated_fare), 0) AS total_revenue
             FROM rides
             WHERE status = 'completed'
               AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
             GROUP BY DATE(created_at)
             ORDER BY date ASC`
        );
        return result.rows;
    } catch (error) {
        logger.error('getRevenueByDay error:', error);
        throw error;
    }
};

export const getRevenueByVehicle = async () => {
    try {
        const result = await pool.query(
            `SELECT
                vehicle_type,
                COUNT(*)                        AS total_rides,
                COALESCE(SUM(estimated_fare), 0) AS total_revenue,
                COALESCE(AVG(estimated_fare), 0) AS avg_fare
             FROM rides
             WHERE status = 'completed'
             GROUP BY vehicle_type
             ORDER BY total_revenue DESC`
        );
        return result.rows;
    } catch (error) {
        logger.error('getRevenueByVehicle error:', error);
        throw error;
    }
};