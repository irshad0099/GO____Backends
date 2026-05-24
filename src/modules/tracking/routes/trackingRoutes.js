import express from 'express';
import * as trackingController from '../controllers/trackingController.js';

const router = express.Router();

// Public endpoints - no authentication needed
// Get live tracking data by token
router.get('/public/:trackingToken', trackingController.getTrackingData);

// Get route history by token
router.get('/public/:trackingToken/history', trackingController.getRouteHistory);

// Generate tracking link (requires auth - for ride creation)
router.post('/generate', trackingController.generateTrackingLink);

// Disable tracking (requires auth - for ride completion)
router.post('/:trackingToken/disable', trackingController.disableTracking);

export default router;
