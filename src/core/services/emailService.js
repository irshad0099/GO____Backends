



// import sgMail from '@sendgrid/mail';
// import logger from '../logger/logger.js';

// // ─── Initialize SendGrid ──────────────────────────────────────────────────────
// if (process.env.SENDGRID_API_KEY) {
//     sgMail.setApiKey(process.env.SENDGRID_API_KEY);
//     logger.info('[Email] SendGrid initialized successfully');
// } else {
//     logger.warn('[Email] SENDGRID_API_KEY not set — email disabled');
// }

// const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@gomobility.co.in';

// // ─── Base Sender ──────────────────────────────────────────────────────────────
// const sendEmail = async ({ to, subject, html, text }) => {
//     const FROM = {
//         email: process.env.EMAIL_FROM || 'mailatgomobility@gmail.com',
//         name:  process.env.EMAIL_FROM_NAME || 'GO Mobility',
//     };
//     const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@gomobility.co.in';

//     if (!process.env.SENDGRID_API_KEY) {
//         logger.warn(`[Email] SendGrid not configured — skipping email to ${to}`);
//         return { success: false, reason: 'not_configured' };
//     }
//     try {
//         await sgMail.send({ to, from: FROM, replyTo: REPLY_TO, subject, html, text: text || subject });
//         logger.info(`[Email] Sent: "${subject}" → ${to}`);
//         return { success: true };
//     } catch (error) {
//         logger.error(`[Email] Failed to send to ${to}: ${JSON.stringify({
//             message: error?.message,
//             code:    error?.code,
//             status:  error?.response?.status,
//             body:    error?.response?.body,
//         })}`);
//         return { success: false, error: error.message };
//     }
// };

// // ─── Base HTML Template ───────────────────────────────────────────────────────
// const baseTemplate = ({ content, accentColor = '#1e3a8a', badge = null }) => `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8"/>
//   <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
//   <title>GO Mobility</title>
// </head>
// <body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
//   <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:30px 0;">
//     <tr><td align="center">
//       <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

//         <!-- HEADER -->
//         <tr>
//           <td style="background:linear-gradient(135deg,#0f2460 0%,${accentColor} 60%,#1a4fc4 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
//             <!-- Logo Area -->
//             <table width="100%" cellpadding="0" cellspacing="0">
//               <tr>
//                 <td align="center" style="padding-bottom:16px;">
//                   <div style="display:inline-block;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.3);border-radius:16px;padding:10px 20px;">
//                     <span style="font-size:28px;font-weight:900;color:#fff;letter-spacing:2px;font-family:Georgia,serif;">GO</span>
//                     <span style="font-size:18px;font-weight:600;color:#93c5fd;letter-spacing:4px;margin-left:4px;">MOBILITY</span>
//                   </div>
//                 </td>
//               </tr>
//               ${badge ? `
//               <tr>
//                 <td align="center">
//                   <div style="display:inline-block;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);border-radius:100px;padding:6px 18px;font-size:11px;color:#bfdbfe;letter-spacing:2px;font-weight:600;text-transform:uppercase;">${badge}</div>
//                 </td>
//               </tr>` : ''}
//             </table>
//           </td>
//         </tr>

//         <!-- BODY -->
//         <tr>
//           <td style="background:#ffffff;padding:36px 40px;">
//             ${content}
//           </td>
//         </tr>

//         <!-- FOOTER -->
//         <tr>
//           <td style="background:#1e293b;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
//             <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">GO Mobility — Gurgaon &nbsp;|&nbsp; Noida &nbsp;|&nbsp; Delhi</p>
//             <p style="margin:0;">
//               <a href="mailto:support@gomobility.co.in" style="color:#60a5fa;font-size:11px;text-decoration:none;">support@gomobility.co.in</a>
//               &nbsp;&nbsp;|&nbsp;&nbsp;
//               <span style="color:#64748b;font-size:11px;">+91 98765 43210</span>
//             </p>
//             <p style="color:#475569;font-size:10px;margin:12px 0 0;border-top:1px solid #334155;padding-top:12px;">
//               This is an automated email. Please do not reply directly. &copy; 2026 GO Mobility. All rights reserved.
//             </p>
//           </td>
//         </tr>

//         <!-- BOTTOM SPACER -->
//         <tr><td style="height:24px;"></td></tr>

//       </table>
//     </td></tr>
//   </table>
// </body>
// </html>`;

// // ─── Helper: Row ──────────────────────────────────────────────────────────────
// const row = (label, value, valueColor = '#111827') => `
//   <tr>
//     <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#6b7280;width:45%;">${label}</td>
//     <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:${valueColor};font-weight:600;text-align:right;">${value}</td>
//   </tr>`;

// // ─── Helper: Section Title ────────────────────────────────────────────────────
// const sectionTitle = (text) => `
//   <p style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin:24px 0 8px;">${text}</p>`;

// // ─── Helper: Divider ─────────────────────────────────────────────────────────
// const divider = () => `<hr style="border:none;border-top:1px dashed #e2e8f0;margin:20px 0;"/>`;

