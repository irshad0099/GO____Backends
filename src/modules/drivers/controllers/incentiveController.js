import * as incentiveService from '../services/incentiveService.js';

export const getActiveIncentives = async (req, res, next) => {
    try {
        const data = await incentiveService.getActiveIncentives(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getIncentiveProgress = async (req, res, next) => {
    try {
        const data = await incentiveService.getIncentiveProgress(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
