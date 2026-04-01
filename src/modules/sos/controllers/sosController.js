import * as sosService from '../services/sosService.js';

export const triggerSOS = async (req, res, next) => {
    try {
        const data = await sosService.triggerSOS(req.user.id, req.body);
        res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
};

export const cancelSOS = async (req, res, next) => {
    try {
        const data = await sosService.cancelSOS(req.user.id, parseInt(req.params.alertId));
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};

export const getMySosHistory = async (req, res, next) => {
    try {
        const data = await sosService.getMySosHistory(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};
