import * as otpService from '../services/rideOtpService.js';

export const verifyOtp = async (req, res, next) => {
    try {
        const data = await otpService.verifyRideOTP(parseInt(req.params.rideId), req.body.otp);
        const status = data.verified ? 200 : 400;
        res.status(status).json({ success: data.verified, data });
    } catch (error) { next(error); }
};
