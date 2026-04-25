import { db } from '../../../infrastructure/database/postgres.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

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
