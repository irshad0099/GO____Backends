# GoMobility Postman Collection

Complete API collection for Payment & Subscription (Razorpay Integrated)

## 📁 Files

1. **GoMobility_Payment_Subscription_APIs.json** - Main API Collection (42 APIs)
2. **GoMobility_Environment_Local.json** - Local development environment
3. **GoMobility_Test_Environment.json** - Environment with test user credentials
4. **README.md** - This guide

## 🚀 Quick Start (3 Steps)

### Step 1: Seed Test Data

Before using the APIs, seed test users, drivers, rides, and wallets:

**Option A: Run JavaScript seed script**
```bash
cd /path/to/GO____Backends
node scripts/seedTestData.js
```

**Option B: Run SQL directly**
```bash
psql -d your_database_name -f src/infrastructure/database/migrations/044_seed_test_data.sql
```

### Step 2: Import to Postman

1. Open Postman
2. Click **Import** → Select `GoMobility_Payment_Subscription_APIs.json`
3. Click **Import** again → Select `GoMobility_Test_Environment.json`
4. Select **"GoMobility - Test Users Environment"** from dropdown (top-right)

### Step 3: Login & Test

1. Open folder **"🔐 Authentication"**
2. Run **"Login (Rahul - Has Wallet Balance)"** or **"Login (Priya - Empty Wallet)"**
3. Copy the token from response → Set as `{{auth_token}}` or `{{rahul_token}}` in environment

---

## 👥 Test Users (Auto-created by Seed)

| Phone | Name | Role | Wallet Balance | Use Case |
|-------|------|------|----------------|----------|
| **9876543210** | Rahul Sharma | Passenger | ₹500 | Test wallet payments, has balance |
| **9876543211** | Priya Patel | Passenger | ₹0 | Test recharge flow, empty wallet |
| **9876543212** | Amit Kumar | Driver (Available) | ₹5,000 | Online driver, ready for rides |
| **9876543213** | Sunil Verma | Driver (Off-duty) | ₹3,200 | Offline driver |

**OTP for all:** `123456` (in test mode)

## 🚗 Test Rides (Auto-created by Seed)

| Ride ID | Passenger | Driver | Status | Payment | Test Scenario |
|---------|-----------|--------|--------|---------|---------------|
| **RD202401010001** | Rahul | Amit | Completed | Pending UPI | Test Razorpay payment |
| **RD202401010002** | Priya | Sunil | Completed | Pending Cash | Test cash collection |
| **RD202401010003** | Rahul | Amit | In Progress | - | Test ride completion flow |
| **RD202401010004** | Priya | - | Requested | - | Test driver assignment |

---

## 💳 Payment API Test Scenarios

### Scenario 1: Wallet Payment (Rahul)
```
1. POST /auth/signin (phone: 9876543210, OTP: 123456)
2. GET /wallet → Should show ₹500 balance
3. POST /rides/payments/calculate (ride_id: 1)
4. POST /payments/orders (method: wallet)
5. → Payment auto-completed (balance deducted)
```

### Scenario 2: Razorpay UPI Payment (Rahul)
```
1. POST /auth/signin (phone: 9876543210)
2. POST /payments/orders → Creates Razorpay order
3. Use Razorpay test credentials:
   - Card: 5267 3181 8797 5449
   - UPI: success@razorpay
4. POST /payments/verify → Verify payment
```

### Scenario 3: Wallet Recharge (Priya)
```
1. POST /auth/signin (phone: 9876543211)
2. GET /wallet → Shows ₹0 balance
3. POST /wallet/recharge (amount: 1000)
4. Complete Razorpay payment
5. POST /payments/verify
6. GET /wallet → Shows ₹1000 balance
```

### Scenario 4: Cash Collection
```
1. POST /auth/signin (phone: 9876543211 - Priya)
2. POST /payments/orders (ride_id: 2, method: cash)
3. → Auto-confirmed, driver gets credit
```

---

## 📅 Subscription API Test Scenarios

### Buy Subscription (Rahul)
```
1. POST /auth/signin (phone: 9876543210)
2. GET /subscriptions/plans → List plans
3. POST /subscriptions/purchase (plan_id: 1)
4. → Creates Razorpay recurring subscription
5. GET /subscriptions/active → Verify subscription
```

### Apply Subscription Benefits
```
1. POST /subscriptions/apply-benefits
2. Body: { "ride_amount": 350, "ride_id": 1 }
3. → Returns discounted amount
```

---

## 🔧 Environment Variables Reference

### User Tokens (Set after login):
```
{{rahul_token}}     → Token for Rahul (passenger with balance)
{{priya_token}}     → Token for Priya (empty wallet)
{{amit_token}}      → Token for Amit (driver)
```

### Ride IDs:
```
{{ride_1_id}}       → Rahul's completed ride (test payment)
{{ride_2_id}}       → Priya's completed ride (test cash)
{{ride_3_id}}       → Rahul's in-progress ride
{{ride_4_id}}       → Priya's requested ride
```

### Phone Numbers:
```
{{rahul_phone}}     → 9876543210
{{priya_phone}}     → 9876543211
{{amit_phone}}      → 9876543212
```

---

## 🧪 Razorpay Test Credentials

### Test Cards:
| Card Number | CVV | Expiry | Result |
|-------------|-----|--------|--------|
| **5267 3181 8797 5449** | Any | Any future | ✅ Success |
| 4111 1111 1111 1111 | Any | Any future | ✅ Success |
| 4000 0000 0000 0002 | Any | Any | ❌ Declined |

