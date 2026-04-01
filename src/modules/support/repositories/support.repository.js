import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Tickets ────────────────────────────────────────────────────────────────
export const insertTicket = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO support_tickets
             (ticket_number, user_id, ride_id, category, subject, description, priority)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [data.ticket_number, data.user_id, data.ride_id || null,
             data.category, data.subject, data.description,
             data.priority || 'medium']
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert support ticket repository error:', error);
        throw error;
    }
};

export const findTicketsByUser = async (userId, { limit = 20, offset = 0, status }) => {
    try {
        let query = `SELECT * FROM support_tickets WHERE user_id = $1`;
        const params = [userId];
        let idx = 2;

        if (status) {
            query += ` AND status = $${idx++}`;
            params.push(status);
        }
        query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
        params.push(limit, offset);

        const { rows } = await db.query(query, params);
        return rows;
    } catch (error) {
        logger.error('Find tickets by user repository error:', error);
        throw error;
    }
};

export const findTicketById = async (id, userId) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM support_tickets WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );
        return rows[0];
    } catch (error) {
        logger.error('Find ticket by id repository error:', error);
        throw error;
    }
};

export const updateTicketStatus = async (id, status) => {
    try {
        const { rows } = await db.query(
            `UPDATE support_tickets
             SET status = $2,
                 resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE resolved_at END,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, status]
        );
        return rows[0];
    } catch (error) {
        logger.error('Update ticket status repository error:', error);
        throw error;
    }
};

// ─── Messages ───────────────────────────────────────────────────────────────
export const insertMessage = async (data) => {
    try {
        const { rows } = await db.query(
            `INSERT INTO support_messages
             (ticket_id, sender_id, sender_role, message, attachments)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [data.ticket_id, data.sender_id, data.sender_role, data.message, data.attachments || '{}']
        );
        return rows[0];
    } catch (error) {
        logger.error('Insert support message repository error:', error);
        throw error;
    }
};

export const findMessagesByTicket = async (ticketId) => {
    try {
        const { rows } = await db.query(
            `SELECT sm.*, u.full_name AS sender_name
             FROM support_messages sm
             JOIN users u ON sm.sender_id = u.id
             WHERE sm.ticket_id = $1
             ORDER BY sm.created_at ASC`,
            [ticketId]
        );
        return rows;
    } catch (error) {
        logger.error('Find messages by ticket repository error:', error);
        throw error;
    }
};