// // ─── 1. Ride Receipt ──────────────────────────────────────────────────────────
// export const sendRideReceipt = async ({
//     to, riderName, rideNumber, vehicleType,
//     pickupAddress, dropoffAddress,
//     distanceKm, durationMinutes,
//     baseFare, distanceFare, convenienceFee,
//     surgeMultiplier, finalFare,
//     paymentMethod, rideDate,
//     subscriptionDiscount = 0, couponDiscount = 0, isFreeRide = false,
// }) => {
//     const vehicleEmoji = { bike:'🏍️', auto:'🛺', car:'🚗', xl:'🚙', premium:'🚘', luxury:'🏎️' };
//     const emoji = vehicleEmoji[vehicleType?.toLowerCase()] || '🚗';

//     const content = `
//       <!-- Greeting -->
//       <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Hi ${riderName}! 👋</p>
//       <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Your ride has been completed. Here's your receipt.</p>

//       <!-- Ride Number Badge -->
//       <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:24px;text-align:center;">
//         <p style="font-size:11px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px;">Ride Number</p>
//         <p style="font-size:20px;font-weight:800;color:#0f172a;margin:0;font-family:monospace;">${rideNumber}</p>
//         <p style="font-size:12px;color:#64748b;margin:6px 0 0;">${new Date(rideDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</p>
//       </div>

//       <!-- Route Card -->
//       <div style="background:linear-gradient(135deg,#eff6ff,#f0fdf4);border-radius:12px;padding:20px;margin-bottom:24px;">
//         <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
//           <div style="width:10px;height:10px;background:#22c55e;border-radius:50%;margin-top:4px;flex-shrink:0;"></div>
//           <div style="margin-left:12px;">
//             <p style="font-size:10px;color:#16a34a;font-weight:600;text-transform:uppercase;margin:0;">Pickup</p>
//             <p style="font-size:13px;color:#0f172a;font-weight:600;margin:2px 0 0;">${pickupAddress}</p>
//           </div>
//         </div>
//         <div style="margin-left:4px;border-left:2px dashed #cbd5e1;height:16px;margin-bottom:12px;"></div>
//         <div style="display:flex;align-items:flex-start;">
//           <div style="width:10px;height:10px;background:#ef4444;border-radius:50%;margin-top:4px;flex-shrink:0;"></div>
//           <div style="margin-left:12px;">
//             <p style="font-size:10px;color:#dc2626;font-weight:600;text-transform:uppercase;margin:0;">Dropoff</p>
//             <p style="font-size:13px;color:#0f172a;font-weight:600;margin:2px 0 0;">${dropoffAddress}</p>
//           </div>
//         </div>
//       </div>

//       <!-- Trip Info -->
//       <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;margin-bottom:24px;">
//         <tr>
//           <td style="padding:16px;text-align:center;border-right:1px solid #e2e8f0;">
//             <p style="font-size:20px;margin:0;">${emoji}</p>
//             <p style="font-size:11px;color:#64748b;margin:4px 0 0;">${vehicleType?.toUpperCase()}</p>
//           </td>
//           <td style="padding:16px;text-align:center;border-right:1px solid #e2e8f0;">
//             <p style="font-size:18px;font-weight:700;color:#0f172a;margin:0;">${distanceKm} km</p>
//             <p style="font-size:11px;color:#64748b;margin:4px 0 0;">Distance</p>
//           </td>
//           <td style="padding:16px;text-align:center;">
//             <p style="font-size:18px;font-weight:700;color:#0f172a;margin:0;">${durationMinutes} min</p>
//             <p style="font-size:11px;color:#64748b;margin:4px 0 0;">Duration</p>
//           </td>
//         </tr>
//       </table>

//       <!-- Fare Breakdown -->
//       ${sectionTitle('Fare Breakdown')}
//       <table width="100%" cellpadding="0" cellspacing="0">
//         ${row('Base Fare', `Rs. ${baseFare}`)}
//         ${row('Distance Fare', `Rs. ${distanceFare}`)}
//         ${row('Convenience Fee', `Rs. ${convenienceFee}`)}
//         ${surgeMultiplier > 1 ? row(`Surge (${surgeMultiplier}x)`, 'Applied', '#f59e0b') : ''}
//         ${subscriptionDiscount > 0 ? row('Subscription Discount', `- Rs. ${subscriptionDiscount}`, '#16a34a') : ''}
//         ${couponDiscount > 0 ? row('Coupon Discount', `- Rs. ${couponDiscount}`, '#16a34a') : ''}
//       </table>

//       ${divider()}

//       <!-- Total -->
//       <div style="background:${isFreeRide ? 'linear-gradient(135deg,#dcfce7,#bbf7d0)' : 'linear-gradient(135deg,#1e3a8a,#1a4fc4)'};border-radius:12px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;margin:4px 0 24px;">
//         <div>
//           <p style="font-size:11px;color:${isFreeRide ? '#16a34a' : '#93c5fd'};font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0;">${isFreeRide ? '🎉 Free Ride!' : 'Total Amount'}</p>
//           <p style="font-size:13px;color:${isFreeRide ? '#166534' : '#bfdbfe'};margin:4px 0 0;">Paid via ${paymentMethod?.toUpperCase()}</p>
//         </div>
//         <p style="font-size:28px;font-weight:800;color:${isFreeRide ? '#15803d' : '#ffffff'};margin:0;">${isFreeRide ? 'Rs. 0' : `Rs. ${finalFare}`}</p>
//       </div>

