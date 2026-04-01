import * as couponRepo from '../repositories/coupon.repository.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

export const getAvailableCoupons = async (vehicleType) => {
    try {
        return await couponRepo.findAvailable(vehicleType);
    } catch (error) {
        logger.error('Get available coupons service error:', error);
        throw error;
    }
};

export const applyCoupon = async (userId, code, rideAmount, vehicleType) => {
    try {
        const coupon = await couponRepo.findByCode(code);
        if (!coupon) throw new ApiError(404, 'Invalid coupon code');

        // Active check
        if (!coupon.is_active) throw new ApiError(400, 'This coupon is no longer active');

        // Validity check
        const now = new Date();
        if (now < new Date(coupon.valid_from) || now > new Date(coupon.valid_until)) {
            throw new ApiError(400, 'This coupon has expired');
        }

        // Total usage check
        if (coupon.max_uses_total && coupon.current_uses >= coupon.max_uses_total) {
            throw new ApiError(400, 'This coupon has reached its usage limit');
        }

        // Per-user usage check
        const userUsage = await couponRepo.getUserUsageCount(coupon.id, userId);
        if (userUsage >= coupon.max_uses_per_user) {
            throw new ApiError(400, 'You have already used this coupon');
        }

        // Vehicle type check
        if (vehicleType && coupon.vehicle_types && !coupon.vehicle_types.includes(vehicleType)) {
            throw new ApiError(400, `This coupon is not valid for ${vehicleType}`);
        }

        // Min ride amount check
        if (rideAmount < parseFloat(coupon.min_ride_amount)) {
            throw new ApiError(400, `Minimum ride amount of ₹${coupon.min_ride_amount} required`);
        }

        // First ride only check
        if (coupon.first_ride_only) {
            const isFirst = await couponRepo.isFirstRide(userId);
            if (!isFirst) throw new ApiError(400, 'This coupon is for first ride only');
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discount_type === 'percentage') {
            discount = (rideAmount * parseFloat(coupon.discount_value)) / 100;
            if (coupon.max_discount) {
                discount = Math.min(discount, parseFloat(coupon.max_discount));
            }
        } else {
            discount = parseFloat(coupon.discount_value);
        }
        discount = Math.min(discount, rideAmount); // Can't exceed ride amount

        return {
            couponId: coupon.id,
            code: coupon.code,
            discountType: coupon.discount_type,
            discountValue: parseFloat(coupon.discount_value),
            discountApplied: Math.round(discount * 100) / 100,
            originalAmount: rideAmount,
            finalAmount: Math.round((rideAmount - discount) * 100) / 100,
            message: `₹${discount.toFixed(0)} discount applied!`
        };
    } catch (error) {
        logger.error('Apply coupon service error:', error);
        throw error;
    }
};

// Mark coupon as used (ride complete hone ke baad call hoga)
export const recordUsage = async (couponId, userId, rideId, discountApplied, rideAmount) => {
    try {
        return await couponRepo.insertUsage({
            coupon_id: couponId, user_id: userId, ride_id: rideId,
            discount_applied: discountApplied, ride_amount: rideAmount
        });
    } catch (error) {
        logger.error('Record coupon usage service error:', error);
        throw error;
    }
};
