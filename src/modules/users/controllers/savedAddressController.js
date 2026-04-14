import * as addressService from '../services/savedAddressService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getAddresses = async (req, res, next) => {
    try {
        const data = await addressService.getAddresses(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const addAddress = async (req, res, next) => {
    try {
        const data = await addressService.addAddress(req.user.id, req.body);
        sendResponse(res, 201, 'Address saved', data);
    } catch (error) { next(error); }
};

export const updateAddress = async (req, res, next) => {
    try {
        const data = await addressService.updateAddress(req.user.id, parseInt(req.params.id), req.body);
        sendResponse(res, 200, 'Address updated', data);
    } catch (error) { next(error); }
};

export const deleteAddress = async (req, res, next) => {
    try {
        await addressService.deleteAddress(req.user.id, parseInt(req.params.id));
        sendResponse(res, 200, 'Address deleted', null);
    } catch (error) { next(error); }
};
