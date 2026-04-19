import { pool } from '../../infrastructure/database/postgres.js';
import logger from '../logger/logger.js';

const INSERT_SQL = `
    INSERT INTO api_logs
        (module, method, path, status_code, user_id, ip_address, user_agent,
         request_body, request_params, request_query, response_body,
         duration_ms, is_error, error_message)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
`;

// Sensitive fields jo request body se hataane hain
const SENSITIVE_KEYS = new Set(['password', 'otp', 'pin', 'token', 'secret', 'cvv', 'card_number']);

function sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
        clean[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '***' : v;
    }
    return clean;
}

export async function insertApiLog({
    module, method, path, statusCode, userId, ip, userAgent,
    requestBody, requestParams, requestQuery, responseBody,
    durationMs, isError, errorMessage,
}) {
    try {
        await pool.query(INSERT_SQL, [
            module,
            method,
            path,
            statusCode,
            userId || null,
            ip || null,
            userAgent || null,
            JSON.stringify(sanitize(requestBody)   ?? {}),
            JSON.stringify(sanitize(requestParams) ?? {}),
            JSON.stringify(sanitize(requestQuery)  ?? {}),
            JSON.stringify(responseBody            ?? {}),
            durationMs || null,
            isError    ?? false,
            errorMessage || null,
        ]);
    } catch (err) {
        // Logging fail hone par API response block nahi hona chahiye
        logger.warn('api_logs insert failed:', err.message);
    }
}
