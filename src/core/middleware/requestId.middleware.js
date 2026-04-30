import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID middleware - adds unique ID to each request for tracing
 */
export const requestIdMiddleware = (req, res, next) => {
    // Generate or use existing request ID
    req.id = req.headers['x-request-id'] || uuidv4();
    
    // Set response header
    res.setHeader('X-Request-ID', req.id);
    
    // Add start time for request duration tracking
    req.startTime = Date.now();
    
    next();
};

/**
 * Request logging middleware with request ID
 */
export const requestLoggingMiddleware = (req, res, next) => {
    const startTime = req.startTime || Date.now();
    
    // Log request
    console.log(`[${req.id}] 📨 ${req.method} ${req.url} - ${req.ip}`);
    
    // Capture response finish
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 400 ? '❌' : '✅';
        console.log(`[${req.id}] ${logLevel} ${res.statusCode} - ${duration}ms`);
    });
    
    next();
};
