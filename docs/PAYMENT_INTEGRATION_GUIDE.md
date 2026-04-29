# 💳 GoMobility Payment Integration Guide

Complete payment system supporting 5 payment methods for ride bookings and wallet recharges.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Payment Methods](#payment-methods)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Cash Payment Flow](#cash-payment-flow)
- [QR Code Payment Flow](#qr-code-payment-flow)
- [UPI Payment Flow](#upi-payment-flow)
- [Wallet Payment Flow](#wallet-payment-flow)
- [Card Payment Flow](#card-payment-flow)
- [Postman Collection](#postman-collection)
- [Testing Guide](#testing-guide)

---

## 🎯 Overview

GoMobility supports **5 payment methods** for ride bookings:

| Method | Type | Flow | Best For |
|--------|------|------|----------|
| **Cash** | Offline | Pay driver directly | Users without digital payment |
| **QR Code** | Digital | Scan UPI QR | Quick mobile payments |
| **UPI** | Digital | Razorpay UPI | Direct bank transfer |
| **Wallet** | Digital | Deduct balance | Frequent riders |
| **Card** | Digital | Razorpay card | Credit/debit cards |

---

## 💵 Payment Methods

### 1. Cash Payment

**Flow:**
1. Passenger selects "Cash" during ride booking
2. Driver collects cash after ride completion
3. Driver confirms collection in app
4. System marks ride as paid

**APIs:**
- `POST /rides/payments/create` - Initiate cash payment
- `POST /rides/cash/confirm` - Driver confirms cash collection
- `GET /rides/cash/status/:ride_id` - Check cash payment status

**Status Flow:**
```
pending → cash_collected → cash_confirmed
```

---

### 2. QR Code Payment

**Flow:**
1. Passenger selects "QR Code"
2. System generates UPI QR code
3. Passenger scans QR with any UPI app
4. Payment is verified via Razorpay

**APIs:**
- `POST /payments/qr/generate` - Generate QR code
- `POST /payments/qr/verify` - Verify QR payment
- `GET /payments/qr/status/:order_number` - Check status
- `POST /payments/qr/close` - Cancel QR payment

**QR Response:**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,...",
    "upiUrl": "upi://pay?pa=merchant@upi&pn=GoMobility&am=272.50",
    "orderNumber": "PAY20260426GIHF96",
    "amount": 27250,
    "currency": "INR",
    "expiresAt": "2026-04-26T15:30:00Z"
  }
}
```

---

### 3. UPI Payment

**Flow:**
1. Passenger selects "UPI"
2. System creates Razorpay order
3. Passenger completes UPI payment via Razorpay
4. Webhook/verification confirms payment

**APIs:**
- `POST /payments/orders` - Create UPI order
- `POST /payments/verify` - Verify UPI payment

---

### 4. Wallet Payment

**Flow:**
1. Passenger selects "Wallet"
2. System checks wallet balance
3. If sufficient, deducts amount immediately
4. Auto-confirms payment

**APIs:**
- `POST /payments/orders` - Create wallet payment
- `GET /wallet/balance` - Check balance

**Wallet Features:**
- Auto-deduction for ride payments
- Instant recharge via UPI/Card
- Transaction history
- Refund support

---

### 5. Card Payment

**Flow:**
1. Passenger selects "Card"
2. System creates Razorpay order
3. Passenger enters card details
4. Razorpay processes payment

**APIs:**
- `POST /payments/orders` - Create card payment
- `POST /payments/verify` - Verify card payment

**Test Card:**
```
Card Number: 5267 3181 8797 5449
Expiry: Any future date
CVV: Any 3 digits
OTP: 123456
```

---

## 🔌 API Endpoints

### Payment Order APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/payments/orders` | Create payment order | ✅ |
| POST | `/payments/verify` | Verify payment | ✅ |
| GET | `/payments/orders/:order_number` | Get order details | ✅ |

### QR Payment APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/payments/qr/generate` | Generate QR code | ✅ |
| POST | `/payments/qr/verify` | Verify QR payment | ✅ |
| GET | `/payments/qr/status/:order_number` | Check QR status | ✅ |
| POST | `/payments/qr/close` | Cancel QR | ✅ |

### Cash Payment APIs

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | `/rides/payments/create` | Pay with cash | ✅ | Passenger |
| POST | `/rides/cash/confirm` | Confirm collection | ✅ | Driver |
| GET | `/rides/cash/status/:ride_id` | Check status | ✅ | Both |

### Wallet APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/wallet` | Get wallet details | ✅ |
| GET | `/wallet/balance` | Get balance | ✅ |
| POST | `/wallet/recharge` | Recharge wallet | ✅ |
| GET | `/wallet/transactions` | Transaction history | ✅ |

---

## 🔐 Authentication

All payment APIs require Bearer token authentication:

```http
Authorization: Bearer {{auth_token}}
```

### Get Auth Token:
1. `POST /auth/signin` - Send OTP
2. `POST /auth/verify-signin` - Verify OTP and get token

---

## 🔄 Cash Payment Flow

### Step 1: Passenger Initiates Cash Payment

**Request:**
```http
POST /api/v1/rides/payments/create
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "ride_id": 3,
  "payment_method": "cash",
  "payment_gateway": null
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cash payment recorded. Please pay driver directly.",
  "data": {
    "ride": {
      "id": 3,
      "rideNumber": "RIDE20260426ABC123",
      "paymentStatus": "cash_collected",
      "paymentMethod": "cash",
      "finalFare": 272.50
    },
    "payment_method": "cash",
    "amount": 272.50,
    "status": "cash_collected"
  }
}
```

### Step 2: Driver Confirms Cash Collection

**Request:**
```http
POST /api/v1/rides/cash/confirm
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "ride_id": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cash payment confirmed successfully",
  "data": {
    "ride": { ... },
    "payment_method": "cash",
    "amount": 272.50,
    "status": "cash_confirmed",
    "confirmed_at": "2026-04-26T14:30:00Z"
  }
}
```

---

## 📱 QR Code Payment Flow

### Step 1: Generate QR Code

**Request:**
```http
POST /api/v1/payments/qr/generate
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "amount": 272.50,
  "purpose": "ride_payment",
  "payment_method": "qr",
  "ride_id": 3,
  "description": "QR payment for ride #3"
}
```

**Response:**
```json
{
  "success": true,
  "message": "QR code generated successfully",
  "data": {
    "order": {
      "orderId": 123,
      "orderNumber": "PAY20260426GIHF96",
      "amount": 272.50,
      "status": "pending"
    },
    "requiresGateway": true,
    "gatewayOrderId": "order_RazorpayId123",
    "amount": 27250,
    "currency": "INR",
    "qrCode": "data:image/png;base64,iVBORw0KGgo...",
    "upiUrl": "upi://pay?pa=merchant@upi&pn=GoMobility&am=272.50",
    "qrExpiresAt": "2026-04-26T15:30:00Z"
  }
}
```

### Step 2: Verify QR Payment

**Request:**
```http
POST /api/v1/payments/qr/verify
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "order_number": "PAY20260426GIHF96",
  "gateway_payment_id": "pay_RazorpayPaymentId",
  "gateway_signature": "signature_hash"
}
```

---

## 💰 Wallet Payment Flow

### Step 1: Check Balance

**Request:**
```http
GET /api/v1/wallet/balance
Authorization: Bearer {{auth_token}}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 500.00,
    "currency": "INR"
  }
}
```

### Step 2: Pay with Wallet

**Request:**
```http
POST /api/v1/rides/payments/create
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "ride_id": 3,
  "payment_method": "wallet"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment successful",
  "data": {
    "order": {
      "orderNumber": "PAY20260426ABC123",
      "amount": 272.50,
      "status": "success",
      "paymentMethod": "wallet"
    },
    "requiresGateway": false,
    "newBalance": 227.50
  }
}
```

---

## 🧪 Testing Guide

### Postman Collection Setup

1. **Import Collection:**
   ```
   Import → GoMobility_Payment_Subscription_APIs.json
   ```

2. **Set Environment Variables:**
   ```json
   {
     "base_url": "http://localhost:5000/api/v1",
     "auth_token": "",
     "ride_id": "3",
     "qr_order_number": "",
     "qr_gateway_payment_id": "",
     "qr_gateway_signature": ""
   }
   ```

3. **Login Flow:**
   - Use `/auth/signin` to get OTP
   - Use `/auth/verify-signin` to get auth_token
   - Token auto-saves to environment

### Test Scenarios

#### Scenario 1: Cash Payment
```
1. POST /rides/payments/create (payment_method: cash)
2. POST /rides/cash/confirm (as driver)
3. GET /rides/cash/status/:ride_id
```

#### Scenario 2: QR Code Payment
```
1. POST /payments/qr/generate
2. Copy order_number from response
3. Complete payment via UPI app (or test HTML page)
4. POST /payments/qr/verify
```

#### Scenario 3: Wallet Payment
```
1. GET /wallet/balance (check sufficient balance)
2. POST /rides/payments/create (payment_method: wallet)
3. Payment auto-confirms
```

---

## 🐛 Troubleshooting

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `Ride not found` | Invalid ride_id | Check ride exists with GET /rides/:rideId |
| `Ride must be completed` | Ride not finished | Complete ride first |
| `Insufficient wallet balance` | Low balance | Recharge wallet first |
| `QR generation failed` | Razorpay error | Check Razorpay credentials |
| `Signature verification failed` | Invalid signature | Verify correct signature from Razorpay |

---

## 📊 Payment Status Codes

| Status | Description |
|--------|-------------|
| `pending` | Payment not yet initiated |
| `cash_collected` | Cash marked for collection |
| `cash_confirmed` | Driver confirmed cash receipt |
| `processing` | Payment in progress |
| `success` | Payment completed |
| `failed` | Payment failed |
| `refunded` | Payment refunded |

---

## 🔗 Related Documentation

- [Subscription Guide](./SUBSCRIPTION_INTEGRATION_GUIDE.md)
- [OTP Integration](./OTP_Guide.md)
- [Postman Collection](../postman_collection/)

---

**Last Updated:** April 28, 2026
**Version:** 1.0.0
