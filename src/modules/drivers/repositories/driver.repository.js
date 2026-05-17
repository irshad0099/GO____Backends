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
                COALESCE(SUM(amount) FILTER (WHERE type IN ('ride_earning', 'tip', 'incentive', 'referral') AND status IN ('completed','released')), 0) AS total_earnings,
                COUNT(DISTINCT ride_id) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')) AS rides_completed,
                COALESCE(SUM(amount) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')), 0) AS ride_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'tip' AND status IN ('completed','released')), 0) AS tip_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'incentive' AND status IN ('completed','released')), 0) AS incentive_earnings,
                COALESCE(ABS(SUM(amount) FILTER (WHERE amount < 0 AND status IN ('completed','released'))), 0) AS total_deductions,
                json_agg(
                    json_build_object(
                        'date', DATE(created_at),
                        'type', type,
                        'amount', amount,
                        'rideId', ride_id
                    ) ORDER BY created_at DESC
                ) FILTER (WHERE status IN ('completed','released')) AS breakdown
             FROM driver_ledger
             WHERE driver_id = $1
               AND created_at >= $2
               AND created_at <= $3`,
            [driverId, startDate, endDate]
        );
        const row = rows[0];
        return {
            total:             parseFloat(row.total_earnings),
            rides:             parseInt(row.rides_completed),
            rideEarnings:      parseFloat(row.ride_earnings),
            tipEarnings:       parseFloat(row.tip_earnings),
            incentiveEarnings: parseFloat(row.incentive_earnings),
            totalDeductions:   parseFloat(row.total_deductions),
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
