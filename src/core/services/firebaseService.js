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

// Firebase requires ALL data values to be strings
const stringifyData = (data = {}) => {
    const result = {};
    for (const [key, val] of Object.entries(data)) {
        result[key] = val === null || val === undefined ? '' : String(val);
    }
    return result;
};

export const sendNotification = async (fcmToken, title, body, data = {}) => {
    try {
        if (!fcmToken) return;
        if (!firebaseInitialized) {
            logger.warn('FCM not available - Firebase not initialized');
            return;
        }
        const message = {
            token:        fcmToken,
            notification: { title: String(title), body: String(body) },
            data:         stringifyData(data),
            android: {
                priority: 'high',
                notification: { sound: 'default' },
            },
            apns: {
                payload: { aps: { sound: 'default', contentAvailable: true } },
            },
        };
        const response = await admin.messaging().send(message);
        logger.info(`✅ FCM sent: ${title} | messageId: ${response}`);
    } catch (error) {
        logger.error(`❌ FCM error: ${error.message} | title: ${title} | token: ${fcmToken?.slice(-10)}`);
    }
};