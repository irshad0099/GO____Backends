import admin from 'firebase-admin';
import logger from '../logger/logger.js';
import { ENV } from '../../config/envConfig.js';

let firebaseInitialized = false;

if (!admin.apps.length && ENV.FIREBASE_PROJECT_ID && ENV.FIREBASE_PRIVATE_KEY && ENV.FIREBASE_CLIENT_EMAIL) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId:   ENV.FIREBASE_PROJECT_ID,
                privateKey:  ENV.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                clientEmail: ENV.FIREBASE_CLIENT_EMAIL,
            }),
        });
        firebaseInitialized = true;
        logger.info('🔥 Firebase initialized successfully');
    } catch (error) {
        logger.warn('⚠️ Firebase initialization failed:', error.message);
    }
} else if (!ENV.FIREBASE_PROJECT_ID || !ENV.FIREBASE_PRIVATE_KEY || !ENV.FIREBASE_CLIENT_EMAIL) {
    logger.warn('⚠️ Firebase credentials not found in environment variables - FCM notifications disabled');
}

export const sendNotification = async (fcmToken, title, body, data = {}) => {
    try {
        if (!fcmToken) return;
        if (!firebaseInitialized) {
            logger.warn('FCM not available - Firebase not initialized');
            return;
        }
        await admin.messaging().send({
            token:        fcmToken,
            notification: { title, body },
            data,
            android: { priority: 'high' },
            apns:    { payload: { aps: { sound: 'default' } } },
        });
        logger.info(`✅ FCM sent: ${title}`);
    } catch (error) {
        logger.error('❌ FCM error:', error.message);
    }
};