import { insertApiLog } from '../repositories/apiLog.repository.js';
import { ENV } from '../../config/envConfig.js';

// URL path se module detect karna — /api/v1/auth/... → 'auth'
function detectModule(url, prefix) {
    const stripped = url.startsWith(prefix) ? url.slice(prefix.length) : url;
    const segment = stripped.split('?')[0].split('/').filter(Boolean)[0];
    return segment || 'unknown';
}

export function apiLoggerMiddleware(req, res, next) {
    const startAt = Date.now();
    const originalJson = res.json.bind(res);

    res.json = function (body) {
        const durationMs  = Date.now() - startAt;
        const statusCode  = res.statusCode || 200;
        const isError     = statusCode >= 400;
        const module      = detectModule(req.originalUrl, ENV.API_PREFIX);

        // Fire-and-forget — API response block nahi hogi
        setImmediate(() => {
            insertApiLog({
                module,
                method:        req.method,
                path:          req.originalUrl,
                statusCode,
                userId:        req.user?.id || req.user?.user_id || null,
                ip:            req.ip || req.socket?.remoteAddress,
                userAgent:     req.headers?.['user-agent'],
                requestBody:   req.body,
                requestParams: req.params,
                requestQuery:  req.query,
                responseBody:  body,
                durationMs,
                isError,
                errorMessage:  isError ? (body?.message || null) : null,
            });
        });

        return originalJson(body);
    };

    next();
}