//       <!-- CTA -->
//       <div style="text-align:center;margin-top:8px;">
//         <p style="font-size:13px;color:#64748b;">Enjoyed your ride? Rate your experience in the <strong>GO Mobility</strong> app!</p>
//         <div style="display:inline-block;background:#fbbf24;border-radius:8px;padding:2px 4px;font-size:20px;letter-spacing:4px;margin-top:4px;">⭐⭐⭐⭐⭐</div>
//       </div>`;

//     return sendEmail({
//         to,
//         subject: `🧾 Your Ride Receipt — ${rideNumber}`,
//         html: baseTemplate({ content, badge: 'Ride Complete' }),
//     });
// };

// // ─── 2. Ride Cancelled ────────────────────────────────────────────────────────
// export const sendRideCancelledEmail = async ({
//     to, riderName, rideNumber, cancelledBy, reason,
// }) => {
//     const content = `
//       <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Hi ${riderName},</p>
//       <p style="font-size:14px;color:#64748b;margin:0 0 24px;">We're sorry, your ride has been cancelled.</p>

//       <!-- Alert Box -->
//       <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
//         <p style="font-size:36px;margin:0;">😔</p>
//         <p style="font-size:16px;font-weight:700;color:#c2410c;margin:8px 0 4px;">Ride Cancelled</p>
//         <p style="font-size:13px;color:#9a3412;margin:0;font-family:monospace;">${rideNumber}</p>
//       </div>

//       <table width="100%" cellpadding="0" cellspacing="0">
//         ${row('Cancelled By', cancelledBy)}
//         ${row('Reason', reason || 'Not specified')}
//       </table>

//       ${divider()}

//       <div style="text-align:center;background:#f0fdf4;border-radius:12px;padding:20px;margin-top:8px;">
//         <p style="font-size:14px;color:#15803d;font-weight:600;margin:0 0 4px;">No worries!</p>
//         <p style="font-size:13px;color:#64748b;margin:0;">Book a new ride anytime from the GO Mobility app.</p>
//       </div>`;

//     return sendEmail({
//         to,
//         subject: `❌ Ride Cancelled — ${rideNumber}`,
//         html: baseTemplate({ content, accentColor: '#dc2626', badge: 'Ride Cancelled' }),
//     });
// };

// // ─── 3. Wallet Recharge ───────────────────────────────────────────────────────
// export const sendWalletRechargeEmail = async ({
//     to, userName, amount, newBalance, txnNumber, paymentMethod,
// }) => {
//     const content = `
//       <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Hi ${userName}! 💰</p>
//       <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Your GO Mobility wallet has been recharged successfully!</p>

//       <!-- Amount Badge -->
//       <div style="background:linear-gradient(135deg,#dcfce7,#bbf7d0);border:1.5px solid #86efac;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
//         <p style="font-size:13px;color:#16a34a;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">Amount Added</p>
//         <p style="font-size:42px;font-weight:900;color:#15803d;margin:0;">+ Rs. ${amount}</p>
//       </div>

//       <table width="100%" cellpadding="0" cellspacing="0">
//         ${row('Transaction ID', txnNumber, '#0f172a')}
//         ${row('Payment Method', paymentMethod?.toUpperCase())}
//         ${row('New Wallet Balance', `Rs. ${newBalance}`, '#15803d')}
//         ${row('Status', '✅ Success', '#16a34a')}
//       </table>

//       ${divider()}

//       <div style="text-align:center;background:#eff6ff;border-radius:12px;padding:20px;margin-top:8px;">
//         <p style="font-size:14px;color:#1d4ed8;font-weight:600;margin:0 0 4px;">Wallet Ready! 🚀</p>
//         <p style="font-size:13px;color:#64748b;margin:0;">Use your wallet balance for seamless ride payments.</p>
//       </div>`;

//     return sendEmail({
//         to,
//         subject: `💰 Wallet Recharged — Rs. ${amount} Added`,
//         html: baseTemplate({ content, accentColor: '#15803d', badge: 'Wallet Recharge' }),
//     });
// };

// // ─── 4. Subscription Purchase ─────────────────────────────────────────────────
// export const sendSubscriptionEmail = async ({
//     to, userName, planName, price, expiresAt, benefits = {},
// }) => {
//     const planEmoji = planName?.toLowerCase().includes('elite') ? '👑' :
//                       planName?.toLowerCase().includes('prime') ? '⭐' :
//                       planName?.toLowerCase().includes('annual') ? '🏆' : '✨';

//     const content = `
//       <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Hi ${userName}! ${planEmoji}</p>
//       <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Welcome to <strong>${planName}</strong>! Your subscription is now active.</p>

//       <!-- Plan Badge -->
//       <div style="background:linear-gradient(135deg,#1e3a8a,#4f46e5);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
//         <p style="font-size:40px;margin:0 0 8px;">${planEmoji}</p>
//         <p style="font-size:22px;font-weight:800;color:#fff;margin:0 0 4px;">${planName}</p>
//         <p style="font-size:28px;font-weight:900;color:#fbbf24;margin:8px 0 0;">Rs. ${price}</p>
//         <p style="font-size:12px;color:#a5b4fc;margin:4px 0 0;">Valid until ${new Date(expiresAt).toLocaleDateString('en-IN')}</p>
//       </div>

