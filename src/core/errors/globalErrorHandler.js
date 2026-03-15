import logger from '../logger/logger.js';
import { ENV } from '../../config/envConfig.js';
import { ApiError } from './ApiError.js';  // ✅ Import ApiError

export const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    logger.error({
        message: err.message,
        stack: err.stack,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        ip: req.ip
    });

    if (ENV.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            success: false,
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } else {
        if (err.isOperational) {
            res.status(err.statusCode).json({
                success: false,
                status: err.status,
                message: err.message
            });
        } else {
            res.status(500).json({
                success: false,
                status: 'error',
                message: 'Something went wrong'
            });
        }
    }
};

export const notFoundHandler = (req, res, next) => {
    const error = new ApiError(404, `Can't find ${req.method} ${req.originalUrl} on this server`);
    next(error);
};