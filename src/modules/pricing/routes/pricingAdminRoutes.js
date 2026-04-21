import express from 'express';

import {
    listVehicles, patchVehicle,
    listTiers, upsertTier,
    listSubscriberRules, patchSubscriberRule,
    getGst, patchGst,
    listPenalties, upsertPenalty, removePenalty,
    listSettings, patchSetting,
    reloadCache, getCacheSnapshot,
} from '../controllers/pricingAdminController.js';

import {
    vehiclePatchSchema,
    tierUpsertSchema,
    subscriberRulePatchSchema,
    gstPatchSchema,
    penaltyUpsertSchema,
    settingPatchSchema,
    validate,
} from '../validators/pricingAdminValidator.js';

import { authenticate }  from '../../../core/middleware/auth.middleware.js';
import { requireRole }   from '../../../core/middleware/roleMiddleware.js';
import { apiLimiter }    from '../../../core/middleware/rateLimiter.middleware.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole(['admin']));
router.use(apiLimiter);

// ─── Vehicles ──────────────────────────────────────────────────────────────
router.get('/vehicles',                    listVehicles);
router.patch('/vehicles/:vehicleType',     validate(vehiclePatchSchema), patchVehicle);

// ─── Distance tiers ────────────────────────────────────────────────────────
router.get('/tiers',                       listTiers);
router.put('/tiers/:tierName',             validate(tierUpsertSchema),   upsertTier);

// ─── Subscriber rules ──────────────────────────────────────────────────────
router.get('/subscribers',                 listSubscriberRules);
router.patch('/subscribers/:tierName',     validate(subscriberRulePatchSchema), patchSubscriberRule);

// ─── GST ───────────────────────────────────────────────────────────────────
router.get('/gst',                         getGst);
router.patch('/gst',                       validate(gstPatchSchema), patchGst);

// ─── Penalty framework ─────────────────────────────────────────────────────
router.get('/penalties',                   listPenalties);
router.put('/penalties/:offenseType/:offenseCount',    validate(penaltyUpsertSchema), upsertPenalty);
router.delete('/penalties/:offenseType/:offenseCount', removePenalty);

// ─── Misc settings (kv) ────────────────────────────────────────────────────
router.get('/settings',                    listSettings);
router.patch('/settings/:key',             validate(settingPatchSchema), patchSetting);

// ─── Cache control ─────────────────────────────────────────────────────────
router.get('/cache',                       getCacheSnapshot);
router.post('/cache/reload',               reloadCache);

export default router;
