import Joi from 'joi';
import { sendValidationError } from '../../../core/utils/response.js';

// ─── Vehicle config PATCH ──────────────────────────────────────────────────
export const vehiclePatchSchema = Joi.object({
    display_name:             Joi.string().max(100),
    base_fare:                Joi.number().min(0),
    per_km_rate:              Joi.number().min(0),
    minimum_fare:             Joi.number().min(0),
    platform_fee:             Joi.number().min(0),
    platform_fee_daily_cap:   Joi.number().integer().min(0),
    avg_speed_kmph:           Joi.number().positive().max(120),
    pickup_free_km:           Joi.number().min(0),
    pickup_rate_per_km:       Joi.number().min(0),
    waiting_grace_minutes:    Joi.number().integer().min(0).max(120),
    waiting_rate_per_min:     Joi.number().min(0),
    traffic_grace_minutes:    Joi.number().integer().min(0).max(240),
    traffic_rate_per_min:     Joi.number().min(0),
    max_vehicle_age_years:    Joi.number().integer().min(0).allow(null),
    min_engine_cc:            Joi.number().integer().min(0).allow(null),
    ac_required:              Joi.boolean(),
    category_notes:           Joi.string().allow('', null),
    is_active:                Joi.boolean(),
    sort_order:               Joi.number().integer().min(0),
    convenience: Joi.object({
        off_peak_base: Joi.number().min(0),
        peak_base:     Joi.number().min(0),
    }),
}).min(1).messages({ 'object.min': 'At least one field required' });

// ─── Distance tier upsert ──────────────────────────────────────────────────
export const tierUpsertSchema = Joi.object({
    min_km:      Joi.number().min(0),
    max_km:      Joi.number().min(0).allow(null),
    multiplier:  Joi.number().positive().max(5),
    is_active:   Joi.boolean(),
    sort_order:  Joi.number().integer().min(0),
    description: Joi.string().allow('', null),
}).min(1);

// ─── Subscriber rule PATCH ─────────────────────────────────────────────────
export const subscriberRulePatchSchema = Joi.object({
    free_km:             Joi.number().min(0),
    discount_pct_beyond: Joi.number().min(0).max(100),
    surge_cap:           Joi.number().min(1).max(5),
    is_active:           Joi.boolean(),
}).min(1);

// ─── GST PATCH ─────────────────────────────────────────────────────────────
export const gstPatchSchema = Joi.object({
    gst_enabled:         Joi.boolean(),
    rider_rate_pct:      Joi.number().min(0).max(100),
    platform_rate_pct:   Joi.number().min(0).max(100),
    rider_sac_code:      Joi.string().max(10),
    platform_sac_code:   Joi.string().max(10),
    gst_registration_no: Joi.string().allow('', null),
}).min(1);

// ─── Penalty upsert ────────────────────────────────────────────────────────
export const penaltyUpsertSchema = Joi.object({
    penalty_amount:         Joi.number().min(0),
    suspension_days:        Joi.number().integer().min(0),
    requires_rekyc:         Joi.boolean(),
    is_permanent_ban:       Joi.boolean(),
    rider_refund_amount:    Joi.number().min(0),
    escalation_window_days: Joi.number().integer().min(1),
    action_notes:           Joi.string().allow('', null),
    is_active:              Joi.boolean(),
}).min(1);

// ─── Generic setting PATCH ─────────────────────────────────────────────────
export const settingPatchSchema = Joi.object({
    value:       Joi.any().required(),
    value_type:  Joi.string().valid('string', 'number', 'boolean', 'json'),
    description: Joi.string().allow('', null),
});

// ─── Validate middleware ───────────────────────────────────────────────────
export const validate = (schema, source = 'body') => (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) {
        return sendValidationError(
            res,
            error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
        );
    }
    if (source === 'query') Object.defineProperty(req, 'query', { value, writable: true, configurable: true });
    else req.body = value;
    next();
};
