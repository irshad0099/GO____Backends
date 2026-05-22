import * as incentiveService from '../services/incentiveService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getActiveIncentives = async (req, res, next) => {
    try {
        const data = await incentiveService.getActiveIncentives(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};

export const getIncentiveProgress = async (req, res, next) => {
    try {
        const progress = await incentiveService.getIncentiveProgress(req.user.id);

        // Handle case when no incentives exist
        if (!progress || progress.length === 0) {
            return sendResponse(res, 200, 'No incentives available', {
                currentBonus: null,
                message: 'No active incentive plans available for your vehicle type'
            });
        }

        // Get current active bonus (first incomplete one)
        const currentBonus = progress.find(p => !p.isCompleted) || progress[0];

        // For ride_count plans, use actual currentValue (which is correct after idempotency fix)
        // For earning_target plans, also use currentValue (represents rupees earned)
        const actualValue = Math.round(currentBonus.currentValue);
        const targetValue = Math.round(currentBonus.targetValue);
        const remaining = Math.max(0, targetValue - actualValue);

        const response = {
            currentBonus: {
                bonusAmount: parseFloat(currentBonus.bonusAmount),
                ridesCompleted: actualValue,
                ridesNeeded: targetValue,
                ridesRemaining: remaining,
                progress: `${actualValue}/${targetValue}`,
                percentDone: currentBonus.percentDone,
                planType: currentBonus.planType,
                planTitle: currentBonus.planTitle,
                isCompleted: currentBonus.isCompleted,
                isBonusCredited: currentBonus.isBonusCredited,
                completedAt: currentBonus.completedAt
            }
        };

        sendResponse(res, 200, 'Incentive progress retrieved successfully', response);
    } catch (error) {
        next(error);
    }
};
