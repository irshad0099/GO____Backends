import logger from '../logger/logger.js';
import { ENV } from '../../config/envConfig.js';
import { ApiError } from './ApiError.js';  // ✅ Import ApiError

export const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;

    logger.error({
        message: err.message,
        stack: err.stack,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        ip: req.ip
    });

    if (err.statusCode === 500) {
        return res.status(500).json({
            success: false,
            statuscode: 500,
            message: ENV.NODE_ENV === 'development' ? err.message : 'Something went wrong',
            data: {},
        });
    }

    return res.status(err.statusCode).json({
        success: false,
        statuscode: err.statusCode,
        message: err.message,
        errorFull: err.errors?.length ? err.errors : undefined,
        data: {},
    });
};

export const notFoundHandler = (req, res, next) => {
    const error = new ApiError(404, `Can't find ${req.method} ${req.originalUrl} on this server`);
    next(error);
};