### Test UPI:
```
success@razorpay    → ✅ Success
failure@razorpay    → ❌ Failure
```

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "User not found" | Run seed script first |
| "Invalid OTP" | Use `123456` in test mode |
| 401 Unauthorized | Token expired, login again |
| 404 Ride not found | Use correct ride_id from seed |
| Wallet shows null | Seed didn't run properly, re-run |

---

## 📖 Full API Documentation

See `GoMobility_Payment_Subscription_APIs.json` for all 42 API endpoints including:
- 💳 Wallet (7 endpoints)
- 💰 Payment (11 endpoints)
- 🚗 Ride Payment (3 endpoints)
- 📅 Subscription (9 endpoints)
- 🔴 Admin (2 endpoints)
- 🔄 Webhooks (1 endpoint)

## 🚀 How to Import

### Step 1: Import Collection
1. Open Postman
2. Click "Import" button
3. Select `GoMobility_Payment_Subscription_APIs.json`
4. Click "Import"

### Step 2: Import Environment
1. Click "Import" button again
2. Select `GoMobility_Environment_Local.json`
3. Click "Import"
4. Select "GoMobility - Local Development" from environment dropdown (top-right)

## 🔧 Setup

### 1. Update Environment Variables

| Variable | Description | How to get |
|----------|-------------|------------|
| `base_url` | API base URL | Default: `http://localhost:5000/api/v1` |
| `auth_token` | User JWT token | Run "Login" request first |
| `admin_token` | Admin JWT token | Login with admin credentials |
| `ride_id` | Ride ID for testing | Create a ride first |
| `plan_id` | Subscription plan ID | Check `/subscriptions/plans` |

### 2. Authentication Flow

```
1. POST /auth/signup - Create account (if new)
2. POST /auth/signin - Login
   → Copy token from response
   → Set as {{auth_token}} in environment
```

## 📚 API Categories

### 💳 Wallet APIs
- Get wallet details & balance
- Recharge wallet (via Razorpay)
- Pay for ride using wallet
- Withdraw to bank
- Transaction history

### 💰 Payment APIs
- Create payment order (Cash/Wallet/UPI/Card)
- Verify Razorpay payment
- Process refunds
- Saved payment methods

### 🚗 Ride Payment APIs
- Calculate fare + create order
- Create payment for completed ride
- Check payment status

### 📅 Subscription APIs (Razorpay)
- List plans (public)
- Purchase subscription (recurring)
- Cancel subscription
- Toggle auto-renew
- Apply benefits to ride

## 🔄 Test Flow Example

### Flow 1: Wallet Recharge → Pay for Ride
```
1. POST /auth/signin → Get token
2. GET /wallet → Check balance
3. POST /wallet/recharge → Create Razorpay order
   → Complete payment in Razorpay test mode
   → POST /payments/verify → Verify payment
4. POST /wallet/pay-ride → Pay using wallet
```

### Flow 2: Direct Razorpay Payment
```
1. POST /auth/signin → Get token
2. POST /rides/payments/calculate → Get fare + order
3. Use Razorpay SDK with gateway_order_id
4. POST /payments/verify → Verify payment
```

### Flow 3: Buy Subscription
```
1. POST /auth/signin → Get token
2. GET /subscriptions/plans → Choose plan
3. POST /subscriptions/purchase → Subscribe
   → Razorpay handles recurring payments
4. GET /subscriptions/active → Verify subscription
```

## 🧪 Razorpay Test Cards

### Success Cases:
| Card Number | CVV | Expiry | Result |
|-------------|-----|--------|--------|
| 5267 3181 8797 5449 | Any | Any future | Success |
| 4111 1111 1111 1111 | Any | Any future | Success |

### Failure Cases:
| Card Number | CVV | Expiry | Result |
|-------------|-----|--------|--------|
| 4000 0000 0000 0002 | Any | Any | Card declined |

### UPI Test:
```
VPA: success@razorpay  → Success
VPA: failure@razorpay  → Failure
```

## 🔑 Environment Variables Reference

### Payment Variables:
```
{{order_number}}  → Payment order number (e.g., PAY20240101ABC123)
{{txn_number}}    → Wallet transaction number
{{method_id}}     → Saved payment method ID
```

### Ride Variables:
```
{{ride_id}}       → Ride ID for testing
```

### Subscription Variables:
```
{{plan_id}}       → Subscription plan ID
{{subscription_id}} → Active subscription ID
```

## 📝 Pre-request Scripts

Some requests include automatic variable setting:

### Login Response (sets token automatically):
```javascript
// Tests tab
var jsonData = pm.response.json();
if (jsonData.token) {
    pm.environment.set("auth_token", jsonData.token);
}
```

## ⚠️ Important Notes

1. **Always login first** to set `{{auth_token}}`
2. **Use Razorpay test keys** in development
3. **Webhooks** need to be configured in Razorpay Dashboard
4. **Rate limits** apply - see middleware in code

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check {{auth_token}} is set |
| 404 Not Found | Verify ride/plan ID exists |
| 400 Bad Request | Check request body format |
| 429 Too Many Requests | Wait before retrying |

## 📞 Support

For API issues, check:
1. Server logs in terminal
2. Response error messages
3. Request body format
