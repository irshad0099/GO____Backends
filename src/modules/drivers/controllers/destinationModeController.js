import * as destService from '../services/destinationModeService.js';

export const getDestinationMode = async (req, res, next) => {
    try {
        const data = await destService.getDestinationMode(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const setDestinationMode = async (req, res, next) => {
    try {
        const data = await destService.setDestinationMode(req.user.id, req.body);
        res.status(201).json({ success: true, message: 'Destination mode activated', data });
    } catch (error) {
        next(error);
    }
};

export const removeDestinationMode = async (req, res, next) => {
    try {
        const data = await destService.removeDestinationMode(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
