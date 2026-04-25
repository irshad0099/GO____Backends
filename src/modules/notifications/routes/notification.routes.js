import express from 'express';
import * as controller from '../controllers/notification.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

// GET /api/v1/notifications?limit=20&offset=0 — grouped by Today/Yesterday
router.get('/', controller.getNotifications);

// GET /api/v1/notifications/unread-count — bell icon badge
router.get('/unread-count', controller.getUnreadCount);

// PATCH /api/v1/notifications/:id/read — single notification read
router.patch('/:id/read', controller.markAsRead);

// PATCH /api/v1/notifications/read-all — mark all as read
router.patch('/read-all', controller.markAllAsRead);

export default router;
