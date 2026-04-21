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
        next(error);
    }
};
