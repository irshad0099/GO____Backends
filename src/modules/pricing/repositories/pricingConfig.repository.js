import { db } from '../../../infrastructure/database/postgres.js';
import logger from '../../../core/logger/logger.js';

// ─── Raw fetchers ───────────────────────────────────────────────────────────
export const fetchVehicleConfigs = async () => {
    const { rows } = await db.query(
        `SELECT vc.*, cf.off_peak_base, cf.peak_base
         FROM pricing_vehicle_config vc
         LEFT JOIN pricing_convenience_fee cf ON cf.vehicle_type = vc.vehicle_type
         WHERE vc.is_active = TRUE
         ORDER BY vc.sort_order`
    );
    return rows;
};

export const fetchDistanceTiers = async () => {
    const { rows } = await db.query(
        `SELECT * FROM pricing_distance_tiers
         WHERE is_active = TRUE
         ORDER BY sort_order`
    );
    return rows;
};

export const fetchSubscriberRules = async () => {
    const { rows } = await db.query(
        `SELECT * FROM pricing_subscriber_rules WHERE is_active = TRUE`
    );
    return rows;
};

export const fetchGstConfig = async () => {
    const { rows } = await db.query(`SELECT * FROM pricing_gst_config ORDER BY id LIMIT 1`);
    return rows[0] || null;
};

export const fetchPenaltyConfig = async () => {
    const { rows } = await db.query(
        `SELECT * FROM pricing_penalty_config
         WHERE is_active = TRUE
         ORDER BY offense_type, offense_count`
    );
    return rows;
};

export const fetchSettings = async () => {
    const { rows } = await db.query(`SELECT * FROM pricing_settings`);
    return rows;
};

// ─── Update helpers (admin usage) ───────────────────────────────────────────
export const updateVehicleConfig = async (vehicleType, patch) => {
    const allowed = [
        'display_name','base_fare','per_km_rate','minimum_fare',
        'platform_fee','platform_fee_daily_cap','avg_speed_kmph',
        'pickup_free_km','pickup_rate_per_km',
        'waiting_grace_minutes','waiting_rate_per_min',
        'traffic_grace_minutes','traffic_rate_per_min',
        'max_vehicle_age_years','min_engine_cc','ac_required','category_notes',
        'is_active','sort_order'
    ];
    const cols = Object.keys(patch).filter(k => allowed.includes(k));
    if (!cols.length) return null;
    const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const vals = cols.map(c => patch[c]);
    vals.push(vehicleType);
    const { rows } = await db.query(
        `UPDATE pricing_vehicle_config
         SET ${sets}, updated_at = NOW()
         WHERE vehicle_type = $${vals.length}
         RETURNING *`,
        vals
    );
    return rows[0] || null;
};

export const updateConvenienceFee = async (vehicleType, offPeakBase, peakBase) => {
    const { rows } = await db.query(
        `INSERT INTO pricing_convenience_fee (vehicle_type, off_peak_base, peak_base)
         VALUES ($1, $2, $3)
         ON CONFLICT (vehicle_type)
         DO UPDATE SET off_peak_base = EXCLUDED.off_peak_base,
                       peak_base     = EXCLUDED.peak_base,
                       updated_at    = NOW()
         RETURNING *`,
        [vehicleType, offPeakBase, peakBase]
    );
    return rows[0];
};

export const updateSubscriberRule = async (tierName, patch) => {
    const allowed = ['free_km','discount_pct_beyond','surge_cap','is_active'];
    const cols = Object.keys(patch).filter(k => allowed.includes(k));
    if (!cols.length) return null;
    const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const vals = cols.map(c => patch[c]);
    vals.push(tierName);
    const { rows } = await db.query(
        `UPDATE pricing_subscriber_rules
         SET ${sets}, updated_at = NOW()
         WHERE tier_name = $${vals.length}
         RETURNING *`,
        vals
    );
    return rows[0] || null;
};