//       ${sectionTitle('Your Benefits')}
//       <table width="100%" cellpadding="0" cellspacing="0">
//         ${benefits.rideDiscountPercent ? row('🎯 Ride Discount', `${benefits.rideDiscountPercent}% on every ride`, '#7c3aed') : ''}
//         ${benefits.freeRidesPerMonth ? row('🎁 Free Rides', `${benefits.freeRidesPerMonth} rides per month`, '#16a34a') : ''}
//         ${benefits.priorityBooking ? row('⚡ Priority Booking', 'Included', '#16a34a') : ''}
//         ${benefits.cancellationWaiver ? row('🛡️ Cancellation Waiver', 'Included', '#16a34a') : ''}
//         ${benefits.surgeProtection ? row('🔒 Surge Protection', 'Included', '#16a34a') : ''}
//       </table>

//       ${divider()}

//       <div style="text-align:center;background:#fdf4ff;border-radius:12px;padding:20px;margin-top:8px;">
//         <p style="font-size:14px;color:#7c3aed;font-weight:600;margin:0 0 4px;">Enjoy Your Premium Rides! 🚀</p>
//         <p style="font-size:13px;color:#64748b;margin:0;">Thank you for subscribing to GO Mobility ${planName}.</p>
//       </div>`;

//     return sendEmail({
//         to,
//         subject: `${planEmoji} Welcome to ${planName} — GO Mobility`,
//         html: baseTemplate({ content, accentColor: '#4f46e5', badge: `${planName} Active` }),
//     });
// };

// // ─── 5. OTP Email ─────────────────────────────────────────────────────────────
// export const sendOtpEmail = async ({ to, userName, otp, purpose = 'login' }) => {
//     const content = `
//       <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Hi ${userName || 'User'}! 👋</p>
//       <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Here is your One-Time Password for GO Mobility ${purpose}.</p>

//       <!-- OTP Box -->
//       <div style="background:linear-gradient(135deg,#1e3a8a,#1a4fc4);border-radius:16px;padding:36px;text-align:center;margin-bottom:24px;">
//         <p style="font-size:12px;color:#93c5fd;letter-spacing:3px;text-transform:uppercase;margin:0 0 16px;">Your OTP</p>
//         <div style="background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.2);border-radius:12px;padding:20px 32px;display:inline-block;">
//           <p style="font-size:48px;font-weight:900;color:#fff;letter-spacing:16px;margin:0;font-family:monospace;">${otp}</p>
//         </div>
//         <p style="font-size:12px;color:#93c5fd;margin:16px 0 0;">⏱️ Valid for 5 minutes only</p>
//       </div>

//       <!-- Warning -->
//       <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:16px 20px;text-align:center;">
//         <p style="font-size:13px;color:#c2410c;font-weight:600;margin:0 0 4px;">🔒 Security Notice</p>
//         <p style="font-size:12px;color:#9a3412;margin:0;">Never share this OTP with anyone. GO Mobility will never ask for your OTP.</p>
//       </div>`;

//     return sendEmail({
//         to,
//         subject: `🔐 Your GO Mobility OTP: ${otp}`,
//         html: baseTemplate({ content, badge: 'Secure Login' }),
//     });
// };

// // ─── 6. Welcome Email ─────────────────────────────────────────────────────────
// export const sendWelcomeEmail = async ({ to, userName }) => {
//     const content = `
//       <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Welcome, ${userName}! 🎉</p>
//       <p style="font-size:14px;color:#64748b;margin:0 0 24px;">We're excited to have you on board. Your GO Mobility account is ready!</p>

//       <!-- Welcome Banner -->
//       <div style="background:linear-gradient(135deg,#1e3a8a,#4f46e5);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
//         <p style="font-size:48px;margin:0 0 8px;">🚀</p>
//         <p style="font-size:20px;font-weight:800;color:#fff;margin:0 0 4px;">Ready to Ride!</p>
//         <p style="font-size:13px;color:#a5b4fc;margin:0;">Book your first ride and experience the GO Mobility difference</p>
//       </div>

//       ${sectionTitle('Why GO Mobility?')}
//       <table width="100%" cellpadding="0" cellspacing="0">
//         ${row('🛡️ Safe Rides', 'Verified drivers only', '#16a34a')}
//         ${row('💰 Fair Pricing', 'Transparent fare breakdown', '#0284c7')}
//         ${row('⚡ Fast Booking', 'Driver in minutes', '#7c3aed')}
//         ${row('📱 Real-time Tracking', 'Live ride updates', '#0f172a')}
//         ${row('🎁 Subscription Plans', 'Save more on every ride', '#b45309')}
//         ${row('🕐 24/7 Support', 'Always here to help', '#64748b')}
//       </table>

//       ${divider()}

//       <div style="text-align:center;background:#f0fdf4;border-radius:12px;padding:20px;margin-top:8px;">
//         <p style="font-size:14px;color:#15803d;font-weight:600;margin:0 0 4px;">Book Your First Ride! 🚗</p>
//         <p style="font-size:13px;color:#64748b;margin:0;">Open the GO Mobility app and start your journey.</p>
//       </div>`;

//     return sendEmail({
//         to,
//         subject: '🎉 Welcome to GO Mobility!',
//         html: baseTemplate({ content, badge: 'Welcome Aboard' }),
//     });
// };

// export default {
//     sendRideReceipt,
//     sendRideCancelledEmail,
//     sendWalletRechargeEmail,
//     sendSubscriptionEmail,
//     sendOtpEmail,
//     sendWelcomeEmail,
// };




import sgMail from '@sendgrid/mail';
import logger from '../logger/logger.js';

// ─── Initialize SendGrid ──────────────────────────────────────────────────────
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    logger.info('[Email] SendGrid initialized successfully');
} else {
    logger.warn('[Email] SENDGRID_API_KEY not set — email disabled');
}

const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@gomobility.co.in';

// ─── Base Sender ──────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html, text }) => {
    const FROM = {
        email: process.env.EMAIL_FROM || 'mailatgomobility@gmail.com',
        name:  process.env.EMAIL_FROM_NAME || 'GO Mobility',
    };
    const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@gomobility.co.in';

    if (!process.env.SENDGRID_API_KEY) {
        logger.warn(`[Email] SendGrid not configured — skipping email to ${to}`);
        return { success: false, reason: 'not_configured' };
    }
    try {
        await sgMail.send({ to, from: FROM, replyTo: REPLY_TO, subject, html, text: text || subject });
        logger.info(`[Email] Sent: "${subject}" → ${to}`);
        return { success: true };
    } catch (error) {
        logger.error(`[Email] Failed to send to ${to}: ${JSON.stringify({
            message: error?.message,
            code:    error?.code,
            status:  error?.response?.status,
            body:    error?.response?.body,
        })}`);
        return { success: false, error: error.message };
    }
};

