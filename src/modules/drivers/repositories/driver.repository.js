import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

export const findDriverByUserId = async (userId) => {
    try {
        const result = await db.query(
            `SELECT d.*, u.phone_number, u.email, u.full_name, u.profile_picture
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             WHERE d.user_id = $1`,
            [userId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find driver by user ID repository error:', error);
        throw error;
    }
};


export const insertAadhar = async (driverId, data) => {
    try {
        
    
    const query = `
        INSERT INTO driver_aadhaar
        (driver_id, aadhaar_name, aadhaar_number, aadhaar_front, aadhaar_back, consent_given)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
    `;

    const values = [
        driverId,
        data.aadhaar_name,
        data.aadhaar_number,
        data.aadhaar_front,
        data.aadhaar_back,
        data.consent_given
    ];

    const { rows } = await pool.query(query, values);

    return rows[0];
 } catch (error) {
            logger.error('Insert Aadhaar repository error:', error);
            throw error
    }
};

export const getAadharByDriverId = async (driverId) => {
    try {
        
    
     const result = await db.query(
            `SELECT * FROM driver_aadhaar WHERE driver_id = $1`,
            [driverId]
        );

    return result.rows[0];
 } catch (error) {
            logger.error('Insert Aadhaar repository error:', error);
            throw error
    }
};


export const getPanByDriverId = async (driverId) => {
        try{
    const query = `
        SELECT * FROM driver_pan
        WHERE driver_id = $1
    `;

    const { rows } = await pool.query(query, [driverId]);

    return rows[0];
      } catch (error) {
        logger.error('Getting Driver pan Detail repository error:', error);
        throw error
        }
};


export const insertPan = async (driverId, data) => {
        try {
       
    const query = `
        INSERT INTO driver_pan
        (driver_id, pan_name, pan_number, pan_dob, pan_front)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *
    `;

    const values = [
        driverId,
        data.pan_name,
        data.pan_number,
        data.pan_dob,
        data.pan_front
    ];

    const { rows } = await pool.query(query, values);

    return rows[0];
         
        } catch (error) {
        logger.error('Inserting Driver pan Detail repository error:', error);
        throw error
        }
};

export const getBankByDriverId = async (driverId) => {
try{
    const query = `
        SELECT * FROM driver_bank
        WHERE driver_id = $1
    `;

    const { rows } = await pool.query(query, [driverId]);

    return rows[0];
      } catch (error) {
        logger.error('Getting Driver bank Detail repository error:', error);
        throw error
        }
};


export const insertBank = async (driverId, data) => {
try{
    const query = `
        INSERT INTO driver_bank
        (
            driver_id,
            account_holder_name,
            account_number,
            ifsc_code,
            account_type,
            bank_proof_document
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
    `;

    const values = [
        driverId,
        data.account_holder_name,
        data.account_number,
        data.ifsc_code,
        data.account_type,
        data.bank_proof_document
    ];

    const { rows } = await pool.query(query, values);

    return rows[0];
      } catch (error) {
        logger.error('Inserting Driver bank Detail repository error:', error);
        throw error
        }
};


export const getLicenseByDriverId = async (driverId) => {
try{
  const query = `
    SELECT * FROM driver_license
    WHERE driver_id = $1
  `;

  const { rows } = await pool.query(query, [driverId]);

  return rows[0];
} catch (error) {
    logger.error('Getting Driver license Detail repository error:', error);
    throw error
}
};


export const insertLicense = async (driverId, data) => {
    try{
  const query = `
    INSERT INTO driver_license
    (
      driver_id,
      license_number,
      license_name,
      license_dob,
      license_issue_date,
      license_expiry_date,
      license_front,
      license_back
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `;

  const values = [
    driverId,
    data.license_number,
    data.license_name,
    data.license_dob,
    data.license_issue_date,
    data.license_expiry_date,
    data.license_front,
    data.license_back
  ];

  const { rows } = await pool.query(query, values);

  return rows[0];
} catch (error) {
    logger.error('Inserting Driver license Detail repository error:', error);
    throw error
}
};



export const getVehicleByDriverId = async (driverId) => {
try{
  const query = `
    SELECT * FROM driver_vehicle
    WHERE driver_id = $1
  `;

  const { rows } = await pool.query(query, [driverId]);

  return rows[0];
  } catch (error) {
            logger.error('Getting Driver vehicle Detail repository error:', error);
            throw error
    }
};


export const insertVehicle = async (driverId, data) => {
    try {
        
    
  const query = `
    INSERT INTO driver_vehicle
    (
      driver_id,
      rc_number,
      vehicle_number,
      owner_name,
      rc_front,
      rc_back,

      policy_number,
      insurance_provider,
      insurance_front,
      insurance_back,
      insurance_valid_until,

      permit_number,
      permit_type,
      permit_document,
      permit_valid_until
    )
    VALUES
    ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING *
  `;

  const values = [
    driverId,
    data.rc_number,
    data.vehicle_number,
    data.owner_name,
    data.rc_front,
    data.rc_back,

    data.policy_number,
    data.insurance_provider,
    data.insurance_front,
    data.insurance_back,
    data.insurance_valid_until,

    data.permit_number,
    data.permit_type,
    data.permit_document,
    data.permit_valid_until
  ];

  const { rows } = await pool.query(query, values);

  return rows[0];
  } catch (error) {
            logger.error('Inserting Driver vehicle Detail repository error:', error);
            throw error
    }
};

export const findDriverByVehicleNumber = async (vehicleNumber) => {
    try {
        const result = await db.query(
            `SELECT * FROM drivers WHERE vehicle_number = $1`,
            [vehicleNumber]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find driver by vehicle number repository error:', error);
        throw error;
    }
};
export const verifyDriverDocument = async (
  tableName,
  driverId,
  status,
  rejectedReason
) => {
        try {
          let status_value;     
      switch (status){
        case 0:
             status_value = 'pending' 
             break;
        case 1:
                status_value = 'verified' 
                break;
        case 2:
                status_value = 'rejected'
                break;
        deafult:
                throw new ApiError(400, 'Wrong status sent ')
            
        }


  const query = `
    UPDATE ${tableName}
    SET
      verification_status = $1,
      verified_at = NOW(),
      rejected_reason = $2
    WHERE driver_id = $3
    RETURNING *
  `;

  const values = [status_value, rejectedReason || null, driverId];

  const { rows } = await pool.query(query, values);

  return rows[0];
   } catch (error) {
          logger.error('Update KYC driver repository error:', error);
        throw error;  
        }
};


export const checkAllDocumentsVerified = async (driverId) => {
    try{
  const query = `
    SELECT
      (SELECT verification_status FROM driver_aadhaar WHERE driver_id = $1) AS aadhaar,
      (SELECT verification_status FROM driver_pan WHERE driver_id = $1) AS pan,
      (SELECT verification_status FROM driver_bank WHERE driver_id = $1) AS bank,
      (SELECT verification_status FROM driver_license WHERE driver_id = $1) AS license,
      (SELECT verification_status FROM driver_vehicle WHERE driver_id = $1) AS vehicle
  `;

  const { rows } = await pool.query(query, [driverId]);

  const docs = rows[0];

  return (
    docs.aadhaar === "verified" &&
    docs.pan === "verified" &&
    docs.bank === "verified" &&
    docs.license === "verified" &&
    docs.vehicle === "verified"
  );
  } catch (error) {
          logger.error('Checking KYC driver repository error:', error);
        throw error;  
        }
};
export const findDriverById = async (id) => {
    try {
        const result = await db.query(
            `SELECT d.*, u.phone_number, u.email, u.full_name, u.profile_picture
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             WHERE d.id = $1`,
            [id]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find driver by ID repository error:', error);
        throw error;
    }
};


export const markDriverVerified = async (driverId) => {
    try{
    const query2 = `SELECT
      (SELECT verification_status FROM driver_aadhaar WHERE driver_id = $1) AS aadhaar,
      (SELECT verification_status FROM driver_pan WHERE driver_id = $1) AS pan,
      (SELECT verification_status FROM driver_bank WHERE driver_id = $1) AS bank,
      (SELECT verification_status FROM driver_license WHERE driver_id = $1) AS license,
      (SELECT verification_status FROM driver_vehicle WHERE driver_id = $1) AS vehicle
  `;
  
    const { rows } = await pool.query(query2, [driverId]);

  const docs = rows[0];

  if(docs.aadhaar !== "verified" || docs.pan !== "verified" || docs.bank !== "verified" || docs.license !== "verified" || docs.vehicle !== "verified"){
    throw new Error('All documents are not verified yet');
  }

  const query = `
    UPDATE drivers
    SET is_verified = true,
        updated_at = NOW()
    WHERE id = $1
  `;

  await pool.query(query, [driverId]);
} catch (error) {
        logger.error('mark driver kyc verified repository error:', error);
        throw error;
    }
};



export const getDriverDocument = async (driverId) => {
  try {

    const query = `
      SELECT
        (SELECT row_to_json(a) FROM driver_aadhaar a WHERE a.driver_id = $1) AS aadhaar,
        (SELECT row_to_json(p) FROM driver_pan p WHERE p.driver_id = $1) AS pan,
        (SELECT row_to_json(b) FROM driver_bank b WHERE b.driver_id = $1) AS bank,
        (SELECT row_to_json(l) FROM driver_license l WHERE l.driver_id = $1) AS license,
        (SELECT row_to_json(v) FROM driver_vehicle v WHERE v.driver_id = $1) AS vehicle
    `;

    const { rows } = await pool.query(query, [driverId]);

    return rows[0];

  } catch (error) {
    logger.error('get driver kyc document repository error:', error);
    throw error;
  }
};


export const createDriver = async (driverData) => {
    try {
        const {
            userId,
            vehicleType,
            vehicleNumber,
            vehicleModel,
            vehicleColor,
            licenseNumber,
            licenseExpiry
        } = driverData;

        const result = await db.query(
            `INSERT INTO drivers 
             (user_id, vehicle_type, vehicle_number, vehicle_model, 
              vehicle_color, license_number, license_expiry)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [userId, vehicleType, vehicleNumber, vehicleModel, vehicleColor, licenseNumber, licenseExpiry]
        );

        return result.rows[0];
    } catch (error) {
        logger.error('Create driver repository error:', error);
        throw error;
    }
};

export const updateDriver = async (id, updates) => {
    try {
        const setClause = [];
        const values = [];
        let paramIndex = 1;

        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                setClause.push(`${key} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        });

        if (setClause.length === 0) {
            return await findDriverById(id);
        }

        values.push(id);
        const query = `
            UPDATE drivers 
            SET ${setClause.join(', ')}, updated_at = NOW()
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await db.query(query, values);
        return result.rows[0];
    } catch (error) {
        logger.error('Update driver repository error:', error);
        throw error;
    }
};

export const verifyDriver = async (id) => {
    try {
        const result = await db.query(
            `UPDATE drivers 
             SET is_verified = true, verified_at = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Verify driver repository error:', error);
        throw error;
    }
};

export const findAvailableDrivers = async (vehicleType, latitude, longitude, radiusKm = 5) => {
    try {
        // Haversine formula to find nearby drivers
        const result = await db.query(
            `SELECT d.*, 
                    (6371 * acos(cos(radians($1)) * cos(radians(d.current_latitude)) * 
                    cos(radians(d.current_longitude) - radians($2)) + 
                    sin(radians($1)) * sin(radians(d.current_latitude)))) AS distance
             FROM drivers d
             WHERE d.vehicle_type = $3
               AND d.is_verified = true
               AND d.is_available = true
               AND d.is_on_duty = false
               AND d.current_latitude IS NOT NULL
               AND d.current_longitude IS NOT NULL
             HAVING distance <= $4
             ORDER BY distance
             LIMIT 10`,
            [latitude, longitude, vehicleType, radiusKm]
        );

        return result.rows;
    } catch (error) {
        logger.error('Find available drivers repository error:', error);
        throw error;
    }
};

export const getDriverEarnings = async (driverId, startDate, endDate) => {
    try {
        const result = await db.query(
            `SELECT 
                COUNT(*) as total_rides,
                COALESCE(SUM(actual_fare), 0) as total_earnings,
                COALESCE(AVG(actual_fare), 0) as avg_fare
             FROM rides
             WHERE driver_id = $1
               AND status = 'completed'
               AND completed_at BETWEEN $2 AND $3`,
            [driverId, startDate, endDate]
        );

        const breakdown = await db.query(
            `SELECT 
                DATE(completed_at) as date,
                COUNT(*) as rides,
                COALESCE(SUM(actual_fare), 0) as earnings
             FROM rides
             WHERE driver_id = $1
               AND status = 'completed'
               AND completed_at BETWEEN $2 AND $3
             GROUP BY DATE(completed_at)
             ORDER BY date`,
            [driverId, startDate, endDate]
        );

        return {
            total: parseFloat(result.rows[0].total_earnings),
            rides: parseInt(result.rows[0].total_rides),
            avgFare: parseFloat(result.rows[0].avg_fare),
            breakdown: breakdown.rows
        };
    } catch (error) {
        logger.error('Get driver earnings repository error:', error);
        throw error;
    }
};


// ========== NEW REPOSITORY FUNCTIONS (Scoring & Metrics) ==========

export const findDriverScore = async (driverId) => {
    try {
        const result = await db.query(
            `SELECT * FROM driver_score WHERE driver_id = $1`,
            [driverId]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Find driver score repository error:', error);
        throw error;
    }
};

export const getDriverCityRank = async (driverId, city) => {
    try {
        const result = await db.query(
            `SELECT COUNT(*) + 1 as rank
             FROM driver_score ds
             JOIN drivers d ON ds.driver_id = d.id
             WHERE d.city = $1 AND ds.score_total > (SELECT score_total FROM driver_score WHERE driver_id = $2)`,
            [city, driverId]
        );
        return result.rows[0]?.rank || 1;
    } catch (error) {
        logger.error('Get driver city rank repository error:', error);
        throw error;
    }
};

export const getWeeklyPosition = async (driverId) => {
    try {
        // Weekly position based on total rides (you may change to weekly earnings if needed)
        const result = await db.query(
            `SELECT COUNT(*) + 1 as position
             FROM drivers
             WHERE total_rides > (SELECT total_rides FROM drivers WHERE id = $1)`,
            [driverId]
        );
        return result.rows[0]?.position || 1;
    } catch (error) {
        logger.error('Get weekly position repository error:', error);
        throw error;
    }
};

export const getDriverDailyMetrics = async (driverId, days = 7) => {
    try {
        const result = await db.query(
            `SELECT * FROM driver_metrics_daily 
             WHERE driver_id = $1 
             AND date >= CURRENT_DATE - INTERVAL '${days} days'
             ORDER BY date DESC`,
            [driverId]
        );
        return result.rows;
    } catch (error) {
        logger.error('Get driver daily metrics repository error:', error);
        throw error;
    }
};