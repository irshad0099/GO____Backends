import sgMail from '@sendgrid/mail';
import logger from '../logger/logger.js';

// ─── Initialize SendGrid ──────────────────────────────────────────────────────
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    logger.info('[Email] SendGrid initialized successfully');
} else {
    logger.warn('[Email] SENDGRID_API_KEY not set — email disabled');
}

// ─── Config ───────────────────────────────────────────────────────────────────
// const FROM = {
//     email: process.env.EMAIL_FROM      || 'mailatgomobility@gmail.com',
//     name:  process.env.EMAIL_FROM_NAME || 'GO Mobility',
// };

const FROM = {
    email: 'mailatgomobility@gmail.com',
    name:  'GO Mobility',
};
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@gomobility.co.in';

// ─── Base Sender ──────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html, text }) => {
    if (!process.env.SENDGRID_API_KEY) {
        logger.warn(`[Email] SendGrid not configured — skipping email to ${to}`);
        return { success: false, reason: 'not_configured' };
    }
    try {
        await sgMail.send({
            to,
            from:    FROM,
            replyTo: REPLY_TO,
            subject,
            html,
            text: text || subject,
        });
        logger.info(`[Email] Sent: "${subject}" → ${to}`);
        return { success: true };
    } catch (error) {
        logger.error(`[Email] Failed to send to ${to}: ${JSON.stringify({
            message:  error?.message,
            code:     error?.code,
            status:   error?.response?.status,
            body:     error?.response?.body,
        })}`);
        return { success: false, error: error.message };
    }
};

