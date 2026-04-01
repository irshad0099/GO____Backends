import * as invoiceRepo from '../repositories/rideInvoice.repository.js';
import * as rideRepo from '../repositories/ride.repository.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

// Generate invoice number: INV-YYYYMMDD-XXXXX
const generateInvoiceNumber = () => {
    const date = new Date();
    const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(10000 + Math.random() * 90000);
    return `INV-${yyyymmdd}-${random}`;
};

export const getInvoice = async (userId, rideId) => {
    try {
        const ride = await rideRepo.findRideById(rideId);
        if (!ride) throw new NotFoundError('Ride');

        // Check if user is part of this ride
        if (ride.passenger_id !== userId) {
            throw new ApiError(403, 'You can only view invoices for your own rides');
        }

        if (ride.status !== 'completed') {
            throw new ApiError(400, 'Invoice is only available for completed rides');
        }

        // Check existing invoice
        let invoice = await invoiceRepo.findByRide(rideId);

        // Auto-generate if not exists
        if (!invoice) {
            invoice = await invoiceRepo.insert({
                ride_id: rideId,
                invoice_number: generateInvoiceNumber(),
                base_fare: ride.base_fare,
                distance_fare: ride.distance_fare,
                time_fare: ride.time_fare,
                surge_charge: ride.surge_multiplier > 1
                    ? (parseFloat(ride.estimated_fare) * (parseFloat(ride.surge_multiplier) - 1)).toFixed(2)
                    : 0,
                discount_amount: ride.discount_amount || 0,
                subtotal: ride.actual_fare || ride.estimated_fare,
                total_amount: ride.final_fare || ride.actual_fare || ride.estimated_fare,
                payment_method: ride.payment_method,
                payment_status: ride.payment_status === 'completed' ? 'paid' : 'pending',
                paid_at: ride.completed_at,
                vehicle_type: ride.vehicle_type,
                distance_km: ride.distance_km,
                duration_minutes: ride.duration_minutes,
                pickup_address: ride.pickup_address,
                dropoff_address: ride.dropoff_address,
                ride_date: ride.requested_at
            });

            // Mark ride invoice as generated
            await rideRepo.updateRideField(rideId, 'invoice_generated', true);
        }

        return invoice;
    } catch (error) {
        logger.error('Get invoice service error:', error);
        throw error;
    }
};
