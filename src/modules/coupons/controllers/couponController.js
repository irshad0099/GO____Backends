import * as couponService from '../services/couponService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getAvailable = async (req, res, next) => {
    try {
        const { vehicleType } = req.query;
        const data = await couponService.getAvailableCoupons(vehicleType);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const applyCoupon = async (req, res, next) => {
    try {
        const { code, ride_amount, vehicle_type } = req.body;
        const data = await couponService.applyCoupon(req.user.id, code, ride_amount, vehicle_type);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};
