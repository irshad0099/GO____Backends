import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const insert = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO ride_invoices
             (ride_id, invoice_number, base_fare, distance_fare, time_fare,
              surge_charge, convenience_fee, platform_fee, waiting_charges, pickup_charges,
              discount_amount, coupon_code, subscription_discount,
              toll_charges, tax_amount, tax_percent, tip_amount,
              subtotal, total_amount, currency,
              payment_method, payment_status, paid_at,
              vehicle_type, distance_km, duration_minutes,
              pickup_address, dropoff_address, ride_date)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
             RETURNING *`,
            [
                data.ride_id, data.invoice_number,
                data.base_fare || 0, data.distance_fare || 0, data.time_fare || 0,
                data.surge_charge || 0, data.convenience_fee || 0, data.platform_fee || 0,
                data.waiting_charges || 0, data.pickup_charges || 0,
                data.discount_amount || 0, data.coupon_code || null, data.subscription_discount || 0,
                data.toll_charges || 0, data.tax_amount || 0, data.tax_percent || 0,
                data.tip_amount || 0,
                data.subtotal, data.total_amount, data.currency || 'INR',
                data.payment_method, data.payment_status || 'pending', data.paid_at || null,
                data.vehicle_type, data.distance_km, data.duration_minutes,
                data.pickup_address, data.dropoff_address, data.ride_date
            ]
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert ride invoice repository error:', error);
        throw error;
    }
};

export const findByRide = async (rideId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM ride_invoices WHERE ride_id = $1`,
            [rideId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find invoice by ride repository error:', error);
        throw error;
    }
};

export const findByInvoiceNumber = async (invoiceNumber) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM ride_invoices WHERE invoice_number = $1`,
            [invoiceNumber]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find invoice by number repository error:', error);
        throw error;
    }
};
