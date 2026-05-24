import TrackingService from '../services/trackingService.js';
import logger from '../../../core/logger/logger.js';
import { sendResponse, sendError } from '../../../core/utils/response.js';

const trackingService = new TrackingService();

export const getTrackingData = async (req, res, next) => {
  try {
    const { trackingToken } = req.params;

    if (!trackingToken) {
      return sendError(res, 400, 'Tracking token is required');
    }

    const trackingData = await trackingService.getTrackingData(trackingToken);

    sendResponse(res, 200, 'Tracking data retrieved successfully', trackingData);
  } catch (error) {
    logger.error('Error in getTrackingData', { error: error.message });
    next(error);
  }
};

export const getRouteHistory = async (req, res, next) => {
  try {
    const { trackingToken } = req.params;

    if (!trackingToken) {
      return sendError(res, 400, 'Tracking token is required');
    }

    const routeData = await trackingService.getRouteHistory(trackingToken);

    sendResponse(res, 200, 'Route history retrieved successfully', routeData);
  } catch (error) {
    logger.error('Error in getRouteHistory', { error: error.message });
    next(error);
  }
};

export const generateTrackingLink = async (req, res, next) => {
  try {
    const { rideId } = req.body;

    if (!rideId) {
      return sendError(res, 400, 'Ride ID is required');
    }

    const trackingLink = await trackingService.generateTrackingLink(rideId);

    sendResponse(res, 201, 'Tracking link generated successfully', trackingLink);
  } catch (error) {
    logger.error('Error in generateTrackingLink', { error: error.message });
    next(error);
  }
};

export const disableTracking = async (req, res, next) => {
  try {
    const { trackingToken } = req.params;

    if (!trackingToken) {
      return sendError(res, 400, 'Tracking token is required');
    }

    const result = await trackingService.disableTracking(trackingToken);

    sendResponse(res, 200, 'Tracking disabled successfully', result);
  } catch (error) {
    logger.error('Error in disableTracking', { error: error.message });
    next(error);
  }
};

export default {
  getTrackingData,
  getRouteHistory,
  generateTrackingLink,
  disableTracking
};
