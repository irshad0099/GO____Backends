
# MSG91 OTP Integration Guide

## Overview
MSG91 integration for OTP sending is now fully implemented across your GoMobility application. OTPs are sent to users for:
- **Auth Module**: Sign-up and Sign-in
- **Ride Module**: When driver arrives at pickup location

---

## Setup Instructions

### 1. Get MSG91 Credentials

1. Sign up at [msg91.com](https://msg91.com)
2. Get your credentials from dashboard:
   - **Auth Key**: From Settings → API Keys
   - **Sender ID**: From Settings → Sender IDs (request approval for custom sender)
   - **Template ID**: (Optional) For DLT template management (not required for basic usage)

### 2. Update `.env` File

```bash
# SMS Provider Configuration
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=506821TbG1fEjv2sE69d937cfP1
MSG91_SENDER_ID=GoMob              # Max 6 characters
MSG91_TEMPLATE_ID=                 # Optional: for DLT templates

# OTP Configuration
OTP_EXPIRY_MINUTES=5
OTP_LENGTH=4
OTP_MAX_ATTEMPTS=3
```

### 3. Verify Environment Variables

Run this to test if variables are loaded:

```bash
node -e "import('./src/config/envConfig.js').then(m => console.log('MSG91_AUTH_KEY:', !!m.ENV.MSG91_AUTH_KEY, 'SMS_PROVIDER:', m.ENV.SMS_PROVIDER))"
```

---

## Integration Points

### Authentication (Signup & Signin)

**Endpoints:**
- `POST /api/v1/auth/signup` → Triggers `sendOTP(phone, 'signup')`
- `POST /api/v1/auth/signin` → Triggers `sendOTP(phone, 'signin')`

**Flow:**
```
User provides phone → OTP generated → Saved to DB → SMS sent to phone
```

**Database Table:** `otps`
```sql
SELECT * FROM otps WHERE phone_number = '+919876543210';
```

---

### Ride Module (Driver Arrival)

**Automatic OTP Generation:**
When driver status changes to `driver_arrived`, OTP is automatically generated and sent to passenger.

**Manual OTP Generation Endpoint:**
```bash
POST /api/v1/rides/:rideId/generate-otp
Authorization: Bearer {driver_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": 123,
    "otpCode": "4521",
    "expiresAt": "2026-04-10T23:15:30Z",
    "smsSent": true,
    "message": "OTP sent to your phone. Share with driver to start the ride"
  }
}
```

**OTP Verification:**
```bash
POST /api/v1/rides/:rideId/verify-otp
Authorization: Bearer {driver_token}
Body: { "otp": "4521" }
```

**Database Table:** `ride_otps`
```sql
SELECT * FROM ride_otps WHERE ride_id = 123 ORDER BY created_at DESC;
```

---

## Logging & Debugging

### Log Files Location
All logs are stored in `logs/app.log` with structured JSON format.

### Monitoring OTP Flows

#### 1. **Check OTP Sending Logs**
```bash
grep "📤 SMS sending" logs/app.log | tail -20
grep "✅ SMS sent successfully" logs/app.log | tail -20
grep "❌ SMS sending failed" logs/app.log | tail -20
```

#### 2. **Check MSG91 API Response**
```bash
grep "📡 MSG91 API" logs/app.log
grep "📨 MSG91 API Response" logs/app.log
```

#### 3. **See All OTP Activities**
```bash
grep "OTP\|otp" logs/app.log | grep -E "✅|❌|📤|📲"
```

#### 4. **Filter by Phone Number** (last 4 digits logged for privacy)
```bash
grep "9876" logs/app.log  # Replace with last 4 digits
```

#### 5. **Check for Failures**
```bash
grep "❌" logs/app.log | grep -i "otp\|sms"
```

### Log Structure

Every OTP operation logs with:
- **Status indicator**: ✅ (success), ❌ (failed), 📤 (sending), 📲 (received)
- **Phone number**: Last 4 digits only (privacy)
- **Purpose**: `signup`, `signin`, `otp_ride_start`
- **Duration**: How long the operation took
- **Error details**: If failed, includes error message
- **Message ID**: MSG91 response tracking

### Example Log Entries

**Successful Send:**
```json
{
  "level": "info",
  "message": "✅ OTP sent successfully via MSG91",
  "phone": "3210",
  "purpose": "otp_signin",
  "messageId": "msg91_12345",
  "duration": 245,
  "provider": "msg91"
}
```

**Failed Send:**
```json
{
  "level": "error",
  "message": "❌ MSG91 SMS failed",
  "phone": "3210",
  "purpose": "otp_signup",
  "error": "MSG91 API error: 401 - Authentication failed",
  "duration": 1200
}
```

---

## Common Issues & Solutions

### Issue 1: Invalid AUTH_KEY

**Error Log:**
```
MSG91_AUTH_KEY not configured
or
MSG91 API error: 401 - Authentication failed
```

**Solution:**
1. Verify AUTH_KEY in MSG91 dashboard
2. Copy exact value (no spaces)
3. Update `.env` file:
   ```bash
   MSG91_AUTH_KEY=your_exact_key_here
   ```
4. Restart server
5. Check logs: `grep "MSG91_AUTH_KEY" logs/app.log`

### Issue 2: Invalid Phone Number

**Error Log:**
```
Invalid phone number format
```

**Solution:**
- Only Indian 10-digit numbers are accepted
- Valid format: `9876543210` or `+919876543210`
- First digit must be 6-9
- Function: `validatePhoneNumber()` in `sms.provider.js`

### Issue 3: SMS Not Received

**Debugging Steps:**

1. **Check if SMS was sent to MSG91:**
   ```bash
   grep "✅ SMS sent successfully via MSG91" logs/app.log
   ```
   If not found, OTP wasn't sent to MSG91.

2. **Check MSG91 API response:**
   ```bash
   grep "📨 MSG91 API Response" logs/app.log
   grep -A 5 "MSG91 API Request" logs/app.log
   ```

3. **Check Message ID:**
   ```bash
   grep "messageId" logs/app.log | tail -5
   ```
   Go to MSG91 dashboard → Messages → search by Message ID

4. **Check OTP was saved to DB:**
   ```sql
   SELECT * FROM otps WHERE phone_number = '+919876543210' ORDER BY created_at DESC LIMIT 1;
   ```

5. **Check Ride OTP if applicable:**
   ```sql
   SELECT * FROM ride_otps WHERE ride_id = 123 ORDER BY created_at DESC LIMIT 1;
   ```

### Issue 4: Rate Limiting

**Error Log:**
```
OTP_RATE_LIMIT_MAX exceeded
```

**Solution:**
Check `.env` settings:
```bash
OTP_RATE_LIMIT_MAX=3  # Max OTP requests per user
OTP_EXPIRY_MINUTES=5  # OTP valid for 5 minutes
```

### Issue 5: Network/Connectivity Issues

**Error Log:**
```
ECONNREFUSED or timeout errors
```

**Solution:**
1. Check internet connection
2. Verify MSG91 API endpoint is reachable:
   ```bash
   curl https://api.msg91.com/api/v5/send -v
   ```
3. Check firewall/proxy settings

---

## Testing in Development

### 1. Console Mode (Default)
```bash
SMS_PROVIDER=console
```
OTPs are logged to console instead of sent to MSG91. Useful for development.

### 2. Test MSG91 in Dev

1. Set up `.env`:
   ```bash
   SMS_PROVIDER=msg91
   MSG91_AUTH_KEY=test_key
   ```

2. Use a test phone number
3. Monitor logs in real-time:
   ```bash
   tail -f logs/app.log | grep -E "OTP|SMS|MSG91"
   ```

### 3. Manual Testing via Postman

**Test Signup OTP:**
```bash
POST http://localhost:5000/api/v1/auth/signup
{
  "phone": "9876543210",
  "email": "user@example.com",
  "fullName": "Test User",
  "role": "passenger"
}
```

Check logs for OTP send status.

**Verify OTP:**
```bash
POST http://localhost:5000/api/v1/auth/verify-signup
{
  "phone": "9876543210",
  "otp": "OTP_FROM_SMS",
  "email": "user@example.com",
  "fullName": "Test User",
  "role": "passenger"
}
```

---

## Production Debugging Checklist

Before deploying to production:

- [ ] **Verify MSG91 credentials:**
  ```bash
  grep "🔌 Initializing MSG91" logs/app.log
  grep "authKeyPresent\|templateIdPresent\|senderIdPresent" logs/app.log
  ```

- [ ] **Test with real number** (use your own number first)

- [ ] **Monitor first 100 OTP sends** for any failures:
  ```bash
  grep "❌ SMS sending failed" logs/app.log | wc -l
  ```

- [ ] **Set up log rotation** (logs can grow large):
  ```bash
  # Update LOG_FILE in .env or use logrotate
  ```

- [ ] **Configure alerts** for OTP failures:
  - Monitor for `"❌ SMS sending failed"`
  - Alert if rate > 5% of OTP attempts

- [ ] **Document your MSG91 daily quota:**
  - Check MSG91 dashboard for limits
  - Set warning threshold at 80% usage

---

## Key Files

| File | Purpose |
|------|---------|
| `src/infrastructure/external/sms.provider.js` | SMS provider with MSG91 implementation |
| `src/modules/auth/services/otpService.js` | Authentication OTP logic |
| `src/modules/rides/services/rideOtpService.js` | Ride OTP logic |
| `src/modules/rides/services/rideService.js` | Triggers OTP on driver arrival |
| `src/config/envConfig.js` | Environment configuration |
| `logs/app.log` | Application logs |

---

## Future Enhancements

- [ ] Add SMS delivery status webhook from MSG91
- [ ] Implement OTP retry with exponential backoff
- [ ] Add analytics for OTP success rate
- [ ] Support template-based messages for DLT compliance
- [ ] Add Twilio as fallback provider

---

## Support

For MSG91 support:
- **Dashboard**: https://msg91.com/dashboard
- **API Docs**: https://help.msg91.com/api
- **Support**: support@msg91.com

For issues in this integration, check:
1. `logs/app.log` for detailed error logs
2. MSG91 dashboard for message delivery status
3. Database for OTP records
