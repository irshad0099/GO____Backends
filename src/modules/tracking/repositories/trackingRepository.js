import db from '../../../config/database.js';
import logger from '../../../core/logger/logger.js';
import crypto from 'crypto';

export class TrackingRepository {
  async generateTrackingToken(rideId) {
    try {
      const token = this.generateSecureToken(12);

      const result = await db.query(
        `UPDATE rides SET tracking_token = $1, tracking_enabled = true
         WHERE id = $2 RETURNING tracking_token`,
        [token, rideId]
      );

      return result.rows[0]?.tracking_token || null;
    } catch (error) {
      logger.error('Error generating tracking token', { rideId, error });
      throw error;
    }
  }

  async getTrackingDataByToken(trackingToken) {
    try {
      const result = await db.query(
        `SELECT
          r.id as ride_id,
          r.status,
          r.pickup_location,
          r.dropoff_location,
          r.estimated_fare,
          r.final_fare,
          r.started_at,
          r.completed_at,
          r.tracking_token,
          d.id as driver_id,
          d.name as driver_name,
          d.phone as driver_phone,
          d.rating as driver_rating,
          d.vehicle_number,
          d.vehicle_type,
          d.vehicle_color,
          d.vehicle_image,
          u.id as passenger_id,
          u.name as passenger_name,
          u.phone as passenger_phone
         FROM rides r
         JOIN drivers d ON r.driver_id = d.id
         JOIN users u ON r.passenger_id = u.id
         WHERE r.tracking_token = $1 AND r.tracking_enabled = true`,
        [trackingToken]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching tracking data', { trackingToken, error });
      throw error;
    }
  }

  async saveLocationHistory(rideId, latitude, longitude, accuracy = null) {
    try {
      const result = await db.query(
        `INSERT INTO ride_location_history (ride_id, latitude, longitude, accuracy, timestamp)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, latitude, longitude, timestamp`,
        [rideId, latitude, longitude, accuracy]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error saving location history', { rideId, error });
      throw error;
    }
  }

  async getLocationHistory(rideId, limit = 500) {
    try {
      const result = await db.query(
        `SELECT latitude, longitude, timestamp, accuracy
         FROM ride_location_history
         WHERE ride_id = $1
         ORDER BY timestamp ASC
         LIMIT $2`,
        [rideId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching location history', { rideId, error });
      throw error;
    }
  }

  async getCurrentLocation(rideId) {
    try {
      const result = await db.query(
        `SELECT latitude, longitude, timestamp, accuracy
         FROM ride_location_history
         WHERE ride_id = $1
         ORDER BY timestamp DESC
         LIMIT 1`,
        [rideId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching current location', { rideId, error });
      throw error;
    }
  }

  async disableTracking(trackingToken) {
    try {
      const result = await db.query(
        `UPDATE rides SET tracking_enabled = false
         WHERE tracking_token = $1
         RETURNING id`,
        [trackingToken]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error disabling tracking', { trackingToken, error });
      throw error;
    }
  }

  generateSecureToken(length = 12) {
    // Use crypto for cryptographically secure random bytes
    const bytes = crypto.randomBytes(Math.ceil(length * 3 / 4));
    const token = bytes
      .toString('base64')
      .replace(/[+/=]/g, '') // Remove padding chars
      .substring(0, length);

    return token;
  }
}

export default TrackingRepository;
