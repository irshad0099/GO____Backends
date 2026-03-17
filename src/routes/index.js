import express from 'express';
import authRoutes from '../modules/auth/routes/authRoutes.js';
import userRoutes from '../modules/users/routes/userRoutes.js';
import driverRoutes from '../modules/drivers/routes/driverRoutes.js';
import rideRoutes from '../modules/rides/routes/rideRoutes.js';
import walletRoutes from '../modules/wallet/routes/walletRoutes.js';
import subscriptionRoutes from '../modules/subscription/routes/subscriptionRoutes.js';

const router = express.Router();

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/drivers', driverRoutes);
router.use('/rides', rideRoutes);
router.use('/wallet', walletRoutes);
router.use('/subscriptions', subscriptionRoutes);

// Health check
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Test route
router.get('/test', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API test route working',
        timestamp: new Date().toISOString()
    });
});

// Root route
router.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        name: 'GoMobility API',
        version: '1.0.0',
        endpoints: {
            auth: '/auth',
            users: '/users',
            drivers: '/drivers',
            rides: '/rides',
            wallet: '/wallet',
            subscriptions: '/subscriptions',
            health: '/health',
            test: '/test'
        }
    });
});

// 404 handler - MUST BE LAST (without '*')
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.originalUrl}`
    });
});

export default router;