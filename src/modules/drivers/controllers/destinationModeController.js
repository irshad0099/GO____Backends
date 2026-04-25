import * as destService from '../services/destinationModeService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getDestinationMode = async (req, res, next) => {
    try {
        const data = await destService.getDestinationMode(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};

export const setDestinationMode = async (req, res, next) => {
    try {
        const data = await destService.setDestinationMode(req.user.id, req.body);
        sendResponse(res, 201, 'Destination mode activated', data);
    } catch (error) {
        next(error);
    }
};

export const removeDestinationMode = async (req, res, next) => {
    try {
        const data = await destService.removeDestinationMode(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) {
        next(error);
    }
};
