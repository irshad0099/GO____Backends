import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// All active plans applicable to a driver: the default plan (NULL vehicle_type
// → applies to everyone) plus any plan explicitly targeting this vehicle type.
// Ordered so the default plan sits first when picking the "primary" plan for
// the progress endpoint.
export const findActivePlansForDriver = async (vehicleType) => {
    try {
        const { rows } = await db.query(
            `SELECT *
             FROM incentive_plans
             WHERE is_active = TRUE
               AND valid_from  <= NOW()
               AND valid_until >  NOW()
               AND (is_default = TRUE OR vehicle_type = $1)
             ORDER BY is_default DESC, bonus_amount DESC, id ASC`,
            [vehicleType]
        );
        return rows;
    } catch (error) {
        logger.error('findActivePlansForDriver error:', error);
        throw error;
    }
};

// The single "primary" plan shown on the driver dashboard — default plan wins,
// then the most lucrative vehicle-specific one.
export const findPrimaryPlanForDriver = async (vehicleType) => {
    const rows = await findActivePlansForDriver(vehicleType);
    return rows[0] || null;
};

// Total progress (rides or rupees, depending on plan.type) for a (driver, plan,
// period). Used by the read API; uses the main pool, not a tx client.
export const sumProgressInPeriod = async (driverId, planId, periodStart) => {
    try {
        const { rows } = await db.query(
            `SELECT COALESCE(SUM(increment_value), 0) AS total
             FROM driver_incentive_ride_log
             WHERE driver_id = $1 AND plan_id = $2 AND period_start = $3`,
            [driverId, planId, periodStart]
        );
        return parseFloat(rows[0].total);
    } catch (error) {
        logger.error('sumProgressInPeriod error:', error);
        throw error;
    }
};

// Same as above but inside a caller-managed transaction (after we just
// inserted the ride log row — needed to decide whether to credit reward).
export const sumProgressInPeriodTx = async (client, driverId, planId, periodStart) => {
    const { rows } = await client.query(
        `SELECT COALESCE(SUM(increment_value), 0) AS total
         FROM driver_incentive_ride_log
         WHERE driver_id = $1 AND plan_id = $2 AND period_start = $3`,
        [driverId, planId, periodStart]
    );
    return parseFloat(rows[0].total);
};

// Insert a ride-log row. ON CONFLICT DO NOTHING gives us idempotency: the
// same (driver, plan, ride) can't be counted twice. Returns the inserted row
// or null on conflict.
export const insertRideLog = async (client, driverId, planId, rideId, periodStart, incrementValue) => {
    const { rows } = await client.query(
        `INSERT INTO driver_incentive_ride_log
             (driver_id, plan_id, ride_id, period_start, increment_value)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ON CONSTRAINT driver_incentive_ride_log_unique DO NOTHING
         RETURNING *`,
        [driverId, planId, rideId, periodStart, incrementValue]
    );
    return rows[0] || null;
};

// Insert the reward payout row. Unique constraint on (driver, plan,
// period_start) ensures only one payout per milestone per period, even
// under concurrent ride completions. Returns null on duplicate.
export const insertReward = async (client, driverId, planId, periodStart, bonusAmount, ledgerId) => {
    const { rows } = await client.query(
        `INSERT INTO driver_incentive_rewards
             (driver_id, plan_id, period_start, bonus_amount, ledger_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ON CONSTRAINT driver_incentive_rewards_unique DO NOTHING
         RETURNING *`,
        [driverId, planId, periodStart, bonusAmount, ledgerId]
    );
    return rows[0] || null;
};

// Used by the read API to figure out if the current period's milestone has
// already been credited.
export const findRewardForPeriod = async (driverId, planId, periodStart) => {
    try {
        const { rows } = await db.query(
            `SELECT *
             FROM driver_incentive_rewards
             WHERE driver_id = $1 AND plan_id = $2 AND period_start = $3`,
            [driverId, planId, periodStart]
        );
        return rows[0] || null;
    } catch (error) {
        logger.error('findRewardForPeriod error:', error);
        throw error;
    }
};
