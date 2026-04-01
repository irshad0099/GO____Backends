import * as contactRepo from '../repositories/emergencyContact.repository.js';
import { NotFoundError, ApiError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

const MAX_CONTACTS = 5;

export const getContacts = async (userId) => {
    try {
        return await contactRepo.findByUser(userId);
    } catch (error) {
        logger.error('Get emergency contacts service error:', error);
        throw error;
    }
};

export const addContact = async (userId, data) => {
    try {
        const count = await contactRepo.countByUser(userId);
        if (count >= MAX_CONTACTS) {
            throw new ApiError(400, `Maximum ${MAX_CONTACTS} emergency contacts allowed`);
        }
        return await contactRepo.insert({ user_id: userId, ...data });
    } catch (error) {
        logger.error('Add emergency contact service error:', error);
        throw error;
    }
};

export const updateContact = async (userId, contactId, data) => {
    try {
        const result = await contactRepo.update(contactId, userId, data);
        if (!result) throw new NotFoundError('Emergency contact');
        return result;
    } catch (error) {
        logger.error('Update emergency contact service error:', error);
        throw error;
    }
};

export const deleteContact = async (userId, contactId) => {
    try {
        const deleted = await contactRepo.remove(contactId, userId);
        if (!deleted) throw new NotFoundError('Emergency contact');
        return { deleted: true };
    } catch (error) {
        logger.error('Delete emergency contact service error:', error);
        throw error;
    }
};
