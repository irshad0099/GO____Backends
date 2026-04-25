import * as contactService from '../services/emergencyContactService.js';
import { sendResponse } from '../../../core/utils/response.js';

export const getContacts = async (req, res, next) => {
    try {
        const data = await contactService.getContacts(req.user.id);
        sendResponse(res, 200, '', data);
    } catch (error) { next(error); }
};

export const addContact = async (req, res, next) => {
    try {
        const data = await contactService.addContact(req.user.id, req.body);
        sendResponse(res, 201, 'Emergency contact added', data);
    } catch (error) { next(error); }
};

export const updateContact = async (req, res, next) => {
    try {
        const data = await contactService.updateContact(req.user.id, parseInt(req.params.id), req.body);
        sendResponse(res, 200, 'Contact updated', data);
    } catch (error) { next(error); }
};

export const deleteContact = async (req, res, next) => {
    try {
        await contactService.deleteContact(req.user.id, parseInt(req.params.id));
        sendResponse(res, 200, 'Contact deleted', null);
    } catch (error) { next(error); }
};