// ─── Base HTML Template ───────────────────────────────────────────────────────
const baseTemplate = ({ content, accentColor = '#1e3a8a', badge = null }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>GO Mobility</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0f2460 0%,${accentColor} 60%,#1a4fc4 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.3);border-radius:16px;padding:10px 20px;margin-bottom:12px;">
              <span style="font-size:28px;font-weight:900;color:#fff;letter-spacing:2px;font-family:Georgia,serif;">GO</span>
              <span style="font-size:18px;font-weight:600;color:#93c5fd;letter-spacing:4px;margin-left:4px;">MOBILITY</span>
            </div>
            ${badge ? `<br><div style="display:inline-block;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);border-radius:100px;padding:6px 18px;font-size:11px;color:#bfdbfe;letter-spacing:2px;font-weight:600;text-transform:uppercase;">${badge}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 40px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background:#1e293b;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">GO Mobility — Gurgaon &nbsp;|&nbsp; Noida &nbsp;|&nbsp; Delhi</p>
            <p style="margin:0;">
              <a href="mailto:support@gomobility.co.in" style="color:#60a5fa;font-size:11px;text-decoration:none;">support@gomobility.co.in</a>
              &nbsp;&nbsp;|&nbsp;&nbsp;
              <span style="color:#64748b;font-size:11px;">+91 98765 43210</span>
            </p>
            <p style="color:#475569;font-size:10px;margin:12px 0 0;border-top:1px solid #334155;padding-top:12px;">
              This is an automated email. Please do not reply directly. &copy; 2026 GO Mobility. All rights reserved.
            </p>
          </td>
        </tr>
        <tr><td style="height:24px;"></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const row = (label, value, valueColor = '#111827') => `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#6b7280;width:55%;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:${valueColor};font-weight:600;text-align:right;">${value}</td>
  </tr>`;

const sectionTitle = (text) => `
  <p style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin:20px 0 6px;">${text}</p>`;

const divider = () => `<hr style="border:none;border-top:1px dashed #e2e8f0;margin:16px 0;"/>`;

const badge = (text, bg, color) => `
  <span style="display:inline-block;background:${bg};color:${color};font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;letter-spacing:1px;text-transform:uppercase;">${text}</span>`;

// ─── 1. Ride Receipt ──────────────────────────────────────────────────────────
export const sendRideReceipt = async ({
    to, riderName, rideNumber, vehicleType,
    pickupAddress, dropoffAddress,
    distanceKm, durationMinutes,
    baseFare, distanceFare, convenienceFee,
    surgeMultiplier, finalFare,
    paymentMethod, rideDate,
    subscriptionDiscount = 0, couponDiscount = 0, isFreeRide = false,
    // New fields
    timeFare = 0,
    waitingCharges = 0,
    pickupCompensation = 0,
    trafficCompensation = 0,
    gstOnFare = 0,
    isPeak = false,
    peakReason = null,
    fareBeforeGst = null,
    couponCode = null,
}) => {
    const vehicleEmoji = { bike:'🏍️', auto:'🛺', car:'🚗', xl:'🚙', premium:'🚘', luxury:'🏎️' };
    const emoji = vehicleEmoji[vehicleType?.toLowerCase()] || '🚗';

    // Calculate subtotal before discounts
    const subtotal = fareBeforeGst || finalFare;

    const content = `
      <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Hi ${riderName}! 👋</p>
      <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Your ride has been completed. Here's your payment receipt.</p>

      <!-- Ride Number Badge -->
      <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:center;">
        <p style="font-size:10px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px;">Ride Number</p>
        <p style="font-size:20px;font-weight:800;color:#0f172a;margin:0;font-family:monospace;">${rideNumber}</p>
        <p style="font-size:12px;color:#64748b;margin:6px 0 0;">${new Date(rideDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })}</p>
        ${isPeak ? `<div style="margin-top:8px;">${badge('⚡ Peak Hour', '#fef3c7', '#92400e')}</div>` : ''}
      </div>

      <!-- Route Card -->
      <div style="background:linear-gradient(135deg,#eff6ff,#f0fdf4);border-radius:12px;padding:18px 20px;margin-bottom:20px;">
        <div style="display:flex;align-items:flex-start;margin-bottom:8px;">
          <div style="width:10px;height:10px;background:#22c55e;border-radius:50%;margin-top:3px;flex-shrink:0;"></div>
          <div style="margin-left:12px;">
            <p style="font-size:9px;color:#16a34a;font-weight:700;text-transform:uppercase;margin:0;letter-spacing:1px;">Pickup</p>
            <p style="font-size:13px;color:#0f172a;font-weight:600;margin:2px 0 0;">${pickupAddress}</p>
          </div>
        </div>
        <div style="margin-left:4px;border-left:2px dashed #cbd5e1;height:14px;margin-bottom:8px;margin-top:4px;"></div>
        <div style="display:flex;align-items:flex-start;">
          <div style="width:10px;height:10px;background:#ef4444;border-radius:50%;margin-top:3px;flex-shrink:0;"></div>
          <div style="margin-left:12px;">
            <p style="font-size:9px;color:#dc2626;font-weight:700;text-transform:uppercase;margin:0;letter-spacing:1px;">Dropoff</p>
            <p style="font-size:13px;color:#0f172a;font-weight:600;margin:2px 0 0;">${dropoffAddress}</p>
          </div>
        </div>
      </div>

      <!-- Trip Stats Grid -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;margin-bottom:20px;overflow:hidden;">
        <tr>
          <td style="padding:14px 10px;text-align:center;border-right:1px solid #e2e8f0;">
            <p style="font-size:18px;margin:0;">${emoji}</p>
            <p style="font-size:10px;color:#64748b;margin:4px 0 0;font-weight:600;">${vehicleType?.toUpperCase()}</p>
          </td>
          <td style="padding:14px 10px;text-align:center;border-right:1px solid #e2e8f0;">
            <p style="font-size:16px;font-weight:700;color:#0f172a;margin:0;">${distanceKm} km</p>
            <p style="font-size:10px;color:#64748b;margin:4px 0 0;">Distance</p>
          </td>
          <td style="padding:14px 10px;text-align:center;border-right:1px solid #e2e8f0;">
            <p style="font-size:16px;font-weight:700;color:#0f172a;margin:0;">${durationMinutes} min</p>
            <p style="font-size:10px;color:#64748b;margin:4px 0 0;">Duration</p>
          </td>
          <td style="padding:14px 10px;text-align:center;">
            <p style="font-size:16px;font-weight:700;color:#0f172a;margin:0;">${paymentMethod?.toUpperCase()}</p>
            <p style="font-size:10px;color:#64748b;margin:4px 0 0;">Payment</p>
          </td>
        </tr>
      </table>

      <!-- Fare Breakdown -->
      ${sectionTitle('Fare Breakdown')}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Base Fare', `Rs. ${Number(baseFare).toFixed(2)}`)}
        ${row(`Distance Fare (${distanceKm} km)`, `Rs. ${Number(distanceFare).toFixed(2)}`)}
        ${timeFare > 0 ? row(`Time Fare (${durationMinutes} min)`, `Rs. ${Number(timeFare).toFixed(2)}`) : ''}
        ${isPeak ? row(`Convenience Fee ${badge('Peak', '#fef3c7', '#92400e')}`, `Rs. ${Number(convenienceFee).toFixed(2)}`, '#92400e') : row('Convenience Fee', `Rs. ${Number(convenienceFee).toFixed(2)}`)}
        ${surgeMultiplier > 1 ? row(`Surge Multiplier ${badge(surgeMultiplier+'x', '#fff7ed', '#c2410c')}`, 'Applied', '#c2410c') : ''}
        ${waitingCharges > 0 ? row('Waiting Charges', `Rs. ${Number(waitingCharges).toFixed(2)}`, '#f59e0b') : ''}
        ${pickupCompensation > 0 ? row('Pickup Distance Compensation', `Rs. ${Number(pickupCompensation).toFixed(2)}`) : ''}
        ${trafficCompensation > 0 ? row('Traffic Delay Compensation', `Rs. ${Number(trafficCompensation).toFixed(2)}`) : ''}
        ${gstOnFare > 0 ? row('GST', `Rs. ${Number(gstOnFare).toFixed(2)}`) : ''}
      </table>

      ${divider()}

      <!-- Subtotal before discounts -->
      ${sectionTitle('Summary')}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Subtotal', `Rs. ${Number(subtotal).toFixed(2)}`)}
        ${subscriptionDiscount > 0 ? row(`Subscription Discount ${badge('Prime Pass', '#ede9fe', '#5b21b6')}`, `- Rs. ${Number(subscriptionDiscount).toFixed(2)}`, '#16a34a') : ''}
        ${couponDiscount > 0 ? row(`Coupon Discount ${couponCode ? badge(couponCode, '#dcfce7', '#166534') : ''}`, `- Rs. ${Number(couponDiscount).toFixed(2)}`, '#16a34a') : ''}
      </table>

      ${divider()}

      <!-- Total -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${isFreeRide ? 'linear-gradient(135deg,#dcfce7,#bbf7d0)' : 'linear-gradient(135deg,#1e3a8a,#1a4fc4)'};border-radius:12px;margin:4px 0 24px;">
        <tr>
          <td style="padding:20px 22px;">
            <p style="font-size:10px;color:${isFreeRide ? '#16a34a' : '#93c5fd'};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0;">${isFreeRide ? '🎉 Free Ride — Prime Pass' : 'Total Amount'}</p>
            <p style="font-size:12px;color:${isFreeRide ? '#166534' : '#bfdbfe'};margin:4px 0 0;">Paid via ${paymentMethod?.toUpperCase()}</p>
          </td>
          <td style="padding:20px 22px;text-align:right;">
            <p style="font-size:28px;font-weight:800;color:${isFreeRide ? '#15803d' : '#ffffff'};margin:0;">${isFreeRide ? 'Rs. 0' : `Rs. ${Number(finalFare).toFixed(2)}`}</p>
            ${isFreeRide ? `<p style="font-size:11px;color:#16a34a;margin:4px 0 0;">Saved Rs. ${Number(subscriptionDiscount).toFixed(2)}</p>` : ''}
          </td>
        </tr>
      </table>

      <!-- Rating CTA -->
      <div style="text-align:center;background:#f8fafc;border-radius:12px;padding:18px;border:1.5px solid #e2e8f0;">
        <p style="font-size:13px;color:#0f172a;font-weight:600;margin:0 0 4px;">How was your ride?</p>
        <p style="font-size:12px;color:#64748b;margin:0 0 8px;">Rate your experience in the GO Mobility app!</p>
        <div style="font-size:22px;letter-spacing:6px;">⭐⭐⭐⭐⭐</div>
      </div>`;

    return sendEmail({
        to,
        subject: `🧾 Your Ride Receipt — ${rideNumber}`,
        html: baseTemplate({ content, badge: 'Ride Complete ✓' }),
    });
};

// ─── 2. Ride Cancelled ────────────────────────────────────────────────────────
export const sendRideCancelledEmail = async ({
    to, riderName, rideNumber, cancelledBy, reason,
}) => {
    const content = `
      <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Hi ${riderName},</p>
      <p style="font-size:14px;color:#64748b;margin:0 0 24px;">We're sorry, your ride has been cancelled.</p>
      <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
        <p style="font-size:32px;margin:0;">😔</p>
        <p style="font-size:16px;font-weight:700;color:#c2410c;margin:8px 0 4px;">Ride Cancelled</p>
        <p style="font-size:12px;color:#9a3412;margin:0;font-family:monospace;">${rideNumber}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Cancelled By', cancelledBy)}
        ${row('Reason', reason || 'Not specified')}
      </table>
      ${divider()}
      <div style="text-align:center;background:#f0fdf4;border-radius:12px;padding:20px;">
        <p style="font-size:14px;color:#15803d;font-weight:600;margin:0 0 4px;">No worries!</p>
        <p style="font-size:13px;color:#64748b;margin:0;">Book a new ride anytime from the GO Mobility app.</p>
      </div>`;

    return sendEmail({
        to,
        subject: `❌ Ride Cancelled — ${rideNumber}`,
        html: baseTemplate({ content, accentColor: '#dc2626', badge: 'Ride Cancelled' }),
    });
};

// ─── 3. Wallet Recharge ───────────────────────────────────────────────────────
export const sendWalletRechargeEmail = async ({
    to, userName, amount, newBalance, txnNumber, paymentMethod,
}) => {
    const content = `
      <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Hi ${userName}! 💰</p>
      <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Your GO Mobility wallet has been recharged successfully!</p>
      <div style="background:linear-gradient(135deg,#dcfce7,#bbf7d0);border:1.5px solid #86efac;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
        <p style="font-size:11px;color:#16a34a;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">Amount Added</p>
        <p style="font-size:42px;font-weight:900;color:#15803d;margin:0;">+ Rs. ${amount}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Transaction ID', txnNumber)}
        ${row('Payment Method', paymentMethod?.toUpperCase())}
        ${row('New Wallet Balance', `Rs. ${newBalance}`, '#15803d')}
        ${row('Status', '✅ Success', '#16a34a')}
      </table>
      ${divider()}
      <div style="text-align:center;background:#eff6ff;border-radius:12px;padding:20px;">
        <p style="font-size:14px;color:#1d4ed8;font-weight:600;margin:0 0 4px;">Wallet Ready! 🚀</p>
        <p style="font-size:13px;color:#64748b;margin:0;">Use your wallet balance for seamless ride payments.</p>
      </div>`;

    return sendEmail({
        to,
        subject: `💰 Wallet Recharged — Rs. ${amount} Added`,
        html: baseTemplate({ content, accentColor: '#15803d', badge: 'Wallet Recharge' }),
    });
};

// ─── 4. Subscription Purchase ─────────────────────────────────────────────────
export const sendSubscriptionEmail = async ({
    to, userName, planName, price, expiresAt, benefits = {},
}) => {
    const planEmoji = planName?.toLowerCase().includes('elite') ? '👑' :
                      planName?.toLowerCase().includes('prime') ? '⭐' :
                      planName?.toLowerCase().includes('annual') ? '🏆' : '✨';

    const content = `
      <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Hi ${userName}! ${planEmoji}</p>
      <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Welcome to <strong>${planName}</strong>! Your subscription is now active.</p>
      <div style="background:linear-gradient(135deg,#1e3a8a,#4f46e5);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
        <p style="font-size:36px;margin:0 0 8px;">${planEmoji}</p>
        <p style="font-size:22px;font-weight:800;color:#fff;margin:0 0 4px;">${planName}</p>
        <p style="font-size:28px;font-weight:900;color:#fbbf24;margin:8px 0 0;">Rs. ${price}</p>
        <p style="font-size:12px;color:#a5b4fc;margin:6px 0 0;">Valid until ${new Date(expiresAt).toLocaleDateString('en-IN', { dateStyle:'long' })}</p>
      </div>
      ${sectionTitle('Your Benefits')}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${benefits.rideDiscountPercent ? row('🎯 Ride Discount', `${benefits.rideDiscountPercent}% on every ride`, '#7c3aed') : ''}
        ${benefits.freeRidesPerMonth ? row('🎁 Free Rides', `${benefits.freeRidesPerMonth} rides per month`, '#16a34a') : ''}
        ${benefits.priorityBooking ? row('⚡ Priority Booking', 'Included ✓', '#16a34a') : ''}
        ${benefits.cancellationWaiver ? row('🛡️ Cancellation Waiver', 'Included ✓', '#16a34a') : ''}
        ${benefits.surgeProtection ? row('🔒 Surge Protection', 'Included ✓', '#16a34a') : ''}
      </table>
      ${divider()}
      <div style="text-align:center;background:#fdf4ff;border-radius:12px;padding:20px;">
        <p style="font-size:14px;color:#7c3aed;font-weight:600;margin:0 0 4px;">Enjoy Your Premium Rides! 🚀</p>
        <p style="font-size:13px;color:#64748b;margin:0;">Thank you for subscribing to GO Mobility ${planName}.</p>
      </div>`;

    return sendEmail({
        to,
        subject: `${planEmoji} Welcome to ${planName} — GO Mobility`,
        html: baseTemplate({ content, accentColor: '#4f46e5', badge: `${planName} Active` }),
    });
};

// ─── 5. OTP Email ─────────────────────────────────────────────────────────────
export const sendOtpEmail = async ({ to, userName, otp, purpose = 'login' }) => {
    const content = `
      <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Hi ${userName || 'User'}! 👋</p>
      <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Here is your One-Time Password for GO Mobility ${purpose}.</p>
      <div style="background:linear-gradient(135deg,#1e3a8a,#1a4fc4);border-radius:16px;padding:36px;text-align:center;margin-bottom:24px;">
        <p style="font-size:11px;color:#93c5fd;letter-spacing:3px;text-transform:uppercase;margin:0 0 16px;">Your OTP</p>
        <div style="background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.2);border-radius:12px;padding:20px 32px;display:inline-block;">
          <p style="font-size:48px;font-weight:900;color:#fff;letter-spacing:16px;margin:0;font-family:monospace;">${otp}</p>
        </div>
        <p style="font-size:12px;color:#93c5fd;margin:16px 0 0;">⏱️ Valid for 5 minutes only</p>
      </div>
      <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:16px 20px;text-align:center;">
        <p style="font-size:13px;color:#c2410c;font-weight:600;margin:0 0 4px;">🔒 Security Notice</p>
        <p style="font-size:12px;color:#9a3412;margin:0;">Never share this OTP with anyone. GO Mobility will never ask for your OTP.</p>
      </div>`;

    return sendEmail({
        to,
        subject: `🔐 Your GO Mobility OTP: ${otp}`,
        html: baseTemplate({ content, badge: 'Secure Login' }),
    });
};

// ─── 6. Welcome Email ─────────────────────────────────────────────────────────
export const sendWelcomeEmail = async ({ to, userName }) => {
    const content = `
      <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 4px;">Welcome, ${userName}! 🎉</p>
      <p style="font-size:14px;color:#64748b;margin:0 0 24px;">We're excited to have you on board. Your GO Mobility account is ready!</p>
      <div style="background:linear-gradient(135deg,#1e3a8a,#4f46e5);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
        <p style="font-size:48px;margin:0 0 8px;">🚀</p>
        <p style="font-size:20px;font-weight:800;color:#fff;margin:0 0 4px;">Ready to Ride!</p>
        <p style="font-size:13px;color:#a5b4fc;margin:0;">Book your first ride and experience the GO Mobility difference</p>
      </div>
      ${sectionTitle('Why GO Mobility?')}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('🛡️ Safe Rides', 'Verified drivers only', '#16a34a')}
        ${row('💰 Fair Pricing', 'Transparent fare breakdown', '#0284c7')}
        ${row('⚡ Fast Booking', 'Driver in minutes', '#7c3aed')}
        ${row('📱 Real-time Tracking', 'Live ride updates', '#0f172a')}
        ${row('🎁 Subscription Plans', 'Save more on every ride', '#b45309')}
        ${row('🕐 24/7 Support', 'Always here to help', '#64748b')}
      </table>
      ${divider()}
      <div style="text-align:center;background:#f0fdf4;border-radius:12px;padding:20px;">
        <p style="font-size:14px;color:#15803d;font-weight:600;margin:0 0 4px;">Book Your First Ride! 🚗</p>
        <p style="font-size:13px;color:#64748b;margin:0;">Open the GO Mobility app and start your journey.</p>
      </div>`;

    return sendEmail({
        to,
        subject: '🎉 Welcome to GO Mobility!',
        html: baseTemplate({ content, badge: 'Welcome Aboard' }),
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