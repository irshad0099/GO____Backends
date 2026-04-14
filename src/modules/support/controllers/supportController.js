import * as supportService from '../services/supportService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const createTicket = async (req, res, next) => {
    try {
        const data = await supportService.createTicket(req.user.id, req.body);
        sendResponse(res, 201, '', data);
    } catch (error) { next(error); }
};

export const getMyTickets = async (req, res, next) => {
    try {
        const { limit = 20, offset = 0, status } = req.query;
        const data = await supportService.getMyTickets(req.user.id, { limit: parseInt(limit), offset: parseInt(offset), status });
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const getTicketDetail = async (req, res, next) => {
    try {
        const data = await supportService.getTicketDetail(req.user.id, parseInt(req.params.id));
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const replyToTicket = async (req, res, next) => {
    try {
        const data = await supportService.replyToTicket(req.user.id, parseInt(req.params.id), req.body.message, req.body.attachments);
        sendResponse(res, 201, 'Reply sent', data);
    } catch (error) { next(error); }
};
