import * as penaltyService from '../services/penaltyService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getMyPenalties = async (req, res, next) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const data = await penaltyService.getMyPenalties(req.user.id, { limit: parseInt(limit), offset: parseInt(offset) });
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};

export const acknowledgePenalty = async (req, res, next) => {
    try {
        const { penaltyId } = req.params;
        const data = await penaltyService.acknowledgePenalty(req.user.id, parseInt(penaltyId));
        sendResponse(res, 200, 'Penalty acknowledged', data);
    } catch (error) {
        next(error);
    }
};

export const appealPenalty = async (req, res, next) => {
    try {
        const { penaltyId } = req.params;
        const { reason } = req.body;
        const data = await penaltyService.appealPenalty(req.user.id, parseInt(penaltyId), reason);
        sendResponse(res, 200, 'Appeal submitted', data);
    } catch (error) {
        next(error);
    }
};

export const getAcceptanceRate = async (req, res, next) => {
    try {
        const rate = await penaltyService.getAcceptanceRate(req.user.id);
        sendResponse(res, 200, '', { acceptanceRate: rate });
    } catch (error) {
        next(error);
    }
};

export const checkBanStatus = async (req, res, next) => {
    try {
        const data = await penaltyService.checkBanStatus(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};
