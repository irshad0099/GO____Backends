import logger from '../../../core/logger/logger.js';
import {
    fetchVehicleConfigs,
    fetchDistanceTiers,
    fetchSubscriberRules,
    fetchGstConfig,
    fetchPenaltyConfig,
    fetchSettings,
} from '../repositories/pricingConfig.repository.js';

// ─── Cache state ────────────────────────────────────────────────────────────
let CACHE = null;
let CACHE_LOADED_AT = 0;
let LOAD_PROMISE = null;

const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

const parseSetting = (row) => {
    const { setting_value: v, value_type: t } = row;
    if (t === 'number')  return Number(v);
    if (t === 'boolean') return v === 'true' || v === '1' || v === 'TRUE';
    if (t === 'json')    { try { return JSON.parse(v); } catch { return v; } }
    return v;
};

const normalizeVehicleType = (t) => {
    const s = String(t || '').toLowerCase();
    if (s === 'cab' || s === 'taxi') return 'car';
    return s;
};

// ─── Build the in-memory snapshot ──────────────────────────────────────────
const buildSnapshot = async () => {
    const [vehicles, tiers, subRules, gst, penalties, settings] = await Promise.all([
        fetchVehicleConfigs(),
        fetchDistanceTiers(),
        fetchSubscriberRules(),
        fetchGstConfig(),
        fetchPenaltyConfig(),
        fetchSettings(),
    ]);

    // Index vehicles by type
    const vehicleMap = {};
    for (const v of vehicles) {
        vehicleMap[v.vehicle_type] = {
            vehicleType:          v.vehicle_type,
            displayName:          v.display_name,
            baseFare:             num(v.base_fare),
            perKmRate:            num(v.per_km_rate),
            minimumFare:          num(v.minimum_fare),
            platformFee:          num(v.platform_fee),
            platformFeeDailyCap:  num(v.platform_fee_daily_cap, 10),
            avgSpeedKmph:         num(v.avg_speed_kmph, 30),
            pickupFreeKm:         num(v.pickup_free_km, 2.5),
            pickupRatePerKm:      num(v.pickup_rate_per_km),
            waitingGraceMinutes:  num(v.waiting_grace_minutes, 7),
            waitingRatePerMin:    num(v.waiting_rate_per_min),
            trafficGraceMinutes:  num(v.traffic_grace_minutes, 30),
            trafficRatePerMin:    num(v.traffic_rate_per_min),
            convenienceOffPeak:   num(v.off_peak_base),
            conveniencePeak:      num(v.peak_base),
            maxVehicleAgeYears:   v.max_vehicle_age_years,
            minEngineCc:          v.min_engine_cc,
            acRequired:           Boolean(v.ac_required),
            categoryNotes:        v.category_notes,
            sortOrder:            num(v.sort_order),
        };
    }

    // Tiers sorted by min_km
    const tierList = tiers
        .map(t => ({
            name:       t.tier_name,
            minKm:      num(t.min_km),
            maxKm:      t.max_km == null ? Infinity : num(t.max_km),
            multiplier: num(t.multiplier, 1),
        }))
        .sort((a, b) => a.minKm - b.minKm);

    // Subscriber rules by tier_name
    const subMap = {};
    for (const s of subRules) {
        subMap[s.tier_name] = {
            freeKm:             num(s.free_km),
            discountPctBeyond:  num(s.discount_pct_beyond),
            surgeCap:           num(s.surge_cap, 1.75),
        };
    }

    // GST
    const gstCfg = gst
        ? {
            enabled:           Boolean(gst.gst_enabled),
            riderRatePct:      num(gst.rider_rate_pct, 5),
            platformRatePct:   num(gst.platform_rate_pct, 18),
            riderSacCode:      gst.rider_sac_code || '9964',
            platformSacCode:   gst.platform_sac_code || '9985',
            registrationNo:    gst.gst_registration_no || null,
        }
        : { enabled: false, riderRatePct: 5, platformRatePct: 18, riderSacCode: '9964', platformSacCode: '9985', registrationNo: null };

    // Penalties indexed by offense_type → sorted list by count
    const penaltyMap = {};
    for (const p of penalties) {
        (penaltyMap[p.offense_type] ??= []).push({
            offenseCount:         num(p.offense_count),
            penaltyAmount:        num(p.penalty_amount),
            suspensionDays:       num(p.suspension_days),
            requiresReKyc:        Boolean(p.requires_rekyc),
            isPermanentBan:       Boolean(p.is_permanent_ban),
            riderRefundAmount:    num(p.rider_refund_amount),
            escalationWindowDays: num(p.escalation_window_days, 90),
            actionNotes:          p.action_notes,
        });
    }
    for (const list of Object.values(penaltyMap)) list.sort((a, b) => a.offenseCount - b.offenseCount);

    // Settings
    const settingsMap = {};
    for (const s of settings) settingsMap[s.setting_key] = parseSetting(s);

    return {
        vehicles:     vehicleMap,
        tiers:        tierList,
        subscribers:  subMap,
        gst:          gstCfg,
        penalties:    penaltyMap,
        settings:     settingsMap,
        loadedAt:     Date.now(),
    };
};