export const updateGstConfig = async (patch) => {
    const allowed = [
        'gst_enabled','rider_rate_pct','platform_rate_pct',
        'rider_sac_code','platform_sac_code','gst_registration_no'
    ];
    const cols = Object.keys(patch).filter(k => allowed.includes(k));
    if (!cols.length) return null;
    const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const vals = cols.map(c => patch[c]);
    const { rows } = await db.query(
        `UPDATE pricing_gst_config SET ${sets}, updated_at = NOW() WHERE id = 1 RETURNING *`,
        vals
    );
    return rows[0] || null;
};

export const upsertDistanceTier = async (tierName, patch) => {
    const allowed = ['min_km','max_km','multiplier','is_active','sort_order','description'];
    const cols = Object.keys(patch).filter(k => allowed.includes(k));
    if (!cols.length) return null;

    // Try update first
    const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const vals = cols.map(c => patch[c]);
    vals.push(tierName);
    const upd = await db.query(
        `UPDATE pricing_distance_tiers
         SET ${sets}, updated_at = NOW()
         WHERE tier_name = $${vals.length}
         RETURNING *`,
        vals
    );
    if (upd.rows[0]) return upd.rows[0];

    // Insert fresh — fill NOT NULL defaults if missing
    const ins = await db.query(
        `INSERT INTO pricing_distance_tiers (tier_name, min_km, max_km, multiplier, is_active, sort_order, description)
         VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), COALESCE($6, 0), $7)
         RETURNING *`,
        [
            tierName,
            patch.min_km ?? 0,
            patch.max_km ?? null,
            patch.multiplier ?? 1,
            patch.is_active,
            patch.sort_order,
            patch.description ?? null,
        ]
    );
    return ins.rows[0];
};

export const upsertPenaltyConfig = async (offenseType, offenseCount, patch) => {
    const allowed = [
        'penalty_amount','suspension_days','requires_rekyc','is_permanent_ban',
        'rider_refund_amount','escalation_window_days','action_notes','is_active'
    ];
    const cols = Object.keys(patch).filter(k => allowed.includes(k));
    if (!cols.length) return null;

    const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const vals = cols.map(c => patch[c]);
    vals.push(offenseType, offenseCount);

    const upd = await db.query(
        `UPDATE pricing_penalty_config
         SET ${sets}, updated_at = NOW()
         WHERE offense_type = $${vals.length - 1} AND offense_count = $${vals.length}
         RETURNING *`,
        vals
    );
    if (upd.rows[0]) return upd.rows[0];

    const ins = await db.query(
        `INSERT INTO pricing_penalty_config
            (offense_type, offense_count, penalty_amount, suspension_days, requires_rekyc,
             is_permanent_ban, rider_refund_amount, escalation_window_days, action_notes, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, TRUE))
         RETURNING *`,
        [
            offenseType,
            offenseCount,
            patch.penalty_amount ?? 0,
            patch.suspension_days ?? 0,
            patch.requires_rekyc ?? false,
            patch.is_permanent_ban ?? false,
            patch.rider_refund_amount ?? 0,
            patch.escalation_window_days ?? 90,
            patch.action_notes ?? null,
            patch.is_active,
        ]
    );
    return ins.rows[0];
};

export const deletePenaltyConfig = async (offenseType, offenseCount) => {
    const { rowCount } = await db.query(
        `DELETE FROM pricing_penalty_config WHERE offense_type = $1 AND offense_count = $2`,
        [offenseType, offenseCount]
    );
    return rowCount > 0;
};

export const upsertSetting = async (key, value, valueType = 'string', description = null) => {
    const { rows } = await db.query(
        `INSERT INTO pricing_settings (setting_key, setting_value, value_type, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (setting_key)
         DO UPDATE SET setting_value = EXCLUDED.setting_value,
                       value_type    = EXCLUDED.value_type,
                       description   = COALESCE(EXCLUDED.description, pricing_settings.description),
                       updated_at    = NOW()
         RETURNING *`,
        [key, String(value), valueType, description]
    );
    return rows[0];
};
