# Subscription Flow — Frontend Integration Guide

Base URL: `{{base_url}}/api/v1`  
Auth: Har request me `Authorization: Bearer <token>` header zaroori hai.

---

## Flow Overview

```
Plans dekho → Plan select karo → Purchase karo → (UPI/Card) → Verify karo → Active ✅
```

---

## Step 1 — Plans List karo

**Auth zaroori nahi.**

```
GET /subscriptions/plans
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "planId": 1,
      "name": "Monthly Pass",
      "slug": "monthly-pass",
      "description": "30 din ke liye unlimited rides",
      "price": 299.00,
      "durationDays": 30,
      "benefits": {
        "rideDiscountPercent": 15.0,
        "freeRidesPerMonth": 5,
        "priorityBooking": true,
        "cancellationWaiver": true,
        "surgeProtection": false
      },
      "isActive": true,
      "createdAt": "2026-05-01T00:00:00.000Z"
    }
  ]
}
```

---

## Step 2 — Active Subscription Check karo (optional)

Purchase se pehle check karo ki user ke paas already subscription hai ya nahi.

```
GET /subscriptions/active
Authorization: Bearer <token>
```

**Response (subscription hai):**
```json
{
  "success": true,
  "hasActiveSubscription": true,
  "data": {
    "subscriptionId": 12,
    "plan": {
      "planId": 1,
      "name": "Monthly Pass",
      "benefits": { ... }
    },
    "status": "active",
    "startedAt": "2026-05-01T00:00:00.000Z",
    "expiresAt": "2026-05-31T00:00:00.000Z",
    "autoRenew": false,
    "freeRidesUsed": 2
  }
}
```

**Response (koi subscription nahi):**
```json
{
  "success": true,
  "hasActiveSubscription": false,
  "data": null
}
```

---

## Step 3 — Purchase

### Case A: Wallet se purchase

Ek hi API call, seedha active ho jaata hai.

```
POST /subscriptions/purchase
Authorization: Bearer <token>
Content-Type: application/json

{
  "plan_id": 1,
  "payment_method": "wallet"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Successfully subscribed to Monthly Pass!",
  "data": {
    "subscription": {
      "subscriptionId": 12,
      "userId": 5,
      "plan": {
        "planId": 1,
        "name": "Monthly Pass",
        "benefits": {
          "rideDiscountPercent": 15.0,
          "freeRidesPerMonth": 5,
          "priorityBooking": true,
          "cancellationWaiver": true,
          "surgeProtection": false
        }
      },
      "status": "active",
      "startedAt": "2026-05-15T10:00:00.000Z",
      "expiresAt": "2026-06-14T10:00:00.000Z",
      "autoRenew": false,
      "freeRidesUsed": 0
    },
    "payment": {
      "paymentId": 8,
      "amount": 299.00,
      "paymentMethod": "wallet",
      "status": "success",
      "createdAt": "2026-05-15T10:00:00.000Z"
    }
  }
}
```

**Error — insufficient balance:**
```json
{
  "success": false,
  "message": "Insufficient wallet balance. Required: ₹299, Available: ₹150.00"
}
```

---

### Case B: UPI / Card se purchase

**2 steps hain — pehle order banao, phir verify karo.**

#### Step B1 — Order create karo

```
POST /subscriptions/purchase
Authorization: Bearer <token>
Content-Type: application/json

{
  "plan_id": 1,
  "payment_method": "upi"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Complete payment to activate subscription",
  "requiresPayment": true,
  "data": {
    "razorpayOrderId": "order_ABC123xyz",
    "amount": 29900,
    "currency": "INR",
    "plan": {
      "planId": 1,
      "name": "Monthly Pass",
      "price": 299.00,
      "durationDays": 30
    }
  }
}
```

> ⚠️ `amount` Razorpay format me hai (paise me) — ₹299 = 29900

#### Step B2 — Razorpay Checkout karo (Frontend SDK)

