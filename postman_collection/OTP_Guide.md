# 🔐 OTP Authentication Guide

## ⚠️ Important: OTP is NOT Fixed "123456"

The system generates a **random 6-digit OTP** for each request. You need to:

1. **Send OTP request** → Get the actual OTP from response
2. **Use that OTP** in verification request

---

## 📋 Step-by-Step Flow

### Step 1: Send OTP
```http
POST {{base_url}}/auth/signin
{
  "phone": "9876543210",
  "role": "passenger"
}
```

**Response Example:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expiryInMinutes": 5,
  "otp": "837294",
  "provider": "console_fallback"
}
```

### Step 2: Verify OTP
```http
POST {{base_url}}/auth/verify-signin
{
  "phone": "9876543210",
  "role": "passenger",
  "otp": "837294"              ← Use OTP from Step 1
}
```

---

## 🚀 Quick Test in Postman

### Option 1: Use Updated Collection
1. Import the updated collection
2. Run **"1. Signin - Send OTP (Rahul)"**
3. **Copy the `otp` value** from response
4. **Set environment variable**: `actual_otp` = [copied OTP]
5. Run **"Login Rahul (Passenger - Has Wallet)"**

### Option 2: Manual Steps
1. **Send OTP** → Get random OTP (e.g., "837294")
2. **Verify OTP** → Use that exact OTP
3. **Copy token** → Set as `{{auth_token}}`

---

## 🔄 Postman Environment Setup

Add this variable to your environment:

| Variable | Value | Description |
|----------|-------|-------------|
| `actual_otp` | *empty initially* | Set this after getting OTP |

---

## 📱 Test Users

| Phone | Name | Role | Wallet |
|-------|------|------|--------|
| **9876543210** | Rahul Sharma | Passenger | ₹500 |
| **9876543211** | Priya Patel | Passenger | ₹0 |
| **9876543212** | Amit Kumar | Driver | ₹5,000 |

---

## 🛠️ Troubleshooting

| Error | Solution |
|-------|----------|
| "Invalid OTP" | You're using wrong OTP. Send new OTP and copy the actual value |
| "OTP expired" | OTP expires in 5 minutes. Send new OTP |
| "Cannot POST /api/v1/auth/verify-otp" | Use `/auth/verify-signin` (not `/auth/verify-otp`) |
| "Role is required" | Include `"role": "passenger"` or `"role": "driver"` |

---

## 💡 Pro Tips

1. **Always get fresh OTP** - don't reuse old ones
2. **Copy OTP carefully** - it's case-sensitive numeric
3. **Set environment variable** for easier testing
4. **Use pre-configured requests** in updated collection

---

## 🎯 Complete Test Flow

```bash
# 1. Send OTP
POST /auth/signin → Get OTP: 837294

# 2. Set environment variable
actual_otp = 837294

# 3. Verify OTP & Get Token
POST /auth/verify-signin → Get JWT token

# 4. Set auth_token
auth_token = eyJhbGciOiJIUzI1NiIs...

# 5. Test APIs
GET /wallet → Should show ₹500 for Rahul
```

**Remember:** OTP changes every time! Always use the fresh OTP from the response.
