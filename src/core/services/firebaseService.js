import admin from 'firebase-admin';
import logger from '../logger/logger.js';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId:   process.env.FIREBASE_PROJECT_ID,
            privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
    });
}

export const sendNotification = async (fcmToken, title, body, data = {}) => {
    try {
        if (!fcmToken) return;
        await admin.messaging().send({
            token:        fcmToken,
            notification: { title, body },
            data,
            android: { priority: 'high' },
            apns:    { payload: { aps: { sound: 'default' } } },
        });
        logger.info(`FCM sent: ${title}`);
    } catch (error) {
        logger.error('FCM error:', error.message);
    }
};