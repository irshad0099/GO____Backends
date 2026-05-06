# GO Mobility — Payment API Integration Document
**For Frontend Teams (Passenger App + Driver App)**  
Base URL: `https://api.gomobility.co.in/api/v1`  
All requests require: `Authorization: Bearer <accessToken>`

---

## TABLE OF CONTENTS
1. [Payment Methods Overview](#1-payment-methods-overview)
2. [Passenger — Wallet APIs](#2-passenger--wallet-apis)
3. [Passenger — Payment Flow (Ride)](#3-passenger--payment-flow-ride)
4. [Passenger — Subscription APIs](#4-passenger--subscription-apis)
5. [Driver — Earnings & Wallet](#5-driver--earnings--wallet)
6. [Driver — Cash Collection (Ride)](#6-driver--cash-collection-ride)
7. [Common — Payment History & Orders](#7-common--payment-history--orders)
8. [Common — Saved Payment Methods](#8-common--saved-payment-methods)
9. [End-to-End Flow Diagrams](#9-end-to-end-flow-diagrams)
10. [Error Codes](#10-error-codes)

---

## 1. Payment Methods Overview

| Method | Who Pays | Flow |
|--------|----------|------|
| `wallet` | Passenger (from GO Wallet) | Auto-deducted on ride completion |
| `cash` | Passenger → Driver (cash in hand) | Driver confirms on app |
| `personal_upi` | Passenger → Driver UPI | Driver confirms on app |
| `upi` | Passenger → Gateway (Razorpay) | Passenger pays via UPI/QR |
| `card` | Passenger → Gateway (Razorpay) | Passenger pays via saved card |

**Commission Split:**
- Platform: **20%** of final fare
- Driver: **80%** of final fare (net earnings)

---

## 2. PASSENGER — Wallet APIs

### 2.1 Get Wallet Details
```
GET /wallet
```
**Response:**
```json
{
  "success": true,
  "data": {
    "walletId": 12,
    "userId": 45,
    "balance": 250.50,
    "totalCredited": 1000.00,
    "totalDebited": 749.50,
    "lastTransactionAt": "2026-05-06T10:30:00Z",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-05-06T10:30:00Z"
  }
}
```

---

### 2.2 Get Balance Only (Lightweight)
```
GET /wallet/balance
```
**Use karo:** Ride book karne se pehle balance check karo.

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 250.50
  }
}
```

---

### 2.3 Recharge Wallet (Add Money)

**Step 1 — Create Payment Order:**
```
POST /payments/orders
```
**Request Body:**
```json
{
  "purpose": "wallet_recharge",
  "amount": 500,
  "payment_method": "upi",
  "payment_gateway": "razorpay"
}
```

**Response (UPI/Card — Gateway required):**
```json
{
  "success": true,
  "message": "Payment order created",
  "data": {
    "order": {
      "orderId": 1,
      "orderNumber": "PAY20260506ABC123",
      "amount": 500,
      "currency": "INR",
      "purpose": "wallet_recharge",
      "purposeLabel": "Wallet Recharge",
      "paymentMethod": "upi",
      "gatewayOrderId": "order_Razorpay123",
      "status": "pending",
      "createdAt": "2026-05-06T10:00:00Z"
    },
    "requiresGateway": true,
    "gatewayOrderId": "order_Razorpay123"
  }
}
```

**Step 2 — Open Razorpay SDK with `gatewayOrderId`**

**Step 3 — Verify Payment (after SDK success callback):**
```
POST /payments/verify
```
**Request Body:**
```json
{
  "razorpay_order_id": "order_Razorpay123",
  "razorpay_payment_id": "pay_XYZ789",
  "razorpay_signature": "signature_hash_from_razorpay"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Payment successful",
  "data": {
    "order": {
      "orderId": 1,
      "orderNumber": "PAY20260506ABC123",
      "amount": 500,
      "status": "success",
      "paidAt": "2026-05-06T10:05:00Z"
    }
  }
}
```
> Wallet automatically credit ho jaata hai verify ke baad.

---

### 2.4 Transaction History
```
GET /wallet/transactions?limit=20&offset=0&type=credit&category=wallet_recharge
```
**Query Params:**

| Param | Type | Options |
|-------|------|---------|
| `limit` | number | default 20 |
| `offset` | number | default 0 |
| `type` | string | `credit`, `debit` |
| `category` | string | `wallet_recharge`, `ride_payment`, `refund`, `referral_bonus`, `withdrawal` |

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transactionNumber": "TXN20260506XYZ",
        "amount": 500.00,
        "type": "credit",
        "category": "wallet_recharge",
        "paymentMethod": "upi",
        "paymentGateway": "razorpay",
        "gatewayTransactionId": "pay_XYZ789",
        "status": "success",
        "description": "Wallet recharged via UPI",
        "rideId": null,
        "createdAt": "2026-05-06T10:05:00Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 45
    }
  }
}
```

---

## 3. PASSENGER — Payment Flow (Ride)

### 3.1 Wallet Payment (Auto — Ride Complete pe)
> Alag se koi API call nahi karni — ride complete hote hi backend automatically wallet se deduct kar leta hai.

**Ride Request karte waqt:**
```json
{
  "pickup_latitude": 28.6139,
  "pickup_longitude": 77.2090,
  "dropoff_latitude": 28.5355,
  "dropoff_longitude": 77.3910,
  "vehicle_type": "auto",
  "payment_method": "wallet"
}
```

**Flow:**
```
Ride complete → Backend payForRide() call karta hai → 
Wallet se exact fare deduct → payment_status = 'paid' → 
Socket event 'ride:status_update' milega
```

**Agar balance kam hai:** Ride request fail ho jaayegi:
```json
{
  "success": false,
  "message": "Insufficient wallet balance. Required: ₹150.00, Available: ₹80.00"
}
```

---

### 3.2 Cash Payment Flow
```json
{ "payment_method": "cash" }
```
**Flow:**
```
Ride complete → Driver cash leta hai → 
Driver app pe confirm karta hai → 
Passenger ko socket notification milti hai
```
> Passenger side pe koi extra API call nahi.

---

### 3.3 UPI / Card Payment (Razorpay)
```json
{ "payment_method": "upi" }
```

**Ride complete hone ke baad:**

**Step 1:**
```
POST /payments/orders
```
```json
{
  "purpose": "ride_payment",
  "amount": 150.00,
  "payment_method": "upi",
  "payment_gateway": "razorpay",
  "ride_id": 789
}
```

**Step 2:** Razorpay SDK open karo `gatewayOrderId` se

**Step 3:**
```
POST /payments/verify
```
```json
{
  "razorpay_order_id": "order_XYZ",
  "razorpay_payment_id": "pay_ABC",
  "razorpay_signature": "hash"
}
```

---

### 3.4 Refund (Admin Initiated)
> Passenger directly refund initiate nahi kar sakta — admin/system se hota hai.

**Passenger ko wallet mein paisa wapas milega automatically.**

---

## 4. PASSENGER — Subscription APIs

### 4.1 Available Plans Dekho (No Login Required)
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
      "name": "GO Basic",
      "slug": "go-basic",
      "description": "Perfect for occasional riders",
      "price": 199.00,
      "durationDays": 30,
      "benefits": {
        "rideDiscountPercent": 10.0,
        "freeRidesPerMonth": 2,
        "priorityBooking": false,
        "cancellationWaiver": false,
        "surgeProtection": false
      },
      "isActive": true
    },
    {
      "planId": 2,
      "name": "GO Premium",
      "slug": "go-premium",
      "price": 499.00,
      "durationDays": 30,
      "benefits": {
        "rideDiscountPercent": 20.0,
        "freeRidesPerMonth": 5,
        "priorityBooking": true,
        "cancellationWaiver": true,
        "surgeProtection": true
      },
      "isActive": true
    }
  ]
}
```

---

### 4.2 Active Subscription Check
```
GET /subscriptions/active
```
**Response (Active):**
```json
{
  "success": true,
  "data": {
    "subscriptionId": 15,
    "userId": 45,
    "plan": {
      "planId": 2,
      "name": "GO Premium",
      "slug": "go-premium",
      "price": 499.00,
      "benefits": {
        "rideDiscountPercent": 20.0,
        "freeRidesPerMonth": 5,
        "priorityBooking": true,
        "cancellationWaiver": true,
        "surgeProtection": true
      }
    },
    "status": "active",
    "startedAt": "2026-05-01T00:00:00Z",
    "expiresAt": "2026-05-31T23:59:59Z",
    "autoRenew": true,
    "freeRidesLeft": 3
  }
}
```

**Response (No Subscription):**
```json
{
  "success": true,
  "data": null
}
```

---

### 4.3 Subscription Purchase
```
POST /subscriptions/purchase
```
**Request Body:**
```json
{
  "plan_id": 2,
  "payment_method": "wallet",
  "coupon_code": "FIRST50"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Subscription activated successfully",
  "data": {
    "subscriptionId": 15,
    "plan": {
      "name": "GO Premium",
      "price": 499.00
    },
    "status": "active",
    "startedAt": "2026-05-06T10:00:00Z",
    "expiresAt": "2026-06-05T10:00:00Z",
    "autoRenew": false,
    "amountCharged": 449.10
  }
}
```

---

### 4.4 Cancel Subscription
```
POST /subscriptions/cancel
```
**Request Body:**
```json
{
  "reason": "Not using enough"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled. Active until 2026-05-31.",
  "data": {
    "subscriptionId": 15,
    "status": "cancelled",
    "cancelledAt": "2026-05-06T10:00:00Z",
    "activeUntil": "2026-05-31T23:59:59Z"
  }
}
```

---

### 4.5 Auto-Renew Toggle
```
PATCH /subscriptions/auto-renew
```
**Request Body:**
```json
{ "auto_renew": true }
```
**Response:**
```json
{
  "success": true,
  "message": "Auto-renew enabled successfully"
}
```

---

### 4.6 Subscription Discount — Ride pe kaise apply hota hai
> Frontend ko kuch nahi karna — backend automatically apply karta hai ride request pe.

**Ride Request Response mein discount dikhi:**
```json
{
  "estimatedFare": 120.00,
  "subscriptionDiscount": 24.00,
  "couponDiscount": 0,
  "finalFare": 96.00,
  "isFreeRide": false
}
```

**Free Ride case:**
```json
{
  "estimatedFare": 120.00,
  "subscriptionDiscount": 120.00,
  "finalFare": 0,
  "isFreeRide": true
}
```

---

## 5. DRIVER — Earnings & Wallet

### 5.1 Driver Wallet Balance
```
GET /wallet/balance
```
> Same endpoint as passenger — works with driver JWT token.

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 1840.00
  }
}
```

---

### 5.2 Driver Earnings Summary
```
GET /drivers/earnings
```
**Response:**
```json
{
  "success": true,
  "data": {
    "today": {
      "totalEarnings": 450.00,
      "totalRides": 5,
      "cashEarnings": 200.00,
      "onlineEarnings": 250.00
    },
    "thisWeek": {
      "totalEarnings": 2100.00,
      "totalRides": 23
    },
    "thisMonth": {
      "totalEarnings": 8500.00,
      "totalRides": 91
    },
    "cashBalance": 360.00
  }
}
```

> **`cashBalance`** = Platform share jo driver ne cash rides mein collect kiya aur company ko dena hai.

---

### 5.3 Driver Transaction History
```
GET /wallet/transactions?limit=20&offset=0
```
> Same as passenger — shows driver earnings credited to wallet.

---

## 6. DRIVER — Cash Collection (Ride)

### 6.1 Cash/UPI Confirm karo
Jab driver ko passenger se cash ya personal UPI se paisa mile:
```
POST /rides/:rideId/collect-confirm
```
**Request Body:**
```json
{
  "method": "cash"
}
```
or
```json
{
  "method": "personal_upi"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cash collection confirmed",
  "data": {
    "rideId": 789,
    "method": "cash",
    "finalFare": 150.00,
    "netEarnings": 120.00,
    "platformFee": 30.00,
    "paymentStatus": "collected_by_driver",
    "confirmedAt": "2026-05-06T11:30:00Z"
  }
}
```

**After confirmation — Socket events:**
- Passenger ko milega: `ride:payment_settled`
- Driver ko milega: `driver:earnings_credited`

```json
// ride:payment_settled (passenger receives)
{
  "rideId": 789,
  "amount": 150.00,
  "method": "cash",
  "platformFee": 30.00,
  "message": "Driver confirmed cash payment received"
}

// driver:earnings_credited (driver receives)
{
  "rideId": 789,
  "netEarnings": 120.00,
  "method": "cash",
  "walletUpdated": true
}
```

---

## 7. COMMON — Payment History & Orders

### 7.1 Payment History
```
GET /payments/history?limit=20&offset=0&status=success&purpose=ride_payment
```
**Query Params:**

| Param | Options |
|-------|---------|
| `status` | `pending`, `success`, `failed` |
| `purpose` | `ride_payment`, `wallet_recharge`, `subscription` |

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "orderId": 1,
        "orderNumber": "PAY20260506ABC",
        "amount": 150.00,
        "currency": "INR",
        "purpose": "ride_payment",
        "purposeLabel": "Ride Payment",
        "paymentMethod": "upi",
        "status": "success",
        "rideId": 789,
        "paidAt": "2026-05-06T11:00:00Z",
        "createdAt": "2026-05-06T10:55:00Z"
      }
    ],
    "pagination": {
      "total": 12,
      "limit": 20,
      "offset": 0
    }
  }
}
```

---

### 7.2 Single Order Detail
```
GET /payments/orders/:orderNumber
```
**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "orderId": 1,
      "orderNumber": "PAY20260506ABC",
      "amount": 150.00,
      "status": "success",
      "paymentMethod": "upi",
      "gatewayPaymentId": "pay_XYZ789",
      "rideId": 789,
      "paidAt": "2026-05-06T11:00:00Z"
    },
    "refunds": []
  }
}
```

---

## 8. COMMON — Saved Payment Methods

### 8.1 Get Saved Methods
```
GET /payments/methods
```
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "methodId": 3,
      "type": "upi",
      "upiId": "user@paytm",
      "isDefault": true,
      "createdAt": "2026-03-01T00:00:00Z"
    },
    {
      "methodId": 4,
      "type": "card",
      "cardLast4": "4242",
      "cardBrand": "Visa",
      "cardExpMonth": 12,
      "cardExpYear": 2027,
      "isDefault": false,
      "createdAt": "2026-04-01T00:00:00Z"
    }
  ]
}
```

---

### 8.2 Save New Method
```
POST /payments/methods
```
**Request Body:**
```json
{
  "type": "upi",
  "upi_id": "user@paytm",
  "payment_gateway": "razorpay"
}
```

---

### 8.3 Remove Method
```
DELETE /payments/methods/:methodId
```

### 8.4 Set Default
```
PATCH /payments/methods/:methodId/default
```

---

## 9. End-to-End Flow Diagrams

### Flow A — Wallet Payment Ride
```
[Passenger] Book ride (payment_method: "wallet")
    ↓
