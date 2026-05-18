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

        const response = {
            currentBonus: {
                bonusAmount: parseFloat(currentBonus.bonusAmount),
                ridesCompleted: Math.round(currentBonus.currentValue),
                ridesNeeded: Math.round(currentBonus.targetValue),
                ridesRemaining: Math.max(0, Math.round(currentBonus.targetValue - currentBonus.currentValue)),
                progress: `${Math.round(currentBonus.currentValue)}/${Math.round(currentBonus.targetValue)}`,
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
