<<<<<<< HEAD
import * as collectionService from '../services/rideCollectionService.js';
import logger from '../../../core/logger/logger.js';

/**
 * POST /api/v1/rides/:rideId/collect-confirm
 * Driver confirms cash/personal UPI collection from passenger
 */
export const confirmCollection = async (req, res, next) => {
    try {
        const driverUserId = req.user.id;
        const { rideId } = req.params;
        const { collection_method = 'cash' } = req.body;

        const result = await collectionService.confirmCashCollection(
            driverUserId,
            parseInt(rideId),
            { collection_method }
        );

        // Emit socket events for real-time updates
        const io = req.app.get('io');
        if (io) {
            // Notify driver
            io.to(`driver_${driverUserId}`).emit('ride:collection_confirmed', {
                rideId: parseInt(rideId),
                netEarnings: result.data.earnings.netEarnings,
                message: 'Collection confirmed successfully',
            });

            // Notify passenger
            io.to(`user_${req.ride?.passenger_id}`).emit('ride:payment_settled', {
                rideId: parseInt(rideId),
                amount: result.data.earnings.finalFare,
                method: collection_method,
                message: 'Payment settled via cash collection',
            });
        }

        res.status(200).json(result);
    } catch (error) {
        logger.error('[Collection] confirmCollection controller error:', error);
        next(error);
    }
};

/**
 * GET /api/v1/rides/:rideId/collection-status
 * Get collection status for a ride (driver or passenger)
 */
export const getCollectionStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { rideId } = req.params;
        const role = req.user.role; // 'driver' or 'passenger'

        const result = await collectionService.getCollectionStatus(
            userId,
            parseInt(rideId),
            role
        );

        res.status(200).json(result);
    } catch (error) {
        logger.error('[Collection] getCollectionStatus controller error:', error);
=======
import * as rideCollectionService from '../services/rideCollectionService.js';
import { sendResponse } from '../../../core/utils/response.js';

// ─── POST /api/v1/rides/:rideId/collect-confirm ─────────────────────────────
// Driver button: "Paise mil gaye (cash / personal UPI)"
// Body: { method: 'cash' | 'personal_upi' }
export const confirmCollection = async (req, res, next) => {
    try {
        const driverUserId = req.user.id;
        const rideId       = parseInt(req.params.rideId, 10);
        const method       = (req.body?.method || 'cash').toLowerCase();

        const result = await rideCollectionService.confirmManualCollection(
            driverUserId, rideId, { method },
        );

        return sendResponse(res, 200, result.message, result.data);
    } catch (error) {
>>>>>>> 14c146dabe2491c7238ceb55d507474f5b956c15
        next(error);
    }
};
