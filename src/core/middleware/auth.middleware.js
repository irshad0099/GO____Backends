import { AuthError } from '../errors/ApiError.js';
import { verifyToken } from '../../modules/auth/services/tokenService.js';
import { findUserById } from '../../modules/users/repositories/user.repository.js';
import logger from '../logger/logger.js';

export const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        console.log(token," jejbvrfjk")
        if (!token) {
            throw new AuthError('No token provided', 401);
        }

        // Verify token
        const decoded = verifyToken(token);
        
        // Get user from database
        const user = await findUserById(decoded.userId);
        
        if (!user) {
            throw new AuthError('User not found', 401);
        }

        if (!user.is_active) {
            throw new AuthError('Account is deactivated', 403);
        }

        // Attach user to request
        req.user = user;
        req.userId = user.id;
        
        next();
    } catch (error) {
        logger.error('Authentication failed:', error);
        
        if (error.name === 'TokenExpiredError') {
            return next(new AuthError('Token expired', 401));
        }
        if (error.name === 'JsonWebTokenError') {
            return next(new AuthError('Invalid token', 401));
        }
        
        next(error);
    }
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AuthError('Unauthorized', 401));
        }

        if (!roles.includes(req.user.role)) {
            return next(new AuthError('You do not have permission to access this resource', 403));
        }

        next();
    };
};

export const optionalAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (token) {
            const decoded = verifyToken(token);
            const user = await findUserById(decoded.userId);
            if (user && user.is_active) {
                req.user = user;
                req.userId = user.id;
            }
        }
        
        next();
    } catch (error) {
        // Continue even if auth fails
        next();
    }
};