Backend checks wallet balance >= fare
    ↓ (fail) → 400 Insufficient balance
    ↓ (pass)
Ride created → Driver assigned → Ride completes
    ↓
Backend: payForRide() — wallet auto debit
    ↓
payment_status = "paid"
    ↓
Socket: ride:status_update { status: "completed", finalFare: 150 }
```

---

### Flow B — Cash Payment Ride
```
[Passenger] Book ride (payment_method: "cash")
    ↓
Ride completes → payment_status = "pending"
    ↓
[Driver] Passenger se cash leta hai
    ↓
[Driver] POST /rides/:rideId/collect-confirm { method: "cash" }
    ↓
Backend:
  - Driver wallet +120 (netEarnings)
  - Driver cash_balance +30 (platform share)
  - payment_status = "collected_by_driver"
    ↓
Socket → Passenger: ride:payment_settled
Socket → Driver: driver:earnings_credited
```

---

### Flow C — UPI/Card Payment Ride
```
[Passenger] Ride completes
    ↓
[Passenger] POST /payments/orders { purpose: "ride_payment", payment_method: "upi" }
    ↓
Backend creates order → returns gatewayOrderId
    ↓
[Passenger] Razorpay SDK open karo
    ↓
[Passenger] Pay via UPI
    ↓
[Passenger] POST /payments/verify { razorpay_order_id, payment_id, signature }
    ↓
