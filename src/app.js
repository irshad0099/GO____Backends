


import express from 'express';
import { ENV } from './config/envConfig.js';
import routes from './routes/index.js';
import { globalErrorHandler, notFoundHandler } from './core/errors/globalErrorHandler.js';

const app = express();

console.log('✅ App created');
console.log(`API Prefix: "${ENV.API_PREFIX}"`);

// Parse JSON
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.url}`);
    next();
});

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