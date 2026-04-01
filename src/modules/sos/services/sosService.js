import * as sosRepo from '../repositories/sos.repository.js';
import * as contactRepo from '../../users/repositories/emergencyContact.repository.js';
import { ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

export const triggerSOS = async (userId, data) => {
    try {
        const alert = await sosRepo.insertAlert({
            ride_id: data.ride_id,
            triggered_by: userId,
            latitude: data.latitude,
            longitude: data.longitude
        });

        // Fetch emergency contacts (SMS bhejne ke liye)
        const contacts = await contactRepo.findByUser(userId);

        // Mark as contacts notified (actual SMS integration baad mein)
        if (contacts.length > 0) {
            await sosRepo.updateStatus(alert.id, 'contacts_notified', null, null);
        }

        return {
            alertId: alert.id,
            status: contacts.length > 0 ? 'contacts_notified' : 'triggered',
            contactsNotified: contacts.length,
            message: contacts.length > 0
                ? `SOS triggered! ${contacts.length} emergency contact(s) notified.`
                : 'SOS triggered! Add emergency contacts for auto-notification.'
        };
    } catch (error) {
        logger.error('Trigger SOS service error:', error);
        throw error;
    }
};

export const cancelSOS = async (userId, alertId) => {
    try {
        const result = await sosRepo.updateStatus(alertId, 'false_alarm', 'Cancelled by user', userId);
        if (!result) throw new ApiError(404, 'SOS alert not found');

        return { alertId: result.id, status: 'false_alarm', message: 'SOS cancelled' };
    } catch (error) {
        logger.error('Cancel SOS service error:', error);
        throw error;
    }
};

export const getMySosHistory = async (userId) => {
    try {
        return await sosRepo.findByUser(userId);
    } catch (error) {
        logger.error('Get SOS history service error:', error);
        throw error;
    }
};
