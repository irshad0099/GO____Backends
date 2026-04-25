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

/**
 * Validation error response helper.
 * `errorFull` is the array of { field, message } items.
 * The top-level `message` is the first item's message so clients can show it directly.
 */
export const sendValidationError = (res, errorFull = [], fallbackMessage = 'Validation failed') => {
    const list = Array.isArray(errorFull) ? errorFull : [];
    return res.status(400).json({
        success: false,
        statuscode: 400,
        message: list[0]?.message || fallbackMessage,
        errorFull: list.length ? list : undefined,
        data: {},
    });
};