```javascript
const options = {
  key: "rzp_live_XXXXXXXX",           // Razorpay Key ID
  order_id: "order_ABC123xyz",         // Step B1 se mila
  amount: 29900,                        // Step B1 se mila
  currency: "INR",
  name: "GoMobility",
  description: "Monthly Pass",
  handler: function(response) {
    // Payment successful — ab /verify call karo
    verifySubscription({
      plan_id: 1,
      payment_method: "upi",
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
    });
  },
  modal: {
    ondismiss: function() {
      // User ne payment cancel ki — subscription nahi banega
    }
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

#### Step B3 — Verify karo (subscription activate hogi)

```
POST /subscriptions/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "plan_id": 1,
  "payment_method": "upi",
  "razorpay_order_id": "order_ABC123xyz",
  "razorpay_payment_id": "pay_XYZ789abc",
  "razorpay_signature": "signature_hash_from_razorpay",
  "auto_renew": false
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Successfully subscribed to Monthly Pass!",
  "data": {
    "subscription": {
      "subscriptionId": 12,
      "plan": { ... },
      "status": "active",
      "startedAt": "2026-05-15T10:00:00.000Z",
      "expiresAt": "2026-06-14T10:00:00.000Z"
    },
    "payment": {
      "paymentId": 9,
      "amount": 299.00,
      "paymentMethod": "upi",
      "paymentGateway": "razorpay",
      "gatewayTransactionId": "pay_XYZ789abc",
      "status": "success"
    }
  }
}
```

**Error — signature invalid:**
```json
{
  "success": false,
  "message": "Payment verification failed"
}
```

---

## Step 4 — Cancel karo (optional)

```
POST /subscriptions/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "subscription_id": 12,
  "reason": "No longer needed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled. Benefits valid till expiry date.",
  "data": {
    "subscriptionId": 12,
    "status": "cancelled",
    "cancelledAt": "2026-05-15T12:00:00.000Z",
    "expiresAt": "2026-06-14T10:00:00.000Z"
  }
}
```

> ℹ️ Cancel ke baad bhi benefits `expiresAt` tak milte rahenge.

---

## Step 5 — Auto-Renew toggle karo

```
PATCH /subscriptions/auto-renew
Authorization: Bearer <token>
Content-Type: application/json

{
  "subscription_id": 12,
  "auto_renew": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Auto-renew enabled successfully",
  "data": {
    "subscriptionId": 12,
    "autoRenew": true
  }
}
```

---

## Step 6 — History dekho

```
GET /subscriptions/history?limit=10&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subscriptions": [ { ... }, { ... } ],
    "pagination": {
      "total": 3,
      "limit": 10,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

---

## Step 7 — Subscription ke payments dekho

```
GET /subscriptions/:subscriptionId/payments
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "paymentId": 9,
      "amount": 299.00,
      "paymentMethod": "upi",
      "paymentGateway": "razorpay",
      "gatewayTransactionId": "pay_XYZ789abc",
      "status": "success",
      "createdAt": "2026-05-15T10:00:00.000Z"
    }
  ]
}
```

---

## Common Errors

| HTTP Code | Message | Matlab |
|-----------|---------|--------|
| 400 | Already have an active subscription | User ke paas pehle se subscription hai |
| 400 | Insufficient wallet balance | Wallet me paise kam hain |
| 400 | Payment verification failed | Razorpay signature match nahi hua |
| 404 | Subscription plan not found | Plan ID galat hai |
| 401 | No token provided | Authorization header missing |

---

## Complete Flow Diagram

```
User plans dekhe
      ↓
GET /subscriptions/plans
      ↓
Plan select karo
      ↓
      ├── Wallet? ──→ POST /purchase (wallet) ──→ Active ✅
      │
      └── UPI/Card? ─→ POST /purchase (upi/card)
                              ↓
                       razorpayOrderId milega
                              ↓
                       Razorpay SDK se payment
                              ↓
                       POST /subscriptions/verify
                              ↓
                           Active ✅
```

---

**Last Updated:** 2026-05-15