// ─── Public API ─────────────────────────────────────────────────────────────
export const initPricingConfig = async () => {
    try {
        CACHE = await buildSnapshot();
        CACHE_LOADED_AT = Date.now();
        logger.info(`Pricing config loaded: ${Object.keys(CACHE.vehicles).length} vehicles, ${CACHE.tiers.length} tiers`);
        return CACHE;
    } catch (e) {
        logger.error('Pricing config load failed', { error: e.message });
        throw e;
    }
};

export const reloadPricingConfig = async () => {
    CACHE = null;
    LOAD_PROMISE = null;
    return initPricingConfig();
};

/**
 * Synchronous accessor. Throws if cache is not initialized.
 * Call initPricingConfig() at app boot before any fare calculation.
 */
export const getPricingConfig = () => {
    if (!CACHE) throw new Error('Pricing config not initialized — call initPricingConfig() at startup');
    return CACHE;
};

/**
 * Async-safe accessor that initializes the cache on first use.
 * Deduplicates concurrent loads.
 */
export const ensurePricingConfig = async () => {
    if (CACHE) return CACHE;
    if (!LOAD_PROMISE) LOAD_PROMISE = initPricingConfig().finally(() => { LOAD_PROMISE = null; });
    return LOAD_PROMISE;
};

export const getVehicleConfig = (vehicleType) => {
    const cfg = getPricingConfig();
    const norm = normalizeVehicleType(vehicleType);
    const v = cfg.vehicles[norm];
    if (!v) throw new Error(`Unknown vehicle type: ${vehicleType}`);
    return v;
};

export const getSubscriberRule = (tierName) => {
    const cfg = getPricingConfig();
    const key = tierName && cfg.subscribers[tierName] ? tierName : 'none';
    return cfg.subscribers[key] || { freeKm: 0, discountPctBeyond: 0, surgeCap: num(cfg.settings.surge_max_multiplier, 1.75) };
};

export const getDistanceTierMultiplier = (distanceKm) => {
    const cfg = getPricingConfig();
    const km = Number(distanceKm) || 0;
    for (const t of cfg.tiers) {
        if (km >= t.minKm && km < t.maxKm) return { name: t.name, multiplier: t.multiplier };
    }
    // Fallback: last tier (handles exact boundary at max)
    const last = cfg.tiers[cfg.tiers.length - 1];
    return last ? { name: last.name, multiplier: last.multiplier } : { name: 'default', multiplier: 1 };
};

export const getSetting = (key, fallback = null) => {
    const cfg = getPricingConfig();
    return cfg.settings[key] ?? fallback;
};

export { normalizeVehicleType };