Backend:
  - Signature verify
  - payment_status = "paid"
  - Driver wallet +netEarnings (80%)
  - Platform gets 20%
```

---

### Flow D — Wallet Recharge
```
[Passenger] POST /payments/orders { purpose: "wallet_recharge", amount: 500 }
    ↓
Backend returns gatewayOrderId
    ↓
[Passenger] Razorpay SDK → Pay ₹500
    ↓
[Passenger] POST /payments/verify
    ↓
Backend: Wallet balance +500
    ↓
GET /wallet/balance → shows updated balance
```

---

### Flow E — Subscription + Ride
```
[Passenger] GET /subscriptions/plans → choose plan
    ↓
[Passenger] POST /subscriptions/purchase { plan_id: 2, payment_method: "wallet" }
    ↓
Wallet deducted ₹499 → Subscription active 30 days
    ↓
[Passenger] Book ride
    ↓
Backend auto-applies discount (20% off OR free ride if free_rides_left > 0)
    ↓
Ride Request Response:
  estimatedFare: 150
  subscriptionDiscount: 30
  finalFare: 120
```

---

## 10. Error Codes

| HTTP Code | Message | Cause |
|-----------|---------|-------|
| 400 | Insufficient wallet balance | Wallet mein paisa kam hai |
| 400 | Ride must be completed first | Ride complete nahi hui |
| 400 | Payment already confirmed | Double payment attempt |
| 400 | Cash rides cannot be paid online | Method mismatch |
| 401 | Authentication required | Token missing/expired |
| 403 | Unauthorized | Wrong role (driver vs passenger) |
| 404 | Ride not found | Wrong rideId |
| 429 | Too many requests | Rate limit hit |
| 500 | Payment gateway error | Razorpay down |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /payments/orders | 5 per 15 min |
| POST /payments/verify | 5 per 15 min |
| POST /wallet/recharge | 3 per hour |
| POST /wallet/withdraw | 2 per hour |
| GET /wallet/transactions | 30 per min |

---

*Document Version: 1.0 | Last Updated: May 2026 | GO Mobility Backend Team*
