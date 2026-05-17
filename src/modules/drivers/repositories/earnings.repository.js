import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Insert ledger entry ────────────────────────────────────────────────────
export const insertLedgerEntry = async (client, { driver_id, type, amount, duration_minutes = 0, ride_id = null, reference_id = null, payment_method = null, note = null }) => {
    const { rows } = await client.query(
        `INSERT INTO driver_ledger (driver_id, type, amount, duration_minutes, ride_id, reference_id, payment_method, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [driver_id, type, amount, duration_minutes || 0, ride_id, reference_id, payment_method, note]
    );
    return rows[0];
};

// ─── Weekly earnings (computed from ledger) ─────────────────────────────────
export const findWeeklyEarnings = async (driverId, { limit = 10, offset = 0 }) => {
    try {
        const { rows } = await db.query(
            `SELECT
                date_trunc('week', created_at)::date                                        AS week_start,
                (date_trunc('week', created_at)::date + 6)                                  AS week_end,
                COUNT(DISTINCT ride_id) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released'))  AS completed_rides,
                COALESCE(SUM(amount) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')), 0) AS ride_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'tip' AND status IN ('completed','released')), 0)           AS tip_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'incentive' AND status IN ('completed','released')), 0)     AS incentive_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'referral' AND status IN ('completed','released')), 0)      AS referral_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'cash_deposit' AND status IN ('completed','released')), 0)  AS cash_collected,
                COALESCE(ABS(SUM(amount) FILTER (WHERE amount < 0 AND status IN ('completed','released'))), 0)        AS total_deductions,
                COALESCE(SUM(amount) FILTER (WHERE status IN ('completed','released')), 0)                            AS net_earnings,
                COALESCE(SUM(duration_minutes) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')), 0) AS total_online_hours
             FROM driver_ledger
             WHERE driver_id = $1
             GROUP BY date_trunc('week', created_at)
             ORDER BY week_start DESC
             LIMIT $2 OFFSET $3`,
            [driverId, limit, offset]
        );
        return rows;
    } catch (error) {
        logger.error('Find weekly earnings repository error:', error);
        throw error;
    }
};

// ─── Monthly earnings (computed from ledger) ────────────────────────────────
export const findMonthlyEarnings = async (driverId, { limit = 12, offset = 0 }) => {
    try {
        const { rows } = await db.query(
            `SELECT
                EXTRACT(MONTH FROM created_at)::int                                         AS month,
                EXTRACT(YEAR FROM created_at)::int                                          AS year,
                COUNT(DISTINCT ride_id) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released'))  AS completed_rides,
                COALESCE(SUM(amount) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')), 0) AS ride_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'tip' AND status IN ('completed','released')), 0)           AS tip_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'incentive' AND status IN ('completed','released')), 0)     AS incentive_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'referral' AND status IN ('completed','released')), 0)      AS referral_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'cash_deposit' AND status IN ('completed','released')), 0)  AS cash_collected,
                COALESCE(ABS(SUM(amount) FILTER (WHERE amount < 0 AND status IN ('completed','released'))), 0)        AS total_deductions,
                COALESCE(SUM(amount) FILTER (WHERE status IN ('completed','released')), 0)                            AS net_earnings,
                COALESCE(SUM(duration_minutes) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')), 0) AS total_online_hours
             FROM driver_ledger
             WHERE driver_id = $1
             GROUP BY EXTRACT(YEAR FROM created_at), EXTRACT(MONTH FROM created_at)
             ORDER BY year DESC, month DESC
             LIMIT $2 OFFSET $3`,
            [driverId, limit, offset]
        );
        return rows;
    } catch (error) {
        logger.error('Find monthly earnings repository error:', error);
        throw error;
    }
};

// ─── Current week live summary ───────────────────────────────────────────────
export const findCurrentWeekEarnings = async (driverId) => {
    try {
        const { rows } = await db.query(
            `SELECT
                date_trunc('week', CURRENT_DATE)::date                                      AS week_start,
                (date_trunc('week', CURRENT_DATE)::date + 6)                                AS week_end,
                COUNT(DISTINCT ride_id) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')) AS completed_rides,
                COALESCE(SUM(amount) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')), 0) AS ride_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'tip' AND status IN ('completed','released')), 0) AS tip_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'incentive' AND status IN ('completed','released')), 0) AS incentive_earnings,
                COALESCE(SUM(amount) FILTER (WHERE amount < 0 AND status IN ('completed','released')), 0) AS total_deductions,
                COALESCE(SUM(amount) FILTER (WHERE status IN ('completed','released')), 0) AS net_earnings,
                COALESCE(SUM(duration_minutes) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')), 0) AS total_online_hours
             FROM driver_ledger
             WHERE driver_id = $1
               AND created_at >= date_trunc('week', CURRENT_DATE)`,
            [driverId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find current week earnings repository error:', error);
        throw error;
    }
};

// ─── Custom date range earnings statement ────────────────────────────────────
export const findEarningsByDateRange = async (driverId, fromDate, toDate) => {
    try {
        const { rows: summary } = await db.query(
            `SELECT
                COUNT(DISTINCT ride_id) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')) AS completed_rides,
                COALESCE(SUM(amount) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')), 0) AS ride_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'tip' AND status IN ('completed','released')), 0) AS tip_earnings,
                COALESCE(SUM(amount) FILTER (WHERE type = 'incentive' AND status IN ('completed','released')), 0) AS incentive_earnings,
                COALESCE(ABS(SUM(amount) FILTER (WHERE amount < 0 AND status IN ('completed','released'))), 0) AS total_deductions,
                COALESCE(SUM(amount) FILTER (WHERE status IN ('completed','released')), 0) AS net_earnings,
                COALESCE(SUM(duration_minutes) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')), 0) AS total_online_hours
             FROM driver_ledger
             WHERE driver_id = $1
               AND created_at >= $2
               AND created_at <= $3`,
            [driverId, fromDate, toDate]
        );

        const { rows: daily } = await db.query(
            `SELECT
                DATE(created_at) AS date,
                COALESCE(SUM(amount) FILTER (WHERE type IN ('ride_earning','tip') AND status IN ('completed','released')), 0) AS earnings,
                COUNT(DISTINCT ride_id) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')) AS rides,
                COALESCE(SUM(amount) FILTER (WHERE type = 'incentive' AND status IN ('completed','released')), 0) AS incentives,
                COALESCE(SUM(duration_minutes) FILTER (WHERE type = 'ride_earning' AND status IN ('completed','released')), 0) AS online_hours
             FROM driver_ledger
             WHERE driver_id = $1
               AND created_at >= $2
               AND created_at <= $3
             GROUP BY DATE(created_at)
             ORDER BY date`,
            [driverId, fromDate, toDate]
        );

        return { summary: summary[0], daily };
    } catch (error) {
        logger.error('Find earnings by date range repository error:', error);
        throw error;
    }
};

// ─── Recent ledger entries (transaction history for driver app) ──────────────
export const findLedgerHistory = async (driverId, { limit = 20, offset = 0 }) => {
    try {
        const { rows } = await db.query(
            `SELECT id, type, amount, ride_id, reference_id, payment_method, note, created_at
             FROM driver_ledger
             WHERE driver_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [driverId, limit, offset]
        );
        return rows;
    } catch (error) {
        logger.error('Find ledger history repository error:', error);
        throw error;
    }
};
