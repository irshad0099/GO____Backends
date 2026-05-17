// ─── Centralized Vehicle Type Configuration ───────────────────────────────────
// Single source of truth for all vehicle types across the app
// If you add new vehicle types in the DB, update this list once and all validators work

export const VEHICLE_TYPES = ['bike', 'auto', 'car', 'xl', 'premium', 'luxury'];

export const VEHICLE_TYPES_STRING = VEHICLE_TYPES.join(', ');

// RC vehicle_type (Cashfree raw string) → driver_vehicle type mapping
export const RC_VEHICLE_TYPE_MAP = {
    bike:     ['M-CYCLE', 'MOTORCYCLE', 'SCOOTER', 'MOPED', 'E-BIKE', 'ELECTRIC CYCLE'],
    auto:     ['AUTO', 'E-RICKSHAW', 'E-CART', 'THREE WHEELER', '3-WHEELER'],
    car:      ['MOTOR CAR', 'CAR', 'TAXI', 'MAXI CAB', 'LIGHT MOTOR VEHICLE', 'LMV'],
    xl:       ['SUV', 'MPV', 'MULTI-UTILITY VEHICLE', 'SPORT UTILITY VEHICLE', '6-7 SEATER'],
    premium:  ['PREMIUM CAR', 'SEDAN', 'LICENSED TAXI', 'OLA PREMIUM'],
    luxury:   ['LUXURY CAR', 'GERMAN CAR', 'EXECUTIVE CAR', 'PREMIUM SEDAN'],
};

export const mapRcVehicleType = (rcType = '') => {
    const upper = rcType.toUpperCase();
    for (const [mapped, keywords] of Object.entries(RC_VEHICLE_TYPE_MAP)) {
        if (keywords.some(k => upper.includes(k))) return mapped;
    }
    return null;
};
