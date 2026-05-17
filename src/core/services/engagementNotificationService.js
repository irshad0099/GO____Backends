import { db } from '../../infrastructure/database/postgres.js';
import { sendNotification } from './firebaseService.js';
import * as notificationService from '../../modules/notifications/services/notification.service.js';
import logger from '../logger/logger.js';

// ─── Engagement Messages (Funny, Motivational) ───────────────────────────────────

// Morning notifications (7-9 AM)
const MORNING_MESSAGES = {
    passenger: [
        { title: '🌅 Good Morning!', body: 'Ready for an adventure? Book a ride and earn rewards!' },
        { title: '☕ Rise & Shine!', body: 'Your morning commute just got easier - book a ride now!' },
        { title: '🚀 New Day, New Deals!', body: 'Check our special morning discounts!' },
        { title: '⚡ Early Bird Special', body: 'First ride of the day? Get 20% off!' },
        { title: '🎯 Start Your Day Right', body: 'Reliable rides, guaranteed punctuality!' },
    ],
    driver: [
        { title: '💰 Morning Rush Alert!', body: 'Peak demand in your area - more earnings waiting!' },
        { title: '🌅 Rise & Earn!', body: 'Morning commuters need you - go online!' },
        { title: '⚡ High Demand Zone', body: 'Bonus rides available now!' },
        { title: '🚗 Start Strong', body: 'First ride gets + 50 bonus points!' },
        { title: '📍 Hot Zone Active', body: 'Your area is hot! Start earning now!' },
    ]
};

// Afternoon notifications (12-2 PM)
const AFTERNOON_MESSAGES = {
    passenger: [
        { title: '🍽️ Lunch Break?', body: 'Grab lunch and our ride will get you there!' },
        { title: '☀️ Midday Special', body: '15% off on rides this afternoon only!' },
        { title: '⏰ Time to Move', body: 'Stuck in traffic? Book a ride now!' },
        { title: '🎉 Afternoon Treat', body: 'Earn double points with your next ride!' },
        { title: '🏃 Quick Ride?', body: 'Need to get somewhere? We\'re 3 min away!' },
    ],
    driver: [
        { title: '🍽️ Lunch Hour Surge!', body: 'High demand! Expected earnings ₹500+' },
        { title: '💵 Lunch Rush Incoming', body: 'Get ready for afternoon peak!' },
        { title: '📈 Surge Multiplier Active', body: '1.5x earnings for next 30 mins!' },
        { title: '⏰ Perfect Time to Earn', body: 'Average 4 rides in next 2 hours!' },
        { title: '🎯 Hot Spot Alert', body: 'Mall area: High demand zone!' },
    ]
};

// Evening notifications (5-7 PM)
const EVENING_MESSAGES = {
    passenger: [
        { title: '🌆 Ready to Head Home?', body: 'Book now and beat the traffic!' },
        { title: '⚡ Evening Commute', body: 'Premium drivers available - book now!' },
        { title: '🎊 Happy Hour!', body: 'Extra rewards on rides this evening!' },
        { title: '🏠 Going Home?', body: 'Safe rides, verified drivers - book now!' },
        { title: '🌙 Evening Plans?', body: 'Reliable rides to anywhere you want to go!' },
    ],
    driver: [
        { title: '🌆 Peak Hour Coming!', body: 'Massive demand expected - Go online NOW!' },
        { title: '💰 Evening Gold Rush', body: 'Expected earnings ₹800+ in 2 hours!' },
        { title: '⚡ 2x Surge Multiplier!', body: 'Evening peak is here! Start rides!' },
        { title: '🚗 Peak Time Alert', body: 'Maximum earnings hour - go live!' },
        { title: '💎 Premium Rush', body: 'High-value rides incoming!' },
    ]
};

// Weekend special messages (Saturday-Sunday)
const WEEKEND_MESSAGES = {
    passenger: [
        { title: '🎉 Weekend Vibes!', body: 'Plan a fun outing? We\'ll get you there!' },
        { title: '🎬 Movie Night?', body: 'Book a ride to your favorite cinema!' },
        { title: '🍕 Party Mode On!', body: 'Safe rides for your weekend fun!' },
        { title: '✨ Weekend Magic', body: 'Special discounts on all rides today!' },
        { title: '🌟 Let\'s Celebrate!', body: 'Extra cashback on weekend rides!' },
    ],
    driver: [
        { title: '🎉 Weekend Money!', body: 'Highest demand day - max out your earnings!' },
        { title: '💎 Premium Demand', body: 'Long-distance rides worth ₹1000+' },
        { title: '🎊 Weekend Peak', body: 'Stay online all day = ₹2000+ earnings!' },
        { title: '🏖️ Party Mode Surge', body: 'Club rides = 3x earnings!' },
        { title: '💰 Maximum Earnings', body: 'Weekend is your payday!' },
    ]
};

// Get random message from array
const getRandomMessage = (messages) => {
    return messages[Math.floor(Math.random() * messages.length)];
};

// Get time period (morning, afternoon, evening)
const getTimePeriod = () => {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 23) return 'evening';
    return 'night';
};

