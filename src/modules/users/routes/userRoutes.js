import express from 'express';
import * as controller from '../controllers/userController.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validate } from '../../../core/middleware/validation.middleware.js';
import { upload } from '../../../core/middleware/upload.middleware.js';
import { db } from '../../../infrastructure/database/postgres.js';

// ─── New Feature Controllers ─────────────────────────────────────────────────
import * as addressCtrl      from '../controllers/savedAddressController.js';
import * as contactCtrl      from '../controllers/emergencyContactController.js';
import * as referralCtrl     from '../controllers/referralController.js';
import * as recentPlacesCtrl from '../controllers/recentPlacesController.js';
import {
    addAddressSchema, updateAddressSchema,
    addContactSchema, applyReferralSchema,
    validate as joiValidate,
} from '../validators/userNewFeatures.validator.js';

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

router.get('/profile', controller.getProfile);

router.put('/profile', controller.updateProfile);

router.post(
    '/profile/picture',
    upload.single('profilePicture'),
    controller.uploadProfilePicture
);

router.get('/rides/history', controller.getRideHistory);

router.get('/wallet', controller.getWalletBalance);

router.post('/wallet/add', controller.addMoneyToWallet);

// ═════════════════════════════════════════════════════════════════════════════
//  FCM TOKEN — Push Notifications ke liye
// ═════════════════════════════════════════════════════════════════════════════
 
// POST /api/v1/users/fcm-token
// App login hone ke baad frontend se FCM token save karo
router.post('/fcm-token', async (req, res) => {
    try {
        const { fcm_token } = req.body;
 
        if (!fcm_token) {
            return res.status(400).json({
                success: false,
                message: 'fcm_token is required'
            });
        }
 
        await db.query(
            'UPDATE users SET fcm_token = $1 WHERE id = $2',
            [fcm_token, req.user.id]
        );
 
        return res.status(200).json({
            success: true,
            message: 'FCM token saved successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
 


// ═════════════════════════════════════════════════════════════════════════════
//  SAVED ADDRESSES (Home / Work / Favorites)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/v1/users/addresses
router.get('/addresses', addressCtrl.getAddresses);

// POST /api/v1/users/addresses
router.post('/addresses', joiValidate(addAddressSchema), addressCtrl.addAddress);

// PUT /api/v1/users/addresses/:id
router.put('/addresses/:id', joiValidate(updateAddressSchema), addressCtrl.updateAddress);

// DELETE /api/v1/users/addresses/:id
router.delete('/addresses/:id', addressCtrl.deleteAddress);


// ═════════════════════════════════════════════════════════════════════════════
//  EMERGENCY CONTACTS
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/v1/users/emergency-contacts
router.get('/emergency-contacts', contactCtrl.getContacts);

// POST /api/v1/users/emergency-contacts
router.post('/emergency-contacts', joiValidate(addContactSchema), contactCtrl.addContact);

// PUT /api/v1/users/emergency-contacts/:id
router.put('/emergency-contacts/:id', joiValidate(addContactSchema), contactCtrl.updateContact);

// DELETE /api/v1/users/emergency-contacts/:id
router.delete('/emergency-contacts/:id', contactCtrl.deleteContact);


// ═════════════════════════════════════════════════════════════════════════════
//  REFERRAL SYSTEM
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/v1/users/referral-code — my referral code
router.get('/referral-code', referralCtrl.getMyCode);

// POST /api/v1/users/referral/apply — apply someone's code
router.post('/referral/apply', joiValidate(applyReferralSchema), referralCtrl.applyCode);

// GET /api/v1/users/referrals — my referral history
router.get('/referrals', referralCtrl.getMyReferrals);


// ═════════════════════════════════════════════════════════════════════════════
//  RECENT PLACES
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/v1/users/recent-places?limit=10
router.get('/recent-places', recentPlacesCtrl.getRecentPlaces);


// ═════════════════════════════════════════════════════════════════════════════
//  DELETE ACCOUNT
// ═════════════════════════════════════════════════════════════════════════════

// DELETE /api/v1/users/account
router.delete('/account', controller.deleteAccount);


export default router;