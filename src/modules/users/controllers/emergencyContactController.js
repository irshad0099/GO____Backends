import * as contactService from '../services/emergencyContactService.js';

export const getContacts = async (req, res, next) => {
    try {
        const data = await contactService.getContacts(req.user.id);
        res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
};

export const addContact = async (req, res, next) => {
    try {
        const data = await contactService.addContact(req.user.id, req.body);
        res.status(201).json({ success: true, message: 'Emergency contact added', data });
    } catch (error) { next(error); }
};

export const updateContact = async (req, res, next) => {
    try {
        const data = await contactService.updateContact(req.user.id, parseInt(req.params.id), req.body);
        res.status(200).json({ success: true, message: 'Contact updated', data });
    } catch (error) { next(error); }
};

export const deleteContact = async (req, res, next) => {
    try {
        await contactService.deleteContact(req.user.id, parseInt(req.params.id));
        res.status(200).json({ success: true, message: 'Contact deleted' });
    } catch (error) { next(error); }
};
