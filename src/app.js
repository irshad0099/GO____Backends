


import express from 'express';
import { ENV } from './config/envConfig.js';
import routes from './routes/index.js';

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

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.url}`
    });
});

export default app;