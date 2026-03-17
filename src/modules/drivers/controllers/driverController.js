import * as driverService from '../services/driverService.js';
import logger from '../../../core/logger/logger.js';

export const register = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const driverData = req.body;
        
        const driver = await driverService.registerDriver(userId, driverData);

        res.status(201).json({
            success: true,
            message: 'Driver registration successful. Pending verification.',
            data: driver
        });
    } catch (error) {
        next(error);
    }
};


// add aadhar - detail
export const addAadharDetail = async (req, res, next) => {
    try {

        const userId = req.user.id;
        const aadhaarData = req.body;

        const aadhaar = await driverService.addAadharDetail(userId, aadhaarData);

        res.status(201).json({
            success: true,
            message: "Aadhaar uploaded successfully. Pending verification.",
            data: aadhaar
        });

    } catch (error) {
        next(error);
    }
};


// pan detail verification
export const addPanDetail = async (req, res, next) => {
    try {

        const userId = req.user.id;
        const panData = req.body;

        const pan = await driverService.addPanDetail(userId, panData);

        res.status(201).json({
            success: true,
            message: "PAN details uploaded successfully. Pending verification.",
            data: pan
        });

    } catch (error) {
        next(error);
    }
};

// bank detail verification
export const addBankDetail = async (req, res, next) => {
    try {

        const userId = req.user.id;
        const bankData = req.body;

        const bank = await driverService.addBankDetail(userId, bankData);

        res.status(201).json({
            success: true,
            message: "Bank details uploaded successfully. Pending verification.",
            data: bank
        });

    } catch (error) {
        next(error);
    }
};


// license detail verification
export const addLicenseDetail = async (req, res, next) => {
  try {

    const userId = req.user.id;
    const licenseData = req.body;

    const license = await driverService.addLicenseDetail(userId, licenseData);

    res.status(201).json({
      success: true,
      message: "License details uploaded successfully. Pending verification.",
      data: license
    });

  } catch (error) {
    next(error);
  }
};


// vehicle detail verification
export const addVehicleDetail = async (req, res, next) => {
  try {

    const userId = req.user.id;
    const vehicleData = req.body;

    const vehicle = await driverService.addVehicleDetail(userId, vehicleData);

    res.status(201).json({
      success: true,
      message: "Vehicle details uploaded successfully. Pending verification.",
      data: vehicle
    });

  } catch (error) {
    next(error);
  }
};


// verify kyc
export const verifyDriverDocument = async (req, res, next) => {
  try {
 const userId = req.user.id;
    const { driver_id, document_type, status, rejected_reason } = req.body;

    const result = await driverService.verifyDriverDocument(userId,{
      driver_id,
      document_type,
      status,
      rejected_reason
    });

    res.status(200).json({
      success: true,
      message: "Document verification updated",
      data: result
    });

  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const profile = await driverService.getDriverProfile(userId);

        res.status(200).json({
            success: true,
            data: profile
        });
    } catch (error) {
        next(error);
    }
};

export const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const updates = req.body;
        
        const updatedProfile = await driverService.updateDriverProfile(userId, updates);

        res.status(200).json({
            success: true,
            message: 'Driver profile updated successfully',
            data: updatedProfile
        });
    } catch (error) {
        next(error);
    }
};

export const updateLocation = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { latitude, longitude } = req.body;
        
        const result = await driverService.updateDriverLocation(userId, latitude, longitude);

        res.status(200).json({
            success: true,
            message: 'Location updated successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const toggleAvailability = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { isAvailable } = req.body;
        
        const result = await driverService.toggleAvailability(userId, isAvailable);

        res.status(200).json({
            success: true,
            message: `Driver is now ${result.isAvailable ? 'available' : 'unavailable'}`,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const getRideHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;
        
        const history = await driverService.getDriverRideHistory(userId, { page, limit, status });

        res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

export const getEarnings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { period = 'weekly' } = req.query;
        
        const earnings = await driverService.getDriverEarnings(userId, period);

        res.status(200).json({
            success: true,
            data: earnings
        });
    } catch (error) {
        next(error);
    }
};

export const getCurrentRide = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const ride = await driverService.getCurrentRide(userId);

        res.status(200).json({
            success: true,
            data: ride
        });
    } catch (error) {
        next(error);
    }
};

// ========== NEW CONTROLLER FUNCTIONS (Scoring & Metrics) ==========

export const getDriverScore = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const score = await driverService.getDriverScore(userId);
        res.status(200).json({
            success: true,
            data: score
        });
    } catch (error) {
        next(error);
    }
};

export const getDriverBadge = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const badge = await driverService.getDriverBadge(userId);
        res.status(200).json({
            success: true,
            data: badge
        });
    } catch (error) {
        next(error);
    }
};

export const getDailyMetrics = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { days = 7 } = req.query;
        const metrics = await driverService.getDriverDailyMetrics(userId, days);
        res.status(200).json({
            success: true,
            data: metrics
        });
    } catch (error) {
        next(error);
    }
};


