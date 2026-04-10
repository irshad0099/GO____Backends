
// import express from 'express';
// import authRoutes from '../modules/auth/routes/authRoutes.js';
// import userRoutes from '../modules/users/routes/userRoutes.js';
// import driverRoutes from '../modules/drivers/routes/driverRoutes.js';
// import rideRoutes from '../modules/rides/routes/rideRoutes.js';
// import walletRoutes from '../modules/wallet/routes/walletRoutes.js';
// import subscriptionRoutes from '../modules/subscription/routes/subscriptionRoutes.js';

// const router = express.Router();

// // API routes
// router.use('/auth', authRoutes);
// router.use('/users', userRoutes);
// router.use('/drivers', driverRoutes);
// router.use('/rides', rideRoutes);
// router.use('/wallet', walletRoutes);
// router.use('/subscriptions', subscriptionRoutes);

// // Health check
// router.get('/health', (req, res) => {
//     res.status(200).json({
//         success: true,
//         message: 'Server is running',
//         timestamp: new Date().toISOString(),
//         environment: process.env.NODE_ENV || 'development'
//     });
// });

// // Test route
// router.get('/test', (req, res) => {
//     res.status(200).json({
//         success: true,
//         message: 'API test route working',
//         timestamp: new Date().toISOString()
//     });
// });

// // Root route
// router.get('/', (req, res) => {
//     res.status(200).json({
//         success: true,
//         name: 'GoMobility API',
//         version: '1.0.0',
//         endpoints: {
//             auth: '/auth',
//             users: '/users',
//             drivers: '/drivers',
//             rides: '/rides',
//             wallet: '/wallet',
//             subscriptions: '/subscriptions',
//             health: '/health',
//             test: '/test'
//         }
//     });
// });

// // 404 handler - MUST BE LAST (without '*')
// router.use((req, res) => {
//     res.status(404).json({
//         success: false,
//         message: `Cannot ${req.method} ${req.originalUrl}`
//     });
// });

// export default router;


import express from 'express';

// ─── Existing Routes ──────────────────────────────────────────────────────────
import authRoutes         from '../modules/auth/routes/authRoutes.js';
import userRoutes         from '../modules/users/routes/userRoutes.js';
import driverRoutes       from '../modules/drivers/routes/driverRoutes.js';
import rideRoutes         from '../modules/rides/routes/rideRoutes.js';
import walletRoutes       from '../modules/wallet/routes/walletRoutes.js';
import subscriptionRoutes from '../modules/subscription/routes/subscriptionRoutes.js';

// ─── New Routes ───────────────────────────────────────────────────────────────
import paymentRoutes      from '../modules/payments/routes/paymentRoutes.js';
import pricingRoutes      from '../modules/pricing/routes/pricingRoutes.js';
import reviewRoutes       from '../modules/review/routes/reviewRoutes.js';

// ─── Passenger New Feature Routes ─────────────────────────────────────────────
import sosRoutes          from '../modules/sos/routes/sosRoutes.js';
import couponRoutes       from '../modules/coupons/routes/couponRoutes.js';
import supportRoutes      from '../modules/support/routes/supportRoutes.js';
import kycRoutes          from '../modules/kyc/routes/kycRoutes.js';
import driverKycRoutes    from '../modules/drivers/routes/driverKycRoutes.js';

const router = express.Router();

// ─── API Routes ───────────────────────────────────────────────────────────────
router.use('/auth',          authRoutes);
router.use('/users',         userRoutes);
router.use('/drivers',       driverRoutes);
router.use('/rides',         rideRoutes);
router.use('/wallet',        walletRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/payments',      paymentRoutes);
router.use('/pricing',       pricingRoutes);
router.use('/reviews',       reviewRoutes);
router.use('/sos',           sosRoutes);
router.use('/coupons',       couponRoutes);
router.use('/support',       supportRoutes);
router.use('/kyc',           kycRoutes);
router.use('/driver-kyc',    driverKycRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
    res.status(200).json({
        success:     true,
        message:     'Server is running',
        timestamp:   new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ─── Test Route ───────────────────────────────────────────────────────────────
router.get('/test', (req, res) => {
    res.status(200).json({
        success:   true,
        message:   'API test route working',
        timestamp: new Date().toISOString()
    });
});

// ─── Root Route ───────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        name:    'GoMobility API',
        version: '1.0.0',
        endpoints: {
            auth:          '/auth',
            users:         '/users',
            drivers:       '/drivers',
            rides:         '/rides',
            wallet:        '/wallet',
            subscriptions: '/subscriptions',
            payments:      '/payments',
            pricing:       '/pricing',
            reviews:       '/reviews',
            health:        '/health',
            test:          '/test'
        }
    });
});

// ─── 404 Handler — MUST BE LAST ───────────────────────────────────────────────
router.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.originalUrl}`
    });
});

export default router;