// ─── Base HTML Template ───────────────────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; background:#f4f4f4; font-family:Arial,sans-serif; }
    .container { max-width:600px; margin:30px auto; background:#fff; border-radius:8px; overflow:hidden; }
    .header { background:#1e3a8a; padding:24px 30px; }
    .header h1 { color:#fff; margin:0; font-size:22px; letter-spacing:0.5px; }
    .header p { color:#93c5fd; margin:4px 0 0; font-size:13px; }
    .body { padding:28px 30px; }
    .body p { color:#374151; font-size:14px; line-height:1.7; margin:0 0 14px; }
    .info-box { background:#f8fafc; border-radius:6px; padding:16px 20px; margin:16px 0; }
    .info-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #e2e8f0; font-size:13px; }
    .info-row:last-child { border-bottom:none; }
    .info-label { color:#6b7280; }
    .info-value { color:#111827; font-weight:600; }
    .total-row { background:#dcfce7; border-radius:6px; padding:12px 16px; display:flex; justify-content:space-between; margin:16px 0; }
    .total-label { color:#166534; font-weight:600; font-size:15px; }
    .total-value { color:#15803d; font-weight:700; font-size:18px; }
    .footer { background:#f8fafc; padding:18px 30px; text-align:center; border-top:1px solid #e2e8f0; }
    .footer p { color:#9ca3af; font-size:12px; margin:4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GO Mobility</h1>
      <p>Your trusted ride partner</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>GO Mobility — Gurgaon | Noida | Delhi</p>
      <p>Questions? Contact <a href="mailto:support@gomobility.co.in">support@gomobility.co.in</a></p>
      <p style="color:#d1d5db;font-size:11px;margin-top:8px;">This is an automated email. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>`;

// ─── 1. Ride Receipt ──────────────────────────────────────────────────────────
export const sendRideReceipt = async ({
    to, riderName, rideNumber, vehicleType,
    pickupAddress, dropoffAddress,
    distanceKm, durationMinutes,
    baseFare, distanceFare, convenienceFee,
    surgeMultiplier, finalFare,
    paymentMethod, rideDate,
    subscriptionDiscount = 0, couponDiscount = 0, isFreeRide = false,
}) => {
    const content = `
        <p>Hi <strong>${riderName}</strong>,</p>
        <p>Thank you for riding with GO Mobility! Here is your ride receipt.</p>
        <div class="info-box">
            <div class="info-row"><span class="info-label">Ride Number</span><span class="info-value">${rideNumber}</span></div>
            <div class="info-row"><span class="info-label">Vehicle Type</span><span class="info-value">${vehicleType.toUpperCase()}</span></div>
            <div class="info-row"><span class="info-label">Date</span><span class="info-value">${new Date(rideDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></div>
            <div class="info-row"><span class="info-label">Pickup</span><span class="info-value">${pickupAddress}</span></div>
            <div class="info-row"><span class="info-label">Dropoff</span><span class="info-value">${dropoffAddress}</span></div>
            <div class="info-row"><span class="info-label">Distance</span><span class="info-value">${distanceKm} km</span></div>
            <div class="info-row"><span class="info-label">Duration</span><span class="info-value">${durationMinutes} min</span></div>
        </div>
        <div class="info-box">
            <div class="info-row"><span class="info-label">Base Fare</span><span class="info-value">Rs. ${baseFare}</span></div>
            <div class="info-row"><span class="info-label">Distance Fare</span><span class="info-value">Rs. ${distanceFare}</span></div>
            <div class="info-row"><span class="info-label">Convenience Fee</span><span class="info-value">Rs. ${convenienceFee}</span></div>
            ${surgeMultiplier > 1 ? `<div class="info-row"><span class="info-label">Surge (${surgeMultiplier}x)</span><span class="info-value">Applied</span></div>` : ''}
            ${subscriptionDiscount > 0 ? `<div class="info-row"><span class="info-label">Subscription Discount</span><span class="info-value" style="color:#15803d;">- Rs. ${subscriptionDiscount}</span></div>` : ''}
            ${couponDiscount > 0 ? `<div class="info-row"><span class="info-label">Coupon Discount</span><span class="info-value" style="color:#15803d;">- Rs. ${couponDiscount}</span></div>` : ''}
        </div>
        <div class="total-row">
            <span class="total-label">${isFreeRide ? 'FREE RIDE' : 'Total Amount'}</span>
            <span class="total-value">${isFreeRide ? 'Rs. 0 (Free!)' : `Rs. ${finalFare}`}</span>
        </div>
        <p><strong>Payment Method:</strong> ${paymentMethod.toUpperCase()}</p>
        <p style="color:#6b7280;font-size:13px;">We hope you had a great ride! Rate your experience in the GO Mobility app.</p>`;

    return sendEmail({
        to,
        subject: `Your GO Mobility Ride Receipt — ${rideNumber}`,
        html: baseTemplate(content),
    });
};

// ─── 2. Ride Cancelled ────────────────────────────────────────────────────────
export const sendRideCancelledEmail = async ({
    to, riderName, rideNumber, cancelledBy, reason,
}) => {
    const content = `
        <p>Hi <strong>${riderName}</strong>,</p>
        <p>Your ride <strong>${rideNumber}</strong> has been cancelled.</p>
        <div class="info-box">
            <div class="info-row"><span class="info-label">Ride Number</span><span class="info-value">${rideNumber}</span></div>
            <div class="info-row"><span class="info-label">Cancelled By</span><span class="info-value">${cancelledBy}</span></div>
            <div class="info-row"><span class="info-label">Reason</span><span class="info-value">${reason || 'Not specified'}</span></div>
        </div>
        <p>Please book a new ride from the GO Mobility app. We apologize for the inconvenience.</p>`;

    return sendEmail({
        to,
        subject: `Ride Cancelled — ${rideNumber}`,
        html: baseTemplate(content),
    });
};

// ─── 3. Wallet Recharge ───────────────────────────────────────────────────────
export const sendWalletRechargeEmail = async ({
    to, userName, amount, newBalance, txnNumber, paymentMethod,
}) => {
    const content = `
        <p>Hi <strong>${userName}</strong>,</p>
        <p>Your GO Mobility wallet has been recharged successfully!</p>
        <div class="info-box">
            <div class="info-row"><span class="info-label">Transaction ID</span><span class="info-value">${txnNumber}</span></div>
            <div class="info-row"><span class="info-label">Amount Added</span><span class="info-value" style="color:#15803d;">+ Rs. ${amount}</span></div>
            <div class="info-row"><span class="info-label">Payment Method</span><span class="info-value">${paymentMethod.toUpperCase()}</span></div>
            <div class="info-row"><span class="info-label">New Balance</span><span class="info-value">Rs. ${newBalance}</span></div>
        </div>
        <p>Your wallet is ready to use for your next ride!</p>`;

    return sendEmail({
        to,
        subject: `Wallet Recharged — Rs. ${amount} Added`,
        html: baseTemplate(content),
    });
};

// ─── 4. Subscription Purchase ─────────────────────────────────────────────────
export const sendSubscriptionEmail = async ({
    to, userName, planName, price, expiresAt, benefits = {},
}) => {
    const content = `
        <p>Hi <strong>${userName}</strong>,</p>
        <p>Welcome to <strong>${planName}</strong>! Your subscription is now active.</p>
        <div class="info-box">
            <div class="info-row"><span class="info-label">Plan</span><span class="info-value">${planName}</span></div>
            <div class="info-row"><span class="info-label">Amount Paid</span><span class="info-value">Rs. ${price}</span></div>
            <div class="info-row"><span class="info-label">Valid Until</span><span class="info-value">${new Date(expiresAt).toLocaleDateString('en-IN')}</span></div>
            ${benefits.rideDiscountPercent ? `<div class="info-row"><span class="info-label">Ride Discount</span><span class="info-value">${benefits.rideDiscountPercent}% on every ride</span></div>` : ''}
            ${benefits.freeRidesPerMonth ? `<div class="info-row"><span class="info-label">Free Rides</span><span class="info-value">${benefits.freeRidesPerMonth} per month</span></div>` : ''}
            ${benefits.surgeProtection ? `<div class="info-row"><span class="info-label">Surge Protection</span><span class="info-value">Included</span></div>` : ''}
        </div>
        <p>Enjoy your rides with exclusive benefits. Thank you for subscribing to GO Mobility!</p>`;

    return sendEmail({
        to,
        subject: `Welcome to ${planName} — GO Mobility`,
        html: baseTemplate(content),
    });
};

// ─── 5. OTP Email ─────────────────────────────────────────────────────────────
export const sendOtpEmail = async ({ to, userName, otp, purpose = 'login' }) => {
    const content = `
        <p>Hi <strong>${userName || 'User'}</strong>,</p>
        <p>Your OTP for GO Mobility ${purpose} is:</p>
        <div style="text-align:center;margin:24px 0;">
            <div style="display:inline-block;background:#1e3a8a;color:#fff;font-size:36px;font-weight:700;letter-spacing:12px;padding:16px 32px;border-radius:8px;">${otp}</div>
        </div>
        <p style="color:#6b7280;font-size:13px;">This OTP is valid for 5 minutes. Do not share it with anyone.</p>
        <p style="color:#6b7280;font-size:13px;">If you did not request this, please ignore this email.</p>`;

    return sendEmail({
        to,
        subject: `Your GO Mobility OTP: ${otp}`,
        html: baseTemplate(content),
    });
};

// ─── 6. Welcome Email ─────────────────────────────────────────────────────────
export const sendWelcomeEmail = async ({ to, userName }) => {
    const content = `
        <p>Hi <strong>${userName}</strong>,</p>
        <p>Welcome to <strong>GO Mobility</strong>! We are thrilled to have you on board.</p>
        <div class="info-box">
            <div class="info-row"><span class="info-label">Safe Rides</span><span class="info-value">Verified drivers only</span></div>
            <div class="info-row"><span class="info-label">Fair Pricing</span><span class="info-value">Transparent fare breakdown</span></div>
            <div class="info-row"><span class="info-label">24/7 Support</span><span class="info-value">Always here to help</span></div>
        </div>
        <p>Book your first ride now and experience the GO Mobility difference!</p>`;

    return sendEmail({
        to,
        subject: 'Welcome to GO Mobility!',
        html: baseTemplate(content),
    });
};

export default {
    sendRideReceipt,
    sendRideCancelledEmail,
    sendWalletRechargeEmail,
    sendSubscriptionEmail,
    sendOtpEmail,
    sendWelcomeEmail,
};