// Check if weekend
const isWeekend = () => {
    const day = new Date().getDay();
    return day === 0 || day === 6; // Sunday or Saturday
};

// Get appropriate messages based on time and day
const getEngagementMessage = (userType) => {
    const period = getTimePeriod();
    const weekend = isWeekend();

    if (weekend) {
        return getRandomMessage(WEEKEND_MESSAGES[userType]);
    }

    if (period === 'morning') return getRandomMessage(MORNING_MESSAGES[userType]);
    if (period === 'afternoon') return getRandomMessage(AFTERNOON_MESSAGES[userType]);
    if (period === 'evening') return getRandomMessage(EVENING_MESSAGES[userType]);

    // Night - generic message
    return {
        title: '🌙 Night Owl Special',
        body: userType === 'driver' ? 'Night riders prefer premium drivers!' : 'Late night rides? We\'re here 24/7!'
    };
};

// ─── Send to Passengers ──────────────────────────────────────────────────────────
export const sendPassengerEngagementNotifications = async () => {
    try {
        logger.info('📨 Starting passenger engagement notifications...');

        // Get all active passengers with FCM tokens
        const { rows: passengers } = await db.query(
            `SELECT id, full_name, fcm_token
             FROM users
             WHERE role = 'passenger'
             AND is_active = TRUE
             AND fcm_token IS NOT NULL
             AND fcm_token != ''
             LIMIT 500`
        );

        logger.info(`Found ${passengers.length} active passengers to notify`);

        const message = getEngagementMessage('passenger');
        let sent = 0, failed = 0;

        for (const passenger of passengers) {
            try {
                // Send FCM notification
                await sendNotification(
                    passenger.fcm_token,
                    message.title,
                    message.body,
                    { type: 'engagement', timestamp: Date.now().toString() }
                );

                // Save to database
                await notificationService.saveNotification({
                    userId: passenger.id,
                    type: 'engagement',
                    title: message.title,
                    body: message.body,
                });

                sent++;
            } catch (error) {
                logger.error(`Failed to notify passenger ${passenger.id}:`, error.message);
                failed++;
            }
        }

        logger.info(`✅ Passenger notifications: ${sent} sent, ${failed} failed`);
        return { sent, failed, total: passengers.length };
    } catch (error) {
        logger.error('Passenger notification batch error:', error);
        throw error;
    }
};

// ─── Send to Drivers ─────────────────────────────────────────────────────────────
export const sendDriverEngagementNotifications = async () => {
    try {
        logger.info('📨 Starting driver engagement notifications...');

        // Get all active, online drivers with FCM tokens
        const { rows: drivers } = await db.query(
            `SELECT d.id, d.user_id, u.full_name, d.fcm_token
             FROM drivers d
             JOIN users u ON u.id = d.user_id
             WHERE d.is_available = TRUE
             AND u.is_active = TRUE
             AND d.fcm_token IS NOT NULL
             AND d.fcm_token != ''
             LIMIT 500`
        );

        logger.info(`Found ${drivers.length} active drivers to notify`);

        const message = getEngagementMessage('driver');
        let sent = 0, failed = 0;

        for (const driver of drivers) {
            try {
                // Send FCM notification
                await sendNotification(
                    driver.fcm_token,
                    message.title,
                    message.body,
                    { type: 'engagement', timestamp: Date.now().toString() }
                );

                // Save to database
                await notificationService.saveNotification({
                    userId: driver.user_id,
                    type: 'engagement',
                    title: message.title,
                    body: message.body,
                });

                sent++;
            } catch (error) {
                logger.error(`Failed to notify driver ${driver.id}:`, error.message);
                failed++;
            }
        }

        logger.info(`✅ Driver notifications: ${sent} sent, ${failed} failed`);
        return { sent, failed, total: drivers.length };
    } catch (error) {
        logger.error('Driver notification batch error:', error);
        throw error;
    }
};

// ─── Combined function to send both ──────────────────────────────────────────────
export const sendEngagementNotifications = async () => {
    try {
        logger.info('🎯 Starting combined engagement notifications...');
        const time = new Date().toLocaleTimeString();
        const period = getTimePeriod();
        const weekend = isWeekend() ? 'Weekend' : 'Weekday';

        logger.info(`Time: ${time} | Period: ${period} | Day: ${weekend}`);

        const passengerResult = await sendPassengerEngagementNotifications();
        const driverResult = await sendDriverEngagementNotifications();

        return {
            passengers: passengerResult,
            drivers: driverResult,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        logger.error('Combined engagement notification error:', error);
        throw error;
    }
};

// ─── Utility: Get next notification times for a day ─────────────────────────────
export const getNotificationSchedule = () => {
    const today = new Date();
    const morning = new Date(today);
    morning.setHours(8, 0, 0, 0); // 8 AM

    const afternoon = new Date(today);
    afternoon.setHours(13, 0, 0, 0); // 1 PM

    const evening = new Date(today);
    evening.setHours(18, 0, 0, 0); // 6 PM

    return {
        morning: morning.toISOString(),
        afternoon: afternoon.toISOString(),
        evening: evening.toISOString(),
    };
};
