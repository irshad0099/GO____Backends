import logger from '../../core/logger/logger.js';
import TrackingService from '../../modules/tracking/services/trackingService.js';

const trackingService = new TrackingService();

export const setupTrackingHandlers = (io) => {
  io.on('connection', (socket) => {
    // Driver sends location update
    socket.on('tracking:update-location', async (data) => {
      try {
        const { rideId, trackingToken, latitude, longitude, accuracy } = data;

        if (!rideId || !trackingToken || latitude === undefined || longitude === undefined) {
          logger.warn('Invalid tracking location data', { data });
          return;
        }

        // Save location to database
        await trackingService.recordLocation(rideId, latitude, longitude, accuracy);

        // Broadcast to all tracking viewers
        io.to(`tracking:${trackingToken}`).emit('tracking:location-updated', {
          rideId,
          latitude,
          longitude,
          accuracy,
          timestamp: new Date()
        });

        logger.debug('Location broadcasted', { rideId, trackingToken });
      } catch (error) {
        logger.error('Error updating tracking location', { error: error.message });
        socket.emit('tracking:error', { message: 'Failed to update location' });
      }
    });

    // Client joins tracking room
    socket.on('tracking:join', (data) => {
      try {
        const { trackingToken } = data;

        if (!trackingToken) {
          socket.emit('tracking:error', { message: 'Tracking token is required' });
          return;
        }

        socket.join(`tracking:${trackingToken}`);
        logger.debug('User joined tracking room', { trackingToken, socketId: socket.id });

        socket.emit('tracking:joined', {
          trackingToken,
          message: 'Successfully joined tracking'
        });
      } catch (error) {
        logger.error('Error joining tracking room', { error: error.message });
        socket.emit('tracking:error', { message: 'Failed to join tracking' });
      }
    });

    // Client leaves tracking room
    socket.on('tracking:leave', (data) => {
      try {
        const { trackingToken } = data;

        if (!trackingToken) return;

        socket.leave(`tracking:${trackingToken}`);
        logger.debug('User left tracking room', { trackingToken, socketId: socket.id });
      } catch (error) {
        logger.error('Error leaving tracking room', { error: error.message });
      }
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { socketId: socket.id });
    });
  });
};

export default setupTrackingHandlers;
