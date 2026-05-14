import jwt from 'jsonwebtoken';
import { ENV } from '../../../config/envConfig.js';
import { AuthError } from '../../../core/errors/ApiError.js';

export const generateAccessToken = (user) => {
    const expiresIn = user.role === 'driver' ? '7d' : '30d';
    return jwt.sign(
        {
            id: user.id,
            phone: user.phone_number,
            role: user.role,
            type: 'access'
        },
        ENV.JWT_SECRET,
        {
            expiresIn,
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
        console.log(error)
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