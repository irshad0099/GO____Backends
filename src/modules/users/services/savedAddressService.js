import * as addressRepo from '../repositories/savedAddress.repository.js';
import { NotFoundError } from '../../../core/errors/ApiError.js';
import logger from '../../../core/logger/logger.js';

export const getAddresses = async (userId) => {
    try {
        const addresses = await addressRepo.findByUser(userId);
        return addresses.map(a => ({
            id: a.id, label: a.label, type: a.type,
            latitude: parseFloat(a.latitude), longitude: parseFloat(a.longitude),
            address: a.address, landmark: a.landmark, placeId: a.place_id,
            isDefault: a.is_default
        }));
    } catch (error) {
        logger.error('Get addresses service error:', error);
        throw error;
    }
};

export const addAddress = async (userId, data) => {
    try {
        const result = await addressRepo.insert({ user_id: userId, ...data });
        return result;
    } catch (error) {
        logger.error('Add address service error:', error);
        throw error;
    }
};

export const updateAddress = async (userId, addressId, data) => {
    try {
        const result = await addressRepo.update(addressId, userId, data);
        if (!result) throw new NotFoundError('Address');
        return result;
    } catch (error) {
        logger.error('Update address service error:', error);
        throw error;
    }
};

export const deleteAddress = async (userId, addressId) => {
    try {
        const deleted = await addressRepo.remove(addressId, userId);
        if (!deleted) throw new NotFoundError('Address');
        return { deleted: true };
    } catch (error) {
        logger.error('Delete address service error:', error);
        throw error;
    }
};
