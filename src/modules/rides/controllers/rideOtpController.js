import * as otpService from '../services/rideOtpService.js';
import * as rideService from '../services/rideService.js';
import logger from '../../../core/logger/logger.js';
import { getIO } from '../../../config/websocketConfig.js';

// Generate OTP when driver arrives (optional explicit endpoint)
export const generateOtp = async (req, res, next) => {
    try {
        const { rideId } = req.params;
        const userId = req.user.id;

        // Get ride to fetch passenger phone
        const ride = await rideService.getRideDetails(userId, rideId, req.user.role);
        const passengerPhone = ride.passenger?.phone;

        if (!passengerPhone) {
            return res.status(400).json({
                success: false,
                message: 'Passenger phone number not found for this ride'
            });
        }

        const otpResult = await otpService.generateRideOTP(rideId, passengerPhone);

        logger.info('✅ OTP generated and sent via API', {
            rideId,
            passengerPhone: passengerPhone.slice(-4),
            smsSent: otpResult.smsSent
        });

        res.status(200).json({
            success: true,
            data: otpResult
        });
    } catch (error) {
        logger.error('Generate OTP error:', error);
        next(error);
    }
};

// Verify OTP entered by driver
export const verifyOtp = async (req, res, next) => {
    try {
        const rideId = parseInt(req.params.rideId);
        const data = await otpService.verifyRideOTP(rideId, req.body.otp);

        if (data.verified) {
            try {
                const io = getIO();
                io.to(`ride:${rideId}`).emit('ride:otp_verified', {
                    rideId,
                    verifiedAt: new Date().toISOString(),
                    message:    'OTP verified. Ride started!'
                });
                io.to(`ride:${rideId}`).emit('ride:status_changed', {
                    rideId,
                    status:    'started',
                    timestamp: new Date().toISOString()
                });
            } catch (sockErr) {
                logger.warn(`Socket emit failed (ride:otp_verified): ${sockErr.message}`);
            }
        }

        const status = data.verified ? 200 : 400;
        res.status(status).json({ success: data.verified, data });
    } catch (error) {
        next(error);
    }
};
