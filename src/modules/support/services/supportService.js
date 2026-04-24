import * as supportRepo from '../repositories/support.repository.js';
import { NotFoundError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

// Generate ticket number: TKT-YYYYMMDD-XXXXX
const generateTicketNumber = () => {
    const date = new Date();
    const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(10000 + Math.random() * 90000);
    return `TKT-${yyyymmdd}-${random}`;
};

// Auto-assign priority based on category
const getPriority = (category) => {
    const priorities = {
        safety_concern: 'urgent',
        driver_behavior: 'high',
        payment_issue: 'high',
        ride_issue: 'medium',
        app_bug: 'medium',
        account: 'low',
        other: 'low'
    };
    return priorities[category] || 'medium';
};

export const createTicket = async (userId, data) => {
    try {
        const ticket = await supportRepo.insertTicket({
            ticket_number: generateTicketNumber(),
            user_id: userId,
            ride_id: data.ride_id,
            category: data.category,
            subject: data.subject,
            description: data.description,
            priority: getPriority(data.category)
        });

        return {
            id: ticket.id,
            ticketNumber: ticket.ticket_number,
            category: ticket.category,
            subject: ticket.subject,
            priority: ticket.priority,
            status: ticket.status,
            message: 'Support ticket created. We will get back to you soon.'
        };
    } catch (error) {
        logger.error('Create ticket service error:', error);
        throw error;
    }
};

export const getMyTickets = async (userId, { limit = 20, offset = 0, status }) => {
    try {
        const tickets = await supportRepo.findTicketsByUser(userId, { limit, offset, status });
        return tickets.map(t => ({
            id: t.id, ticketNumber: t.ticket_number,
            category: t.category, subject: t.subject,
            priority: t.priority, status: t.status,
            createdAt: t.created_at, resolvedAt: t.resolved_at
        }));
    } catch (error) {
        logger.error('Get my tickets service error:', error);
        throw error;
    }
};

export const getTicketDetail = async (userId, ticketId) => {
    try {
        const ticket = await supportRepo.findTicketById(ticketId, userId);
        if (!ticket) throw new NotFoundError('Support ticket');

        const messages = await supportRepo.findMessagesByTicket(ticketId);

        return {
            ticket: {
                id: ticket.id, ticketNumber: ticket.ticket_number,
                category: ticket.category, subject: ticket.subject,
                description: ticket.description, priority: ticket.priority,
                status: ticket.status, rideId: ticket.ride_id,
                createdAt: ticket.created_at, resolvedAt: ticket.resolved_at,
                resolutionNotes: ticket.resolution_notes
            },
            messages: messages.map(m => ({
                id: m.id, senderName: m.sender_name,
                senderRole: m.sender_role, message: m.message,
                attachments: m.attachments, createdAt: m.created_at
            }))
        };
    } catch (error) {
        logger.error('Get ticket detail service error:', error);
        throw error;
    }
};

export const searchTickets = async (userId, query) => {
    try {
        const tickets = await supportRepo.searchTickets(userId, query);
        return tickets.map(t => ({
            id: t.id, ticketNumber: t.ticket_number,
            category: t.category, subject: t.subject,
            priority: t.priority, status: t.status,
            createdAt: t.created_at
        }));
    } catch (error) {
        logger.error('Search tickets service error:', error);
        throw error;
    }
};

export const replyToTicket = async (userId, ticketId, message, attachments) => {
    try {
        const ticket = await supportRepo.findTicketById(ticketId, userId);
        if (!ticket) throw new NotFoundError('Support ticket');

        const reply = await supportRepo.insertMessage({
            ticket_id: ticketId,
            sender_id: userId,
            sender_role: 'user',
            message,
            attachments: attachments || []
        });

        // Update ticket status
        if (ticket.status === 'waiting_on_user') {
            await supportRepo.updateTicketStatus(ticketId, 'in_progress');
        }

        return reply;
    } catch (error) {
        logger.error('Reply to ticket service error:', error);
        throw error;
    }
};
