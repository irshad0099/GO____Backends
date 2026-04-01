import * as addressService from '../services/savedAddressService.js';

export const getAddresses = async (req, res, next) => {
    try {
        const data = await addressService.getAddresses(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};

export const addAddress = async (req, res, next) => {
    try {
        const data = await addressService.addAddress(req.user.id, req.body);
        res.status(201).json({ success: true, message: 'Address saved', data });
    } catch (error) { next(error); }
};

export const updateAddress = async (req, res, next) => {
    try {
        const data = await addressService.updateAddress(req.user.id, parseInt(req.params.id), req.body);
        res.status(200).json({ success: true, message: 'Address updated', data });
    } catch (error) { next(error); }
};

export const deleteAddress = async (req, res, next) => {
    try {
        await addressService.deleteAddress(req.user.id, parseInt(req.params.id));
        res.status(200).json({ success: true, message: 'Address deleted' });
    } catch (error) { next(error); }
};
