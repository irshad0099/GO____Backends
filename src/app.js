import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import hpp from 'hpp';
import { ENV } from './config/envConfig.js';
import routes from './routes/index.js';
import { globalErrorHandler, notFoundHandler } from './core/errors/globalErrorHandler.js';
import { apiLoggerMiddleware } from './core/middleware/apiLogger.middleware.js';

const app = express();

console.log('✅ App created');
console.log(`API Prefix: "${ENV.API_PREFIX}"`);

// Parse JSON — rawBody saved for webhook signature verification
app.use(express.json({
    verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// CORS configuration
app.use(cors({
    origin: ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// HTTP Parameter Pollution protection
app.use(hpp());

// Body parser with size limit
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// DB me har request/response log karo
app.use(apiLoggerMiddleware);

// Mount routes
console.log('🔄 Mounting routes...');
app.use(ENV.API_PREFIX, routes);
console.log('✅ Routes mounted');

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        prefix: ENV.API_PREFIX,
        endpoints: {
            test: '/test',
            health: '/health',
            signup: '/auth/signup',
            signin: '/auth/signin',
        }
    });
});

// 404 handler — routes ke baad, error handler se pehle
app.use(notFoundHandler);

// Global error handler — MUST be last middleware (4 args: err, req, res, next)
// Bina iske Express default HTML error page dikhata hai
app.use(globalErrorHandler);

export default app;