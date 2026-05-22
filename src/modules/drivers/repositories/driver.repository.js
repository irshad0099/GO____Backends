import { db } from '../../../infrastructure/database/postgres.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';
import { initCashBalance, addToPending } from './cashCollection.repository.js';

export const findDriverByUserId = async (userId) => {
    try {
        const result = await db.query(
            `SELECT d.*, u.phone_number, u.email, u.full_name, u.profile_picture,
                    dv.vehicle_type, dv.vehicle_number, dv.vehicle_model, dv.vehicle_color
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             LEFT JOIN driver_vehicle dv ON d.id = dv.driver_id
             WHERE d.user_id = $1`,
            [userId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find driver by user ID repository error:', error);
        throw error;
    }
};

export const findDriverById = async (id) => {
    try {
        const result = await db.query(
            `SELECT d.*, u.phone_number, u.email, u.full_name, u.profile_picture,
                    dv.vehicle_type, dv.vehicle_number, dv.vehicle_model, dv.vehicle_color
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             LEFT JOIN driver_vehicle dv ON d.id = dv.driver_id
             WHERE d.id = $1`,
            [id]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find driver by ID repository error:', error);
        throw error;
    }
};

export const createDriver = async (driverData) => {
    try {
        const { userId } = driverData;
        const result = await db.query(
            `INSERT INTO drivers (user_id) VALUES ($1) RETURNING *`,
            [userId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Create driver repository error:', error);
        throw error;
    }
};

export const updateDriver = async (id, updates) => {
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

        if (setClause.length === 0) return await findDriverById(id);

        values.push(id);
        const result = await db.query(
            `UPDATE drivers SET ${setClause.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Update driver repository error:', error);
        throw error;
    }
};

export const verifyDriver = async (id) => {
    try {
        const result = await db.query(
            `UPDATE drivers SET is_verified = true, verified_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Verify driver repository error:', error);
        throw error;
    }
};

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export const getVehicleByDriverId = async (driverId) => {
    try {
        const { rows } = await db.query(`SELECT * FROM driver_vehicle WHERE driver_id = $1`, [driverId]);
        return rows[0];
    } catch (error) {
        logger.error('Get vehicle repository error:', error);
        throw error;
    }
};

export const insertVehicle = async (driverId, data) => {
    try {
        const query = `
            INSERT INTO driver_vehicle
                (driver_id, vehicle_type, vehicle_model, vehicle_color,
                 rc_number, vehicle_number, owner_name, rc_front, rc_back,
                 policy_number, insurance_provider, insurance_front, insurance_back, insurance_valid_until,
                 permit_number, permit_type, permit_document, permit_valid_until)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            ON CONFLICT (driver_id) DO UPDATE SET
                vehicle_type          = EXCLUDED.vehicle_type,
                vehicle_model         = EXCLUDED.vehicle_model,
                vehicle_color         = EXCLUDED.vehicle_color,
                rc_number             = EXCLUDED.rc_number,
                vehicle_number        = EXCLUDED.vehicle_number,
                owner_name            = EXCLUDED.owner_name,
                rc_front              = EXCLUDED.rc_front,
                rc_back               = EXCLUDED.rc_back,
                policy_number         = EXCLUDED.policy_number,
                insurance_provider    = EXCLUDED.insurance_provider,
                insurance_front       = EXCLUDED.insurance_front,
                insurance_back        = EXCLUDED.insurance_back,
                insurance_valid_until = EXCLUDED.insurance_valid_until,
                permit_number         = EXCLUDED.permit_number,
                permit_type           = EXCLUDED.permit_type,
                permit_document       = EXCLUDED.permit_document,
                permit_valid_until    = EXCLUDED.permit_valid_until,
                verification_status   = 'pending',
                verified_at           = NULL,
                rejected_reason       = NULL
            RETURNING *`;

        const values = [
            driverId,
            data.vehicle_type, data.vehicle_model, data.vehicle_color,
            data.rc_number, data.vehicle_number, data.owner_name, data.rc_front, data.rc_back,
            data.policy_number, data.insurance_provider, data.insurance_front,
            data.insurance_back, data.insurance_valid_until,
            data.permit_number, data.permit_type, data.permit_document, data.permit_valid_until,
        ];

        const { rows } = await db.query(query, values);
        return rows[0];
    } catch (error) {
        logger.error('Insert vehicle repository error:', error);
        throw error;
    }
};

export const updateVehicleDetail = async (driverId, updates) => {
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

        if (setClause.length === 0) return null;

        values.push(driverId);
        const { rows } = await db.query(
            `UPDATE driver_vehicle SET ${setClause.join(', ')} WHERE driver_id = $${paramIndex} RETURNING *`,
            values
        );
        return rows[0];
    } catch (error) {
        logger.error('Update vehicle detail repository error:', error);
        throw error;
    }
};

export const findDriverByVehicleNumber = async (vehicleNumber) => {
    try {
        const result = await db.query(
            `SELECT d.* FROM drivers d
             JOIN driver_vehicle dv ON d.id = dv.driver_id
             WHERE dv.vehicle_number = $1`,
            [vehicleNumber]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find driver by vehicle number repository error:', error);
        throw error;
    }
};

export const findAvailableDrivers = async (vehicleType, latitude, longitude, radiusKm = 5) => {
    try {
        const result = await db.query(
            `SELECT d.*,
                    (6371 * acos(cos(radians($1)) * cos(radians(d.current_latitude)) *
                    cos(radians(d.current_longitude) - radians($2)) +
                    sin(radians($1)) * sin(radians(d.current_latitude)))) AS distance
             FROM drivers d
             JOIN driver_vehicle dv ON d.id = dv.driver_id
             WHERE dv.vehicle_type = $3
               AND d.is_verified = true
               AND d.is_available = true
               AND d.is_on_duty = false
               AND d.current_latitude IS NOT NULL
               AND d.current_longitude IS NOT NULL
             HAVING distance <= $4
             ORDER BY distance
             LIMIT 10`,
            [latitude, longitude, vehicleType, radiusKm]
        );
        return result.rows;
    } catch (error) {
        logger.error('Find available drivers repository error:', error);
        throw error;
    }
};

export const getDriverEarnings = async (driverId, startDate, endDate) => {
    try {
        const { rows } = await db.query(
            `SELECT
                COUNT(DISTINCT CASE WHEN dl.type = 'ride_earning' THEN dl.ride_id END) FILTER (WHERE dl.status IN ('completed','released')) AS total_rides,
                COALESCE(SUM(dmd.total_online_hours), 0) AS total_time_online,
                COALESCE(SUM(dl.amount) FILTER (WHERE dl.type IN ('ride_earning', 'tip', 'incentive', 'referral') AND dl.status IN ('completed','released')), 0) AS total_earnings,
                COUNT(DISTINCT dl.ride_id) FILTER (WHERE dl.type = 'ride_earning' AND dl.status IN ('completed','released')) AS rides_completed,
                COALESCE(SUM(dl.amount) FILTER (WHERE dl.type = 'ride_earning' AND dl.status IN ('completed','released')), 0) AS ride_earnings,
                COALESCE(SUM(dl.amount) FILTER (WHERE dl.type = 'tip' AND dl.status IN ('completed','released')), 0) AS tip_earnings,
                COALESCE(SUM(dl.amount) FILTER (WHERE dl.type = 'incentive' AND dl.status IN ('completed','released')), 0) AS incentive_earnings,
                COALESCE(ABS(SUM(dl.amount) FILTER (WHERE dl.amount < 0 AND dl.status IN ('completed','released'))), 0) AS total_deductions,
                COALESCE(ABS(SUM(dl.amount) FILTER (WHERE dl.type = 'platform_fee' AND dl.status IN ('completed','released'))), 0) AS platform_fee_paid,
                json_agg(
                    json_build_object(
                        'date', DATE(dl.created_at),
                        'type', dl.type,
                        'amount', dl.amount,
                        'rideId', dl.ride_id
                    ) ORDER BY dl.created_at DESC
                ) FILTER (WHERE dl.status IN ('completed','released')) AS breakdown
             FROM driver_ledger dl
             LEFT JOIN driver_metrics_daily dmd ON dl.driver_id = dmd.driver_id
               AND dmd.date >= DATE($2) AND dmd.date <= DATE($3)
             WHERE dl.driver_id = $1
               AND dl.created_at >= $2
               AND dl.created_at <= $3
             GROUP BY dl.driver_id`,
            [driverId, startDate, endDate]
        );
        const row = rows[0];
        if (!row) {
            return {
                total: 0, rides: 0, totalRides: 0, totalTimeOnline: 0,
                platformFeePaid: 0, rideEarnings: 0, tipEarnings: 0,
                incentiveEarnings: 0, totalDeductions: 0, breakdown: [],
            };
        }
        return {
            total:             parseFloat(row.total_earnings)      || 0,
            rides:             parseInt(row.rides_completed)        || 0,
            totalRides:        parseInt(row.total_rides)            || 0,
            totalTimeOnline:   parseFloat(row.total_time_online)    || 0,
            platformFeePaid:   parseFloat(row.platform_fee_paid)    || 0,
            rideEarnings:      parseFloat(row.ride_earnings)        || 0,
            tipEarnings:       parseFloat(row.tip_earnings)         || 0,
            incentiveEarnings: parseFloat(row.incentive_earnings)   || 0,
            totalDeductions:   parseFloat(row.total_deductions)     || 0,
            breakdown:         row.breakdown || [],
        };
    } catch (error) {
        logger.error('Get driver earnings repository error:', error);
        throw error;
    }
};

// Cash ride complete hone pe driver ka pending balance badhao
// driver_cash_balance row pehle se nahi hai toh create karo (first cash ride)
export const incrementDriverCashBalance = async (client, driverId, platformFee, finalFare = 0, netEarnings = 0) => {
    await initCashBalance(driverId);
    return addToPending(client, driverId, platformFee, finalFare, netEarnings);
};

// Cash dues settle hone pe total_earnings update karo (display stat)
export const incrementTotalEarnings = async (client, driverId, amount) => {
    const { rows } = await (client || db).query(
        `UPDATE drivers
         SET total_earnings = COALESCE(total_earnings, 0) + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING total_earnings`,
        [amount, driverId]
    );
    return rows[0];
};

// ─── Update/Create daily metrics jab driver online/offline hota hai ────────────
export const updateDailyMetrics = async (driverId, isOnline) => {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        if (isOnline) {
            // Driver online ho raha hai — online_from set karo
            const { rows } = await db.query(
                `INSERT INTO driver_metrics_daily (driver_id, date, online_from, updated_at)
                 VALUES ($1, $2, NOW(), NOW())
                 ON CONFLICT (driver_id, date) DO UPDATE SET
                    online_from = COALESCE(driver_metrics_daily.online_from, NOW()),
                    updated_at = NOW()
                 RETURNING *`,
                [driverId, today]
            );
            return rows[0];
        } else {
            // Driver offline ho raha hai — online_until set karo aur total_online_hours calculate karo
            const { rows } = await db.query(
                `UPDATE driver_metrics_daily
                 SET online_until = NOW(),
                     total_online_hours = COALESCE(
                        EXTRACT(EPOCH FROM (NOW() - online_from)) / 3600, 0
                     ),
                     updated_at = NOW()
                 WHERE driver_id = $1 AND date = $2 AND online_from IS NOT NULL
                 RETURNING *`,
                [driverId, today]
            );
            return rows[0];
        }
    } catch (error) {
        logger.error('Update daily metrics repository error:', error);
        throw error;
    }
};

// ─── Get today's metrics for driver ────────────────────────────────────────────
export const getTodayMetrics = async (driverId) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { rows } = await db.query(
            `SELECT * FROM driver_metrics_daily
             WHERE driver_id = $1 AND date = $2`,
            [driverId, today]
        );
        return rows[0] || null;
    } catch (error) {
        logger.error('Get today metrics repository error:', error);
        throw error;
    }
};

// ─── Update metrics on ride completion ─────────────────────────────────────────
export const updateMetricsOnRideCompletion = async (driverId, rideData) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { netEarnings = 0, platformFee = 0, tipAmount = 0 } = rideData;

        const { rows } = await db.query(
            `INSERT INTO driver_metrics_daily
             (driver_id, date, rides_completed, total_earnings, tips_earned, platform_fee_paid, updated_at)
             VALUES ($1, $2, 1, $3, $4, $5, NOW())
             ON CONFLICT (driver_id, date) DO UPDATE SET
                rides_completed = driver_metrics_daily.rides_completed + 1,
                total_earnings = COALESCE(driver_metrics_daily.total_earnings, 0) + $3,
                tips_earned = COALESCE(driver_metrics_daily.tips_earned, 0) + $4,
                platform_fee_paid = COALESCE(driver_metrics_daily.platform_fee_paid, 0) + $5,
                updated_at = NOW()
             RETURNING *`,
            [driverId, today, netEarnings, tipAmount, platformFee]
        );
        return rows[0];
    } catch (error) {
        logger.error('Update metrics on ride completion error:', error);
        throw error;
    }
};

export const softDeleteDriver = async (userId) => {
    try {
        // users table me phone/email mangle karo aur is_active false karo
        await db.query(
            `UPDATE users
             SET is_active    = false,
                 phone_number = phone_number || '-deleted-' || id,
                 email        = CASE WHEN email IS NOT NULL THEN email || '-deleted-' || id ELSE NULL END,
                 updated_at   = NOW()
             WHERE id = $1`,
            [userId]
        );

        // drivers table me is_on_duty false aur is_available false karo
        const result = await db.query(
            `UPDATE drivers
             SET is_on_duty    = false,
                 is_available  = false,
                 updated_at    = NOW()
             WHERE user_id = $1
             RETURNING id`,
            [userId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Soft delete driver repository error:', error);
        throw error;
    }
};
