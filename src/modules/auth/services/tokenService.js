import jwt from 'jsonwebtoken';
import { ENV } from '../../../config/envConfig.js';
import { AuthError } from '../../../core/errors/ApiError.js';

export const generateAccessToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            phone: user.phone_number,
            role: user.role,
            type: 'access'
        },
        ENV.JWT_SECRET,
        {
            expiresIn: ENV.JWT_ACCESS_EXPIRY,
            algorithm: 'HS256'
        }
    );
};

export const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            type: 'refresh'
        },
        ENV.JWT_REFRESH_SECRET,
        {
            expiresIn: ENV.JWT_REFRESH_EXPIRY,
            algorithm: 'HS256'
        }
    );
};

export const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, ENV.JWT_SECRET, {
            algorithms: ['HS256']
        });
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new AuthError('Token expired', 401);
        }
        if (error.name === 'JsonWebTokenError') {
            throw new AuthError('Invalid token', 401);
        }
        throw error;
    }
};

export const decodeToken = (token) => {
    return jwt.decode(token);
};