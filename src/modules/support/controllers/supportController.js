import * as supportService from '../services/supportService.js';

export const createTicket = async (req, res, next) => {
    try {
        const data = await supportService.createTicket(req.user.id, req.body);
        res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
};

export const getMyTickets = async (req, res, next) => {
    try {
        const { limit = 20, offset = 0, status } = req.query;
        const data = await supportService.getMyTickets(req.user.id, { limit: parseInt(limit), offset: parseInt(offset), status });
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};

export const getTicketDetail = async (req, res, next) => {
    try {
        const data = await supportService.getTicketDetail(req.user.id, parseInt(req.params.id));
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};

export const replyToTicket = async (req, res, next) => {
    try {
        const data = await supportService.replyToTicket(req.user.id, parseInt(req.params.id), req.body.message, req.body.attachments);
        res.status(201).json({ success: true, message: 'Reply sent', data });
    } catch (error) { next(error); }
};
