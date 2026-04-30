# 📅 GoMobility Subscription Integration Guide

Complete subscription system for ride passes and recurring billing via Razorpay.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Subscription Plans](#subscription-plides)
- [Purchase Flow](#purchase-flow)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Razorpay Integration](#razorpay-integration)
- [Postman Collection](#postman-collection)
- [Testing Guide](#testing-guide)
- [Webhooks](#webhooks)

---

## 🎯 Overview

GoMobility subscription system allows passengers to purchase **ride passes** with:

- **Prepaid rides** at discounted rates
- **Flexible validity** (7 days, 30 days, etc.)
- **Auto-renewal** options
- **Razorpay** integration for secure billing

### Subscription Types

| Type | Description | Best For |
|------|-------------|----------|
| **Ride Pass** | Fixed number of rides | Commuters |
| **Unlimited Pass** | Unlimited rides for period | Frequent riders |
| **Discount Pass** | Percentage discount on all rides | Occasional riders |

---

## 📦 Subscription Plans

### Plan Structure

```json
{
  "plan_id": "plan_monthly_30",
  "name": "Monthly Pass - 30 Rides",
  "description": "30 rides valid for 30 days",
  "type": "ride_pass",
  "rides_included": 30,
  "validity_days": 30,
  "price": 999.00,
  "discount_percent": 20,
  "features": [
    "30 ride credits",
    "Valid for 30 days",
    "All vehicle types",
    "No surge pricing"
  ]
}
```

### Available Plans

| Plan ID | Name | Rides | Validity | Price | Savings |
|---------|------|-------|----------|-------|---------|
| `plan_weekly_10` | Weekly Pass | 10 | 7 days | ₹399 | 15% |
| `plan_monthly_30` | Monthly Pass | 30 | 30 days | ₹999 | 20% |
| `plan_monthly_50` | Monthly Pro | 50 | 30 days | ₹1499 | 25% |
| `plan_quarterly_150` | Quarterly Pass | 150 | 90 days | ₹3999 | 30% |

---

## 🔄 Purchase Flow

### Step 1: Get Available Plans

**Request:**
```http
GET /api/v1/subscriptions/plans
Authorization: Bearer {{auth_token}}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "plan_id": "plan_monthly_30",
        "name": "Monthly Pass - 30 Rides",
        "price": 999.00,
        "rides_included": 30,
        "validity_days": 30
      }
    ]
  }
}
```

### Step 2: Purchase Subscription

**Request:**
```http
POST /api/v1/subscriptions/purchase
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "plan_id": "plan_monthly_30",
  "payment_method": "upi",
  "payment_gateway": "razorpay",
  "auto_renew": false,
  "customer_details": {
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "contact": "9876543210"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription purchase initiated",
  "data": {
    "subscription_id": "sub_1234567890",
    "plan_id": "plan_monthly_30",
    "status": "pending",
    "razorpay_subscription_id": "sub_RazorpayId123",
    "amount": 99900,
    "currency": "INR",
    "requires_payment": true
  }
}
```

### Step 3: Complete Payment

Use Razorpay checkout to complete payment:

```javascript
const options = {
  "key": "rzp_test_YourKeyHere",
  "subscription_id": "sub_RazorpayId123",
  "name": "GoMobility",
  "description": "Monthly Pass - 30 Rides",
  "handler": function(response) {
    // Payment successful
    console.log(response.razorpay_payment_id);
    console.log(response.razorpay_subscription_id);
    console.log(response.razorpay_signature);
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

### Step 4: Verify Subscription

**Request:**
```http
POST /api/v1/subscriptions/verify
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "subscription_id": "sub_1234567890",
  "razorpay_payment_id": "pay_RazorpayPaymentId",
  "razorpay_signature": "signature_hash"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription activated successfully",
  "data": {
    "subscription": {
      "id": "sub_1234567890",
      "plan_id": "plan_monthly_30",
      "status": "active",
      "rides_remaining": 30,
      "valid_until": "2026-05-26T00:00:00Z"
    }
  }
}
```

---

## 🔌 API Endpoints

### Subscription APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/subscriptions/plans` | List all plans | ✅ |
| POST | `/subscriptions/purchase` | Purchase subscription | ✅ |
| POST | `/subscriptions/verify` | Verify subscription | ✅ |
| GET | `/subscriptions/active` | Get active subscription | ✅ |
| GET | `/subscriptions/history` | Purchase history | ✅ |
| POST | `/subscriptions/cancel` | Cancel subscription | ✅ |
| POST | `/subscriptions/renew` | Manual renew | ✅ |

### Ride Credit APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/subscriptions/credits` | Check remaining rides | ✅ |
| POST | `/subscriptions/use-credit` | Use ride credit | ✅ |

---

## 🔐 Authentication

All subscription APIs require Bearer token authentication:

```http
Authorization: Bearer {{auth_token}}
```

### Get Auth Token:
1. `POST /auth/signin` - Send OTP
2. `POST /auth/verify-signin` - Verify OTP and get token

---

## 💳 Razorpay Integration

### Configuration

Set these environment variables:

```env
RAZORPAY_KEY_ID=rzp_test_YourKeyHere
RAZORPAY_KEY_SECRET=YourSecretKey
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecret
```

### Test Cards

| Card Number | Type | Result |
|-------------|------|--------|
| 5267 3181 8797 5449 | Mastercard | Success |
| 4111 1111 1111 1111 | Visa | Success |

### Webhook Events

| Event | Description |
|-------|-------------|
| `subscription.activated` | Subscription activated |
| `subscription.charged` | Recurring payment charged |
| `subscription.cancelled` | Subscription cancelled |
| `subscription.pending` | Payment pending |

---

## 📮 Postman Collection

### Included Requests

#### Subscription Folder
- ✅ **Get All Plans** - List available plans
- ✅ **Purchase Subscription** - Initiate purchase
- ✅ **Verify Subscription** - Complete purchase
- ✅ **Get Active Subscription** - Current subscription
- ✅ **Get Subscription History** - Past subscriptions
- ✅ **Cancel Subscription** - Cancel active plan
- ✅ **Check Ride Credits** - Remaining rides

### Environment Variables

```json
{
  "base_url": "http://localhost:5000/api/v1",
  "auth_token": "",
  "subscription_id": "",
  "razorpay_payment_id": "",
  "razorpay_signature": ""
}
```

---

## 🧪 Testing Guide

### Scenario 1: Purchase Monthly Pass

```
1. GET /subscriptions/plans (get plan_monthly_30)
2. POST /subscriptions/purchase (select plan)
3. Complete Razorpay checkout
4. POST /subscriptions/verify
5. GET /subscriptions/active (confirm active)
```

### Scenario 2: Use Ride Credit

```
1. GET /subscriptions/credits (check balance)
2. Book a ride - system auto-uses credit
3. GET /subscriptions/credits (verify deduction)
```

### Scenario 3: Cancel Subscription

```
1. GET /subscriptions/active (get subscription_id)
2. POST /subscriptions/cancel
3. GET /subscriptions/active (verify cancelled)
```

---

## 🐛 Troubleshooting

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `Plan not found` | Invalid plan_id | Check available plans |
| `Active subscription exists` | Already subscribed | Cancel current first |
| `Payment failed` | Razorpay error | Check card details |
| `No ride credits` | Credits exhausted | Purchase new plan |
| `Subscription expired` | Validity ended | Renew subscription |

---

## 📊 Subscription Status Codes

| Status | Description |
|--------|-------------|
| `pending` | Awaiting payment |
| `active` | Currently valid |
| `paused` | Temporarily paused |
| `cancelled` | User cancelled |
| `expired` | Validity ended |
| `completed` | All rides used |

---

## 🔗 Related Documentation

- [Payment Integration Guide](./PAYMENT_INTEGRATION_GUIDE.md)
- [OTP Integration](./OTP_Guide.md)
- [Postman Collection](../postman_collection/)

---

**Last Updated:** April 28, 2026
**Version:** 1.0.0
