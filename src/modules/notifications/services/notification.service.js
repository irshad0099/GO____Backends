import * as repo from '../repositories/notification.repository.js';
import logger from '../../../core/logger/logger.js';

// Today/Yesterday/Date grouping
const groupByDate = (notifications) => {
    const groups = {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    notifications.forEach(n => {
        const d = new Date(n.created_at).toDateString();
        const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : d;
        if (!groups[label]) groups[label] = [];
        groups[label].push({
            id:        n.id,
            type:      n.type,
            title:     n.title,
            body:      n.body,
            isRead:    n.is_read,
            rideId:    n.ride_id,
            createdAt: n.created_at
        });
    });

    return Object.entries(groups).map(([date, items]) => ({ date, items }));
};

export const getNotifications = async (userId, { limit = 20, offset = 0 }) => {
    try {
        const notifications = await repo.findByUser(userId, { limit: parseInt(limit), offset: parseInt(offset) });
        return groupByDate(notifications);
    } catch (error) {
        logger.error('Get notifications service error:', error);
        throw error;
    }
};

export const getUnreadCount = async (userId) => {
    try {
        const count = await repo.countUnread(userId);
        return { unreadCount: count };
    } catch (error) {
        logger.error('Get unread count service error:', error);
        throw error;
    }
};

export const markAsRead = async (userId, notificationId) => {
    try {
        await repo.markAsRead(notificationId, userId);
        return { success: true };
    } catch (error) {
        logger.error('Mark as read service error:', error);
        throw error;
    }
};

export const markAllAsRead = async (userId) => {
    try {
        await repo.markAllAsRead(userId);
        return { success: true };
    } catch (error) {
        logger.error('Mark all as read service error:', error);
        throw error;
    }
};

// Dusre services yeh use karenge notification save karne ke liye
export const saveNotification = async ({ userId, type, title, body, rideId = null }) => {
    try {
        return await repo.insertNotification({ userId, type, title, body, rideId });
    } catch (error) {
        logger.error('Save notification service error:', error);
        // Notification fail hone se main flow break na ho
    }
};
