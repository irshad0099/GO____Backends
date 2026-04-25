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
