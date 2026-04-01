import * as penaltyService from '../services/penaltyService.js';

export const getMyPenalties = async (req, res, next) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const data = await penaltyService.getMyPenalties(req.user.id, { limit: parseInt(limit), offset: parseInt(offset) });
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const acknowledgePenalty = async (req, res, next) => {
    try {
        const { penaltyId } = req.params;
        const data = await penaltyService.acknowledgePenalty(req.user.id, parseInt(penaltyId));
        res.status(200).json({ success: true, message: 'Penalty acknowledged', data });
    } catch (error) {
        next(error);
    }
};

export const appealPenalty = async (req, res, next) => {
    try {
        const { penaltyId } = req.params;
        const { reason } = req.body;
        const data = await penaltyService.appealPenalty(req.user.id, parseInt(penaltyId), reason);
        res.status(200).json({ success: true, message: 'Appeal submitted', data });
    } catch (error) {
        next(error);
    }
};

export const getAcceptanceRate = async (req, res, next) => {
    try {
        const rate = await penaltyService.getAcceptanceRate(req.user.id);
        res.status(200).json({ success: true, data: { acceptanceRate: rate } });
    } catch (error) {
        next(error);
    }
};

export const checkBanStatus = async (req, res, next) => {
    try {
        const data = await penaltyService.checkBanStatus(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
