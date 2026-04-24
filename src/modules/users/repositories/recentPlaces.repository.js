import { db } from '../../../infrastructure/database/postgres.js';

export const getRecentPlaces = async (userId, limit = 10) => {
    const { rows } = await db.query(
        `SELECT DISTINCT ON (dropoff_address)
            dropoff_address    AS address,
            dropoff_location_name AS name,
            dropoff_latitude   AS lat,
            dropoff_longitude  AS lng,
            MAX(created_at)    AS last_used
        FROM rides
        WHERE passenger_id = $1
          AND dropoff_address IS NOT NULL
          AND status = 'completed'
        GROUP BY dropoff_address, dropoff_location_name, dropoff_latitude, dropoff_longitude
        ORDER BY dropoff_address, last_used DESC
        LIMIT $2`,
        [userId, limit]
    );
    return rows;
};
