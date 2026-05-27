import * as incentiveService from '../services/incentiveService.js';
import { sendResponse } from '../../../core/utils/response.js';

// GET /api/v1/drivers/incentives/progress
// Response shape preserved from the previous implementation so the driver
// app does not need to change. The data underneath now comes from the
// rebuilt incentive tables.
export const getIncentiveProgress = async (req, res, next) => {
    try {
        const bonus = await incentiveService.getIncentiveProgress(req.user.id);

        if (!bonus) {
            return sendResponse(res, 200, 'No incentives available', {
                currentBonus: null,
                message: 'No active incentive plans available for your vehicle type',
            });
        }

        return sendResponse(res, 200, 'Incentive progress retrieved successfully', {
            currentBonus: bonus,
        });
    } catch (error) {
        next(error);
    }
};
