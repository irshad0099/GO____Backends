import axios from 'axios';
import { ENV } from '../../../config/envConfig.js';
import logger from '../../../core/logger/logger.js';

const BASE_URL = ENV.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/verification'
    : 'https://sandbox.cashfree.com/verification';

const headers = () => ({
    'x-client-id':     ENV.CASHFREE_CLIENT_ID,
    'x-client-secret': ENV.CASHFREE_CLIENT_SECRET,
    'Content-Type':    'application/json',
});

// ─── Aadhaar ─────────────────────────────────────────────────────────────────

/**
 * Step 1: Send OTP to Aadhaar-linked mobile
 * Returns ref_id to be used in verifyAadhaarOtp
 */
export const generateAadhaarOtp = async (aadhaarNumber) => {
    const response = await axios.post(
        `${BASE_URL}/offline-aadhaar/generate-otp`,
        { aadhaar_number: aadhaarNumber, consent: 'Y' },
        { headers: headers() }
    );
    // response.data = { ref_id, message, status }
    return response.data;
};

/**
 * Step 2: Verify OTP — returns full Aadhaar details on success
 */
export const verifyAadhaarOtp = async (refId, otp) => {
    const response = await axios.post(
        `${BASE_URL}/offline-aadhaar/verify-otp`,
        { ref_id: refId, otp },
        { headers: headers() }
    );
    // response.data = { status, aadhaar_data: { name, dob, gender, address, ... } }
    return response.data;
};

// ─── PAN ─────────────────────────────────────────────────────────────────────

/**
 * Instant PAN verification — returns name, dob, status
 */
export const verifyPan = async (panNumber, name) => {
    const response = await axios.post(
        `${BASE_URL}/pan`,
        { pan: panNumber, name },
        { headers: headers() }
    );
    // response.data = { status, name_match, pan_data: { name, dob, ... } }
    return response.data;
};

// ─── Bank Account ─────────────────────────────────────────────────────────────

/**
 * Synchronous bank account verification via penny drop
 */
export const verifyBankAccount = async (accountNumber, ifsc, name) => {
    const response = await axios.post(
        `${BASE_URL}/bank-account/sync`,
        { bank_account: accountNumber, ifsc, name },
        { headers: headers() }
    );
    // response.data = { account_status, name_at_bank, bank_name, ... }
    return response.data;
};

// ─── Driving License ─────────────────────────────────────────────────────────

/**
 * Verify driving license digitally
 * Returns name, dob, issuing_authority, status
 */
export const verifyDrivingLicense = async (idNumber, dob, name) => {
    const response = await axios.post(
        `${BASE_URL}/driving-license`,
        { id_number: idNumber, dob, name },
        { headers: headers() }
    );
    // response.data = { status, name, dob, issuing_authority, reference_id }
    return response.data;
};

// ─── Vehicle RC ───────────────────────────────────────────────────────────────

/**
 * Verify vehicle Registration Certificate (RC)
 * Returns owner_name, vehicle_model, fuel_type, registration_date, vehicle_class
 */
export const verifyVehicleRC = async (rcNumber) => {
    const response = await axios.post(
        `${BASE_URL}/rc`,
        { id_number: rcNumber },
        { headers: headers() }
    );
    // response.data = { status, owner_name, vehicle_model, fuel_type, registration_date, vehicle_class, reference_id }
    return response.data;
};

// ─── Face Match ───────────────────────────────────────────────────────────────

/**
 * Compare two face images (base64 encoded)
 * Returns match score 0–100
 */
export const matchFace = async (image1Base64, image2Base64) => {
    const response = await axios.post(
        `${BASE_URL}/face-match`,
        { image1: image1Base64, image2: image2Base64 },
        { headers: headers() }
    );
    // response.data = { match, match_score }
    return response.data;
};
