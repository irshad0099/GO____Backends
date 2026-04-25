import * as service from '../services/notification.service.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getNotifications = async (req, res, next) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const data = await service.getNotifications(req.user.id, { limit, offset });
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const getUnreadCount = async (req, res, next) => {
    try {
        const data = await service.getUnreadCount(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const markAsRead = async (req, res, next) => {
    try {
        const data = await service.markAsRead(req.user.id, parseInt(req.params.id));
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const markAllAsRead = async (req, res, next) => {
    try {
        const data = await service.markAllAsRead(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};
