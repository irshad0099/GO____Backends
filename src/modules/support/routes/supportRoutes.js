import express from 'express';
import * as controller from '../controllers/supportController.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { createTicketSchema, replyTicketSchema, validate } from '../../rides/validators/rideNewFeatures.validator.js';

const router = express.Router();

router.use(authenticate);

// GET /api/v1/support/categories — browse by category list
router.get('/categories', controller.getCategories);

// GET /api/v1/support/search?q=refund — search tickets
router.get('/search', controller.searchTickets);

// POST /api/v1/support/tickets — create ticket
router.post('/tickets', validate(createTicketSchema), controller.createTicket);

// GET /api/v1/support/tickets — my tickets
router.get('/tickets', controller.getMyTickets);

// GET /api/v1/support/tickets/:id — ticket detail + messages
router.get('/tickets/:id', controller.getTicketDetail);

// POST /api/v1/support/tickets/:id/reply — reply to ticket
router.post('/tickets/:id/reply', validate(replyTicketSchema), controller.replyToTicket);

export default router;
