import TrackingRepository from '../repositories/trackingRepository.js';
import logger from '../../../core/logger/logger.js';

export class TrackingService {
  constructor() {
    this.trackingRepository = new TrackingRepository();
  }

  async generateTrackingLink(rideId) {
    try {
      const token = await this.trackingRepository.generateTrackingToken(rideId);

      if (!token) {
        throw new Error('Failed to generate tracking token');
      }

      const trackingLink = `${process.env.APP_URL || 'https://yourapp.com'}/track/${token}`;

      logger.info('Tracking link generated', { rideId, token });

      return {
        token,
        trackingLink,
        shareableUrl: trackingLink
      };
    } catch (error) {
      logger.error('Error generating tracking link', { rideId, error });
      throw error;
    }
  }

  async getTrackingData(trackingToken) {
    try {
      const rideData = await this.trackingRepository.getTrackingDataByToken(trackingToken);

      if (!rideData) {
        throw new Error('Ride not found or tracking disabled');
      }

      const currentLocation = await this.trackingRepository.getCurrentLocation(rideData.ride_id);

      const locationHistory = await this.trackingRepository.getLocationHistory(
        rideData.ride_id
      );

      return {
        rideId: rideData.ride_id,
        status: rideData.status,
        trackingToken,
        driver: {
          id: rideData.driver_id,
          name: rideData.driver_name,
          phone: rideData.driver_phone,
          rating: rideData.driver_rating,
          vehicle: {
            number: rideData.vehicle_number,
            type: rideData.vehicle_type,
            color: rideData.vehicle_color,
            image: rideData.vehicle_image
          }
        },
        passenger: {
          id: rideData.passenger_id,
          name: rideData.passenger_name,
          phone: rideData.passenger_phone
        },
        location: {
          pickup: rideData.pickup_location,
          dropoff: rideData.dropoff_location,
          current: currentLocation ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            timestamp: currentLocation.timestamp,
            accuracy: currentLocation.accuracy
          } : null
        },
        fare: {
          estimated: rideData.estimated_fare,
          final: rideData.final_fare
        },
        timestamps: {
          startedAt: rideData.started_at,
          completedAt: rideData.completed_at
        },
        route: locationHistory.map(loc => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
          timestamp: loc.timestamp,
          accuracy: loc.accuracy
        })),
        routeStats: this.calculateRouteStats(locationHistory)
      };
    } catch (error) {
      logger.error('Error getting tracking data', { trackingToken, error });
      throw error;
    }
  }

  async recordLocation(rideId, latitude, longitude, accuracy = null) {
    try {
      const location = await this.trackingRepository.saveLocationHistory(
        rideId,
        latitude,
        longitude,
        accuracy
      );

      logger.debug('Location recorded', { rideId, latitude, longitude });

      return location;
    } catch (error) {
      logger.error('Error recording location', { rideId, error });
      throw error;
    }
  }

  async getRouteHistory(trackingToken) {
    try {
      const rideData = await this.trackingRepository.getTrackingDataByToken(trackingToken);

      if (!rideData) {
        throw new Error('Ride not found');
      }

      const locationHistory = await this.trackingRepository.getLocationHistory(
        rideData.ride_id,
        1000
      );

      return {
        rideId: rideData.ride_id,
        status: rideData.status,
        route: locationHistory,
        stats: this.calculateRouteStats(locationHistory),
        location: {
          pickup: rideData.pickup_location,
          dropoff: rideData.dropoff_location
        },
        timestamps: {
          startedAt: rideData.started_at,
          completedAt: rideData.completed_at
        }
      };
    } catch (error) {
      logger.error('Error getting route history', { trackingToken, error });
      throw error;
    }
  }

  calculateRouteStats(locationHistory) {
    if (!locationHistory || locationHistory.length < 2) {
      return {
        totalDistance: 0,
        totalDuration: 0,
        pointCount: locationHistory?.length || 0
      };
    }

    const totalDistance = this.calculateDistance(locationHistory);
    const firstPoint = locationHistory[0];
    const lastPoint = locationHistory[locationHistory.length - 1];
    const totalDuration = lastPoint.timestamp - firstPoint.timestamp;

    return {
      totalDistance: parseFloat(totalDistance.toFixed(2)),
      totalDuration: Math.round(totalDuration / 1000 / 60), // minutes
      pointCount: locationHistory.length,
      startTime: firstPoint.timestamp,
      endTime: lastPoint.timestamp
    };
  }

  calculateDistance(locations) {
    const R = 6371; // Earth's radius in km
    let totalDistance = 0;

    for (let i = 0; i < locations.length - 1; i++) {
      const lat1 = (locations[i].latitude * Math.PI) / 180;
      const lat2 = (locations[i + 1].latitude * Math.PI) / 180;
      const deltaLat = ((locations[i + 1].latitude - locations[i].latitude) * Math.PI) / 180;
      const deltaLng = ((locations[i + 1].longitude - locations[i].longitude) * Math.PI) / 180;

      const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistance += R * c;
    }

    return totalDistance;
  }

  async disableTracking(trackingToken) {
    try {
      await this.trackingRepository.disableTracking(trackingToken);

      logger.info('Tracking disabled', { trackingToken });

      return { success: true };
    } catch (error) {
      logger.error('Error disabling tracking', { trackingToken, error });
      throw error;
    }
  }
}

export default TrackingService;
