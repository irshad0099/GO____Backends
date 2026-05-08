import { AuthError } from '../errors/ApiError.js';
import { verifyToken, generateAccessToken } from '../../modules/auth/services/tokenService.js';
import { findUserById } from '../../modules/users/repositories/user.repository.js';
import { findSession, updateSessionToken } from '../../modules/auth/repositories/sessionRepository.js';
import logger from '../logger/logger.js';
import { isTokenBlacklisted } from '../services/redisService.js';

export const authenticate = async (req, res, next) => {
    try {
        let token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            throw new AuthError('No token provided', 401);
        }

        // ── Blacklist check — Redis down hone pe allow karo (JWT still valid) ──
        try {
            const blacklisted = await isTokenBlacklisted(token);
            if (blacklisted) {
                throw new AuthError('Token has been revoked. Please login again.', 401);
            }
        } catch (blErr) {
            if (blErr instanceof AuthError) throw blErr;
            // Redis error — silently allow (JWT is still cryptographically valid)
            logger.warn('⚠️ Redis blacklist check failed, allowing request:', blErr.message);
        }

        // Verify token
        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                throw new AuthError('Token expired', 401);
            }
            if (err.name === 'JsonWebTokenError') {
                throw new AuthError('Invalid token', 401);
            }
            throw err;
        }

        // ── Database check — Ensure token is in sessions table ──
        const session = await findSession(token);
        if (!session) {
            throw new AuthError('Session invalid or expired. Please login again.', 401);
        }

        // Get user from database
        const user = await findUserById(decoded.userId);

        if (!user) {
            throw new AuthError('User not found', 401);
        }

        if (!user.is_active) {
            throw new AuthError('Account is deactivated', 403);
        }

        // ── Auto-Rotation Logic ──
        // Check if token expires in less than 6 hours
        const timeRemaining = (decoded.exp * 1000) - Date.now();
        const sixHours = 6 * 60 * 60 * 1000;
        
        if (timeRemaining < sixHours && timeRemaining > 0) {
            // Generate new token
            const newToken = generateAccessToken(user);
            // Update the session in database
            await updateSessionToken(token, newToken);
            // Set header for client to update token
            res.setHeader('x-new-access-token', newToken);
            res.setHeader('Access-Control-Expose-Headers', 'x-new-access-token');
            // update token variable for subsequent use
            token = newToken;
            logger.info(`Access token rotated for user ${user.id}`);
        }

        // Attach user to request
        req.user   = user;
        req.userId = user.id;
        req.token  = token;

        next();
    } catch (error) {
        logger.error('Authentication failed:', error);
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
            // Blacklist check — Redis fail pe skip karo
            try {
                const blacklisted = await isTokenBlacklisted(token);
                if (blacklisted) return next(); // blacklisted = treat as unauthenticated
            } catch { /* Redis down — skip check */ }

            const decoded = verifyToken(token);
            
            // DB session check
            const session = await findSession(token);
            if (!session) return next();

            const user    = await findUserById(decoded.userId);
            if (user && user.is_active) {
                req.user   = user;
                req.userId = user.id;
                req.token  = token;
            }
        }

        next();
    } catch (error) {
        next();
    }
};