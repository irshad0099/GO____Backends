import axios from 'axios';
import crypto from 'crypto';
import { ENV } from '../../../config/envConfig.js';
import logger from '../../../core/logger/logger.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const CF_BASE = ENV.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/verification'
    : 'https://sandbox.cashfree.com/verification';

const logCfError = (fn, err) => {
    logger.error(`[Cashfree:${fn}] status=${err.response?.status} body=${JSON.stringify(err.response?.data)}`);
};

/**
 * x-cf-signature: RSA-OAEP-SHA1 encrypt (clientId + "." + epochSeconds) with Cashfree public key
 */
const generateSignature = () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const data      = ENV.CASHFREE_CLIENT_ID + '.' + timestamp;
    const encrypted = crypto.publicEncrypt(
        {
            key:     ENV.CASHFREE_PUBLIC_KEY,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha1',
        },
        Buffer.from(data)
    );
    return encrypted.toString('base64');
};

const cfHeaders = () => ({
    'x-client-id':     ENV.CASHFREE_CLIENT_ID,
    'x-client-secret': ENV.CASHFREE_CLIENT_SECRET,
    'x-api-version':   '2024-12-01',
    'x-cf-signature':  generateSignature(),
    'Content-Type':    'application/json',
});

// ─── Bank Account ─────────────────────────────────────────────────────────────

/**
 * Synchronous bank account verification via penny drop
 */
export const verifyBankAccount = async (accountNumber, ifsc, name) => {
    try {
        const res = await axios.post(
            `${CF_BASE}/bank-account/sync`,
            { bank_account: accountNumber, ifsc, name },
            { headers: cfHeaders() }
        );
        return res.data;
    } catch (err) {
        logCfError('verifyBankAccount', err);
        throw err;
    }
};

// ─── Smart OCR (Bharat OCR) ──────────────────────────────────────────────────

/**
 * Upload a document image/PDF → Cashfree extracts fields + runs quality/fraud checks
 * documentType: 'PAN' | 'AADHAAR' | 'DRIVING_LICENCE' | 'VEHICLE_RC' | 'VOTER_ID' | 'PASSPORT' | 'CANCELLED_CHEQUE' | 'INVOICE'
 * doVerification: true → verifies against govt DB (only PAN + DL supported)
 */
export const smartOcr = async ({ documentType, fileBuffer, fileName, mimeType, doVerification = false }) => {
    try {
       const form = new FormData();

form.append('verification_id', `ocr_${Date.now()}`);
form.append('document_type', documentType);
form.append('do_verification', String(doVerification));

const blob = new Blob([fileBuffer], { type: mimeType });

const ext =
  mimeType === "image/png" ? "png" :
  mimeType === "application/pdf" ? "pdf" :
  "jpg";

const safeFileName = `kyc_${Date.now()}.${ext}`;

form.append('file', blob, safeFileName);
        console.log(`Submitting ${documentType} OCR to Cashfree (file: ${safeFileName}, mime: ${mimeType}, size: ${fileBuffer.length} bytes)`);
        const headers = cfHeaders();
        delete headers['Content-Type'];

        const res = await axios.post(
            `${CF_BASE}/bharat-ocr`,
            form,
            { headers, maxBodyLength: Infinity, maxContentLength: Infinity }
        );
        console.log('Cashfree OCR response:', res.data);
        return res.data;
    } catch (err) {
        logCfError('smartOcr', err);
        throw err;
    }
};

// ─── Face Match ───────────────────────────────────────────────────────────────

/**
 * Compare two face images (base64 encoded)
 */
export const matchFace = async (image1Base64, image2Base64) => {
    try {
        const res = await axios.post(
            `${CF_BASE}/face-match`,
            { image1: image1Base64, image2: image2Base64 },
            { headers: cfHeaders() }
        );
        return res.data;
    } catch (err) {
        logCfError('matchFace', err);
        throw err;
    }
};


