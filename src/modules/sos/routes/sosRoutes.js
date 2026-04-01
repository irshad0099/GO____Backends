import express from 'express';
import * as controller from '../controllers/sosController.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { triggerSosSchema, validate } from '../validators/sosValidator.js';

const router = express.Router();

router.use(authenticate);

// POST /api/v1/sos — trigger SOS during ride
router.post('/', validate(triggerSosSchema), controller.triggerSOS);

// PATCH /api/v1/sos/:alertId/cancel — false alarm / cancel SOS
router.patch('/:alertId/cancel', controller.cancelSOS);

// GET /api/v1/sos/history — my SOS history
router.get('/history', controller.getMySosHistory);

export default router;
