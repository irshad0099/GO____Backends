import {
    fetchVehicleConfigs,
    fetchDistanceTiers,
    fetchSubscriberRules,
    fetchGstConfig,
    fetchPenaltyConfig,
    fetchSettings,
    updateVehicleConfig,
    updateConvenienceFee,
    updateSubscriberRule,
    updateGstConfig,
    upsertSetting,
    upsertDistanceTier,
    upsertPenaltyConfig,
    deletePenaltyConfig,
} from '../repositories/pricingConfig.repository.js';
import {
    reloadPricingConfig,
    getPricingConfig,
} from '../services/pricingConfigLoader.js';
import { sendResponse, sendError } from '../../../core/utils/response.js';
import { NotFoundError } from '../../../core/errors/ApiError.js';

// ─── Vehicle config ────────────────────────────────────────────────────────
export const listVehicles = async (_req, res, next) => {
    try {
        const rows = await fetchVehicleConfigs();
        sendResponse(res, 200, 'Vehicle configs', rows);
    } catch (e) { next(e); }
};

export const patchVehicle = async (req, res, next) => {
    try {
        const { vehicleType } = req.params;
        const { convenience, ...rest } = req.body || {};
        const updated = await updateVehicleConfig(vehicleType, rest);

        if (!updated && !convenience) throw new NotFoundError(`Vehicle type '${vehicleType}' not found`);

        if (convenience && (convenience.off_peak_base != null || convenience.peak_base != null)) {
            await updateConvenienceFee(
                vehicleType,
                convenience.off_peak_base ?? 0,
                convenience.peak_base ?? 0,
            );
        }

        await reloadPricingConfig();
        const rows = await fetchVehicleConfigs();
        const row  = rows.find(r => r.vehicle_type === vehicleType) || null;
        sendResponse(res, 200, 'Vehicle config updated', row);
    } catch (e) { next(e); }
};

// ─── Distance tiers ────────────────────────────────────────────────────────
export const listTiers = async (_req, res, next) => {
    try {
        const rows = await fetchDistanceTiers();
        sendResponse(res, 200, 'Distance tiers', rows);
    } catch (e) { next(e); }
};

export const upsertTier = async (req, res, next) => {
    try {
        const { tierName } = req.params;
        const row = await upsertDistanceTier(tierName, req.body || {});
        if (!row) return sendError(res, 400, 'No valid tier fields provided');
        await reloadPricingConfig();
        sendResponse(res, 200, 'Tier saved', row);
    } catch (e) { next(e); }
};

// ─── Subscriber rules ──────────────────────────────────────────────────────
export const listSubscriberRules = async (_req, res, next) => {
    try {
        const rows = await fetchSubscriberRules();
        sendResponse(res, 200, 'Subscriber rules', rows);
    } catch (e) { next(e); }
};

export const patchSubscriberRule = async (req, res, next) => {
    try {
        const { tierName } = req.params;
        const row = await updateSubscriberRule(tierName, req.body || {});
        if (!row) throw new NotFoundError(`Subscriber rule '${tierName}' not found or no fields to update`);
        await reloadPricingConfig();
        sendResponse(res, 200, 'Subscriber rule updated', row);
    } catch (e) { next(e); }
};

// ─── GST ───────────────────────────────────────────────────────────────────
export const getGst = async (_req, res, next) => {
    try {
        const row = await fetchGstConfig();
        sendResponse(res, 200, 'GST config', row || {});
    } catch (e) { next(e); }
};

export const patchGst = async (req, res, next) => {
    try {
        const row = await updateGstConfig(req.body || {});
        if (!row) return sendError(res, 400, 'No valid GST fields provided');
        await reloadPricingConfig();
        sendResponse(res, 200, 'GST config updated', row);
    } catch (e) { next(e); }
};

// ─── Penalties ─────────────────────────────────────────────────────────────
export const listPenalties = async (_req, res, next) => {
    try {
        const rows = await fetchPenaltyConfig();
        sendResponse(res, 200, 'Penalty config', rows);
    } catch (e) { next(e); }
};

export const upsertPenalty = async (req, res, next) => {
    try {
        const { offenseType, offenseCount } = req.params;
        const row = await upsertPenaltyConfig(offenseType, Number(offenseCount), req.body || {});
        if (!row) return sendError(res, 400, 'No valid penalty fields provided');
        await reloadPricingConfig();
        sendResponse(res, 200, 'Penalty rule saved', row);
    } catch (e) { next(e); }
};

export const removePenalty = async (req, res, next) => {
    try {
        const { offenseType, offenseCount } = req.params;
        const ok = await deletePenaltyConfig(offenseType, Number(offenseCount));
        if (!ok) throw new NotFoundError(`Penalty rule '${offenseType}/${offenseCount}' not found`);
        await reloadPricingConfig();
        sendResponse(res, 200, 'Penalty rule removed', { offenseType, offenseCount: Number(offenseCount) });
    } catch (e) { next(e); }
};

// ─── Settings (generic kv) ─────────────────────────────────────────────────
export const listSettings = async (_req, res, next) => {
    try {
        const rows = await fetchSettings();
        sendResponse(res, 200, 'Settings', rows);
    } catch (e) { next(e); }
};

export const patchSetting = async (req, res, next) => {
    try {
        const { key } = req.params;
        const { value, value_type = 'string', description = null } = req.body || {};
        if (value === undefined) return sendError(res, 400, 'value is required');
        const row = await upsertSetting(key, value, value_type, description);
        await reloadPricingConfig();
        sendResponse(res, 200, 'Setting updated', row);
    } catch (e) { next(e); }
};

// ─── Cache control ─────────────────────────────────────────────────────────
export const reloadCache = async (_req, res, next) => {
    try {
        const snap = await reloadPricingConfig();
        sendResponse(res, 200, 'Pricing cache reloaded', {
            vehicles: Object.keys(snap.vehicles).length,
            tiers:    snap.tiers.length,
            loadedAt: snap.loadedAt,
        });
    } catch (e) { next(e); }
};

export const getCacheSnapshot = async (_req, res, next) => {
    try {
        const snap = getPricingConfig();
        sendResponse(res, 200, 'Current pricing snapshot', snap);
    } catch (e) { next(e); }
};