// ─── VAHAN RC Verification ────────────────────────────────────────────────────
export const verifyVehicleRC = async (rcNumber, dob = null) => {
    try {
        const payload = {
            verification_id: `vahan_${Date.now()}`,
            rc_number:       rcNumber.toUpperCase(),
        };
        if (dob) payload.dob = dob;

        const res = await axios.post(
            `${CF_BASE}/rc`,
            payload,
            { headers: cfHeaders() }
        );
        return res.data;
    } catch (err) {
        logCfError('verifyVehicleRC', err);
        throw err;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
//  CASHFREE PAYOUTS — Driver Withdrawal
//  Docs: https://docs.cashfree.com/reference/payouts-api-overview
// ═════════════════════════════════════════════════════════════════════════════

const CF_PAYOUT_BASE = ENV.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/payout'
    : 'https://sandbox.cashfree.com/payout';

const cfPayoutHeaders = () => ({
    'x-client-id':     ENV.CASHFREE_CLIENT_ID,
    'x-client-secret': ENV.CASHFREE_CLIENT_SECRET,
    'x-api-version':   '2024-01-01',
    'Content-Type':    'application/json',
});

/**
 * Step 1 — Register beneficiary (driver ka bank account) on Cashfree
 * Beneficiary ID humara hai (unique per registration), Cashfree wahi store karta hai
 */
export const addPayoutBeneficiary = async ({ driverUserId, holderName, phone, accountNumber, ifsc }) => {
    const beneficiaryId = `DRIVER_${driverUserId}_${Date.now()}`;

    const payload = {
        beneficiary_id:   beneficiaryId,
        beneficiary_name: holderName,
        beneficiary_instrument_details: {
            bank_account_number: accountNumber,
            bank_ifsc:           ifsc,
        },
        beneficiary_contact_details: {
            beneficiary_phone:        phone,
            beneficiary_country_code: '+91',
        },
    };

    try {
        const res = await axios.post(
            `${CF_PAYOUT_BASE}/beneficiary`,
            payload,
            { headers: cfPayoutHeaders() }
        );

        return {
            beneficiaryId:     res.data.beneficiary_id     || beneficiaryId,
            beneficiaryStatus: res.data.beneficiary_status || 'VERIFIED',
        };
    } catch (err) {
        logCfError('addPayoutBeneficiary', err);
        throw err;
    }
};

/**
 * Step 2 — Initiate transfer to beneficiary
 * NOTE: Response status "RECEIVED" is NOT final.
 * Final SUCCESS/FAILED status aata hai webhook se.
 */
export const createPayout = async ({ amount, beneficiaryId, transferId }) => {
    const payload = {
        transfer_id:     transferId,
        transfer_amount: amount,
        beneficiary_details: {
            beneficiary_id: beneficiaryId,
        },
        ...(ENV.CASHFREE_FUNDSOURCE_ID && {
            fundsource_id: ENV.CASHFREE_FUNDSOURCE_ID,
        }),
    };

    try {
        const res = await axios.post(
            `${CF_PAYOUT_BASE}/transfers`,
            payload,
            { headers: cfPayoutHeaders() }
        );

        return {
            transferId:   res.data.transfer_id    || transferId,
            cfTransferId: res.data.cf_transfer_id || null,
            status:       res.data.status         || 'RECEIVED',
            amount,
        };
    } catch (err) {
        logCfError('createPayout', err);
        throw err;
    }
};

/**
 * Verify Cashfree payout webhook signature
 * Cashfree sends: x-webhook-signature = base64(HMAC-SHA256(timestamp + rawBody, clientSecret))
 * Reference: https://docs.cashfree.com/docs/payout-webhooks#webhook-signature-verification
 */
export const verifyPayoutWebhookSignature = ({ signature, timestamp, rawBody }) => {
    if (!signature || !timestamp || !rawBody) return false;
    try {
        const data     = timestamp + rawBody;
        const expected = crypto
            .createHmac('sha256', ENV.CASHFREE_CLIENT_SECRET)
            .update(data)
            .digest('base64');
        return expected === signature;
    } catch (err) {
        logger.error(`[Cashfree:verifyPayoutWebhookSignature] ${err.message}`);
        return false;
    }
};