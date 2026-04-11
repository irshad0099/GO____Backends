import * as authService from '../services/authService.js';
import logger from '../../../core/logger/logger.js';

export const signup = async (req, res, next) => {
    try {
        const { phone, email, fullName,role="passenger" } = req.body;
        
        const result = await authService.signup({
            phone,
            email,
            fullName,
            role
        });

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const verifySignup = async (req, res, next) => {
    try {
        const { phone, otp, email, fullName,role } = req.body;
        
        const result = await authService.verifySignup({
            phone,
            otp,
            email,
            fullName,
            role
        });

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const signin = async (req, res, next) => {
    try {
        const { phone,role } = req.body;
        
        const result = await authService.signin(phone,role);

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const verifySignin = async (req, res, next) => {
    try {
        const { phone, otp,role } = req.body;
        const { ip, userAgent } = req;
        
        const result = await authService.verifySignin({
            phone,
            otp,
            role,
            ipAddress: ip,
            userAgent
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

// export const logout = async (req, res, next) => {
//     try {
//         const { refreshToken } = req.body;
        
//         const result = await authService.logout(refreshToken);

//         res.status(200).json({
//             success: true,
//             message: 'Logged out successfully',
//             data: result
//         });
//     } catch (error) {
//         next(error);
//     }
// };


export const logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
 
        // ── Access token header se lo — blacklist ke liye ─────────────────────
        const authHeader  = req.headers.authorization || '';
        const accessToken = authHeader.startsWith('Bearer ')
            ? authHeader.split(' ')[1]
            : null;
 
        const result = await authService.logout(refreshToken, accessToken);
 
        res.status(200).json({
            success: true,
            message: 'Logged out successfully',
            data:    result
        });
    } catch (error) {
        next(error);
    }
};

export const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        
        const result = await authService.refreshToken(refreshToken);

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const me = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            data: {
                user: req.user
            }
        });
    } catch (error) {
        next(error);
    }
};