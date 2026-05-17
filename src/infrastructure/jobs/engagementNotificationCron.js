import cron from 'node-cron';
import logger from '../../core/logger/logger.js';
import {
    sendPassengerEngagementNotifications,
    sendDriverEngagementNotifications,
} from '../../core/services/engagementNotificationService.js';

let cronJobs = [];

// ─── Cron Job Schedule ───────────────────────────────────────────────────────────
// Every day at:
// - 8:00 AM (Morning)
// - 1:00 PM (Afternoon/Lunch)
// - 6:00 PM (Evening/Rush Hour)

const MORNING_TIME = '0 8 * * *';      // 8 AM
const AFTERNOON_TIME = '0 13 * * *';   // 1 PM
const EVENING_TIME = '0 18 * * *';     // 6 PM

export const initEngagementNotificationCrons = () => {
    logger.info('⏰ Initializing engagement notification cron jobs...');

    // Morning notification job
    const morningJob = cron.schedule(MORNING_TIME, async () => {
        logger.info('🌅 Running morning engagement notification job...');
        try {
            const result = await sendPassengerEngagementNotifications();
            logger.info('✅ Morning passenger notifications completed', result);

            const driverResult = await sendDriverEngagementNotifications();
            logger.info('✅ Morning driver notifications completed', driverResult);
        } catch (error) {
            logger.error('❌ Morning notification job failed:', error.message);
        }
    });

    // Afternoon notification job
    const afternoonJob = cron.schedule(AFTERNOON_TIME, async () => {
        logger.info('☀️ Running afternoon engagement notification job...');
        try {
            const result = await sendPassengerEngagementNotifications();
            logger.info('✅ Afternoon passenger notifications completed', result);

            const driverResult = await sendDriverEngagementNotifications();
            logger.info('✅ Afternoon driver notifications completed', driverResult);
        } catch (error) {
            logger.error('❌ Afternoon notification job failed:', error.message);
        }
    });

    // Evening notification job
    const eveningJob = cron.schedule(EVENING_TIME, async () => {
        logger.info('🌆 Running evening engagement notification job...');
        try {
            const result = await sendPassengerEngagementNotifications();
            logger.info('✅ Evening passenger notifications completed', result);

            const driverResult = await sendDriverEngagementNotifications();
            logger.info('✅ Evening driver notifications completed', driverResult);
        } catch (error) {
            logger.error('❌ Evening notification job failed:', error.message);
        }
    });

    cronJobs.push(morningJob, afternoonJob, eveningJob);
    logger.info('✅ Engagement notification crons initialized successfully');

    return {
        morning: morningJob,
        afternoon: afternoonJob,
        evening: eveningJob,
    };
};

export const stopEngagementNotificationCrons = () => {
    logger.info('Stopping engagement notification cron jobs...');
    cronJobs.forEach(job => {
        if (job) job.stop();
    });
    cronJobs = [];
    logger.info('✅ All engagement notification crons stopped');
};

// Manual trigger for testing
export const triggerEngagementNotifications = async () => {
    logger.info('🧪 Manually triggering engagement notifications for testing...');
    try {
        const passengerResult = await sendPassengerEngagementNotifications();
        const driverResult = await sendDriverEngagementNotifications();

        return {
            success: true,
            passengers: passengerResult,
            drivers: driverResult,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        logger.error('Manual trigger failed:', error);
        throw error;
    }
};
