import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import hpp from 'hpp';
import { ENV } from './config/envConfig.js';
import routes from './routes/index.js';
import { requestIdMiddleware, requestLoggingMiddleware } from './core/middleware/requestId.middleware.js';

const app = express();

console.log('✅ App created');
console.log(`API Prefix: "${ENV.API_PREFIX}"`);

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

// CORS configuration
app.use(cors({
    origin: ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// Compression middleware
app.use(compression());

// HTTP Parameter Pollution protection
app.use(hpp());

// Body parser with size limit
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request ID tracking (must be before request logging)
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);

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

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.url}`
    });
});

export default app;