import express from 'express';
import { triggerEngagementNotifications } from '../../../core/services/engagementNotificationService.js';
import { authenticateToken } from '../../../core/middleware/auth.middleware.js';
import { isAdmin } from '../../../core/middleware/roleMiddleware.js';
import logger from '../../../core/logger/logger.js';

const router = express.Router();

// ─── Admin only endpoint to manually trigger engagement notifications ─────────────
router.post(
    '/trigger-engagement',
    authenticateToken,
    isAdmin,
    async (req, res) => {
        try {
            logger.info('🧪 Manual engagement notification trigger requested by admin');
            const result = await triggerEngagementNotifications();

            return res.status(200).json({
                success: true,
                message: 'Engagement notifications triggered successfully',
                data: result,
            });
        } catch (error) {
            logger.error('Error triggering engagement notifications:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to trigger engagement notifications',
                error: error.message,
            });
        }
    }
);

// ─── Get notification schedule info ──────────────────────────────────────────────
router.get(
    '/schedule',
    authenticateToken,
    isAdmin,
    async (req, res) => {
        try {
            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();

            const schedule = {
                currentTime: now.toISOString(),
                hour: hour,
                day: day === 0 ? 'Sunday' : day === 6 ? 'Saturday' : 'Weekday',
                isWeekend: day === 0 || day === 6,
                notificationTimes: {
                    morning: '8:00 AM (IST)',
                    afternoon: '1:00 PM (IST)',
                    evening: '6:00 PM (IST)',
                },
                nextScheduledNotification: calculateNextNotificationTime(),
            };

            return res.status(200).json({
                success: true,
                data: schedule,
            });
        } catch (error) {
            logger.error('Error getting schedule:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get schedule',
                error: error.message,
            });
        }
    }
);

// Helper function to calculate next notification time
const calculateNextNotificationTime = () => {
    const now = new Date();
    const times = [8, 13, 18]; // 8 AM, 1 PM, 6 PM

    for (const hour of times) {
        const nextTime = new Date(now);
        nextTime.setHours(hour, 0, 0, 0);

        if (nextTime > now) {
            return nextTime.toISOString();
        }
    }

    // If all times passed today, return next morning
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    return tomorrow.toISOString();
};

export default router;
