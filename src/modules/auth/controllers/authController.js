import * as authService from '../services/authService.js';
import logger from '../../../core/logger/logger.js';
import { sendResponse } from '../../../core/utils/response.js';
import * as userRepo from '../../users/repositories/user.repository.js';

export const signup = async (req, res, next) => {
    try {
        const { phone, email, fullName,role="passenger" } = req.body;

        const result = await authService.signup({
            phone,
            email,
            fullName,
            role
        });

        sendResponse(res, 200, 'OTP sent successfully', result);
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

        sendResponse(res, 201, 'Account created successfully', result);
    } catch (error) {
        next(error);
    }
};

// export const signin = async (req, res, next) => {
//     try {
//         const { phone,role } = req.body;

//         const result = await authService.signin(phone,role);

//         sendResponse(res, 200, 'OTP sent successfully', result);
//     } catch (error) {
//         next(error);
//     }
// };

// export const verifySignin = async (req, res, next) => {
//     try {
//         const { phone, otp,role } = req.body;
//         const { ip, userAgent } = req;

//         const result = await authService.verifySignin({
//             phone,
//             otp,
//             role,
//             ipAddress: ip,
//             userAgent
//         });

//         sendResponse(res, 200, 'Login successful', result);
//     } catch (error) {
//         next(error);
//     }
// };

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


export const signin = async (req, res, next) => {
    try {
        const { phone, email, role } = req.body;
        const result = await authService.signin(phone, email, role);
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
        const { phone, email, otp, role } = req.body;
        const result = await authService.verifySignin({
            phone, email, otp, role,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
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


export const logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        // ── Access token header se lo — blacklist ke liye ─────────────────────
        const authHeader  = req.headers.authorization || '';
        const accessToken = authHeader.startsWith('Bearer ')
            ? authHeader.split(' ')[1]
            : null;

        const result = await authService.logout(refreshToken, accessToken);

        sendResponse(res, 200, 'Logged out successfully', result);
    } catch (error) {
        next(error);
    }
};

export const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        const result = await authService.refreshToken(refreshToken);

        sendResponse(res, 200, 'Token refreshed successfully', result);
    } catch (error) {
        next(error);
    }
};

export const me = async (req, res, next) => {
    try {
        sendResponse(res, 200, '', { user: req.user });
    } catch (error) {
        next(error);
    }
};



export const updateFcmToken = async (req, res, next) => {
    try {
        const { fcm_token } = req.body;
        if (!fcm_token) {
            return res.status(400).json({ success: false, message: 'FCM token required' });
        }
        await userRepo.updateUser(req.user.id, { fcm_token });
        res.status(200).json({ success: true, message: 'FCM token updated successfully' });
    } catch (error) {
        next(error);
    }
};