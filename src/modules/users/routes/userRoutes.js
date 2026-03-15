import express from 'express';
import * as controller from '../controllers/userController.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validate } from '../../../core/middleware/validation.middleware.js';
import { upload } from '../../../core/middleware/upload.middleware.js';

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

export default router;