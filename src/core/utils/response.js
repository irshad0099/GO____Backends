/**
 * Standard API response helper
 * Format: { success, statuscode, message, data }
 */

export const sendResponse = (res, statusCode, message, data = null) => {
    const payload = Array.isArray(data) ? data : (data ?? {});
    return res.status(statusCode).json({
        success: true,
        statuscode: statusCode,
        message,
        data: payload,
    });
};

export const sendError = (res, statusCode, message, data = null) => {
    const payload = Array.isArray(data) ? data : (data ?? {});
    return res.status(statusCode).json({
        success: false,
        statuscode: statusCode,
        message,
        data: payload,
    });
};
