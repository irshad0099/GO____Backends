import * as userRepo from '../repositories/user.repository.js';
import * as rideRepo from '../../rides/repositories/ride.repository.js';
import * as walletRepo from '../../wallet/repositories/wallet.repository.js';
import { NotFoundError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

export const getUserProfile = async (userId) => {
    try {
        const user = await userRepo.findUserById(userId);
        
        if (!user) {
            throw new NotFoundError('User');
        }

        return {
            id: user.id,
            phone: user.phone_number,
            email: user.email,
            fullName: user.full_name,
            profilePicture: user.profile_picture,
            role: user.role,
            isVerified: user.is_verified,
            isActive: user.is_active,
            lastLogin: user.last_login,
            createdAt: user.created_at,
            updatedAt: user.updated_at
        };
    } catch (error) {
        logger.error('Get user profile service error:', error);
        throw error;
    }
};

export const updateUserProfile = async (userId, updates) => {
    try {
        // Validate allowed fields
        const allowedUpdates = ['email', 'full_name'];
        const filteredUpdates = {};
        
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                filteredUpdates[key] = updates[key];
            }
        });

        if (Object.keys(filteredUpdates).length === 0) {
            return await getUserProfile(userId);
        }

        const updatedUser = await userRepo.updateUser(userId, filteredUpdates);
        
        if (!updatedUser) {
            throw new NotFoundError('User');
        }

        return {
            id: updatedUser.id,
            phone: updatedUser.phone_number,
            email: updatedUser.email,
            fullName: updatedUser.full_name,
            profilePicture: updatedUser.profile_picture,
            role: updatedUser.role,
            isVerified: updatedUser.is_verified
        };
    } catch (error) {
        logger.error('Update user profile service error:', error);
        throw error;
    }
};

export const uploadProfilePicture = async (userId, file) => {
    try {
        if (!file) {
            throw new Error('No file uploaded');
        }

        // Generate file URL (in production, upload to cloud storage)
        const profilePictureUrl = `/uploads/${file.filename}`;

        const updatedUser = await userRepo.updateUser(userId, {
            profile_picture: profilePictureUrl
        });

        return {
            profilePicture: updatedUser.profile_picture
        };
    } catch (error) {
        logger.error('Upload profile picture service error:', error);
        throw error;
    }
};

export const getUserRideHistory = async (userId, { page = 1, limit = 10 }) => {
    try {
        const offset = (page - 1) * limit;
        
        const rides = await rideRepo.findRidesByPassenger(userId, {
            limit,
            offset,
            orderBy: 'requested_at',
            orderDir: 'DESC'
        });

        const total = await rideRepo.countRidesByPassenger(userId);

        return {
            rides: rides.map(ride => ({
                id: ride.id,
                rideNumber: ride.ride_number,
                vehicleType: ride.vehicle_type,
                pickupAddress: ride.pickup_address,
                dropoffAddress: ride.dropoff_address,
                distanceKm: ride.distance_km,
                durationMinutes: ride.duration_minutes,
                estimatedFare: ride.estimated_fare,
                actualFare: ride.actual_fare,
                status: ride.status,
                paymentStatus: ride.payment_status,
                requestedAt: ride.requested_at,
                completedAt: ride.completed_at,
                driverName: ride.driver_name,
                driverPhone: ride.driver_phone,
                driverRating: ride.driver_rating
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('Get user ride history service error:', error);
        throw error;
    }
};

export const getUserWallet = async (userId) => {
    try {
        let wallet = await walletRepo.findWalletByUserId(userId);
        
        if (!wallet) {
            // Create wallet if not exists
            wallet = await walletRepo.createWallet(userId);
        }

        return {
            balance: wallet.balance,
            totalCredited: wallet.total_credited,
            totalDebited: wallet.total_debited,
            lastTransactionAt: wallet.last_transaction_at
        };
    } catch (error) {
        logger.error('Get user wallet service error:', error);
        throw error;
    }
};

export const deleteAccount = async (userId) => {
    try {
        // Active ride hai to delete nahi hoga
        const activeRide = await rideRepo.findActiveRideByPassenger(userId);
        if (activeRide) throw new Error('Cannot delete account during an active ride');

        await userRepo.softDeleteUser(userId);
        return { message: 'Account deleted successfully' };
    } catch (error) {
        logger.error('Delete account service error:', error);
        throw error;
    }
};

export const addMoneyToWallet = async (userId, amount, paymentMethod) => {
    try {
        // Validate amount
        if (amount < 10) {
            throw new Error('Minimum amount to add is ₹10');
        }

        if (amount > 10000) {
            throw new Error('Maximum amount to add is ₹10,000');
        }

        // Process payment (integrate with payment gateway)
        // For now, simulate successful payment
        const transaction = await walletRepo.addMoney(userId, amount, paymentMethod);

        return {
            transactionId: transaction.id,
            transactionNumber: transaction.transaction_number,
            amount: transaction.amount,
            type: transaction.type,
            category: transaction.category,
            status: transaction.status,
            createdAt: transaction.created_at,
            newBalance: transaction.new_balance
        };
    } catch (error) {
        logger.error('Add money to wallet service error:', error);
        throw error;
    }
};