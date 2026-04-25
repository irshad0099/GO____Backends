import * as repo from '../repositories/recentPlaces.repository.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getRecentPlaces = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const data = await repo.getRecentPlaces(req.user.id, limit);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};
