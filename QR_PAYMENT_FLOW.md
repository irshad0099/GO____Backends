# QR Payment Flow - Ola/Uber Style Implementation

## Overview
The QR payment flow has been updated to match the standard Ola/Uber payment pattern where passengers book rides with QR payment method, drivers generate QR codes after ride completion, and passengers scan QR to make payments.

## Payment Flow Steps

### 1. Passenger Books Ride with QR Payment
```bash
POST /api/v1/rides/request
Authorization: Bearer PASSENGER_TOKEN
Content-Type: application/json

{
    "vehicleType": "car",
    "pickupAddress": "Mumbai, Maharashtra",
    "dropoffAddress": "Andheri, Mumbai",
    "paymentMethod": "qr"
}
```

### 2. Driver Completes the Ride
- Driver accepts ride and completes the journey
- Ride status changes to 'completed'
- Payment method is set to 'qr'

### 3. Driver Generates QR Code
After ride completion, driver generates QR for payment collection:
```bash
POST /api/v1/payments/qr/generate
Authorization: Bearer DRIVER_TOKEN
Content-Type: application/json

{
    "ride_id": 4
}
```

**Response:**
```json
{
    "success": true,
    "message": "QR code generated successfully for ride payment",
    "data": {
        "order": {
            "orderNumber": "ORD_123456789",
            "amount": 165.00,
            "expiresAt": "2026-05-11T18:00:00.000Z"
        },
        "ride": {
            "id": 4,
            "rideNumber": "RD202401010005",
            "amount": 165.00,
            "passenger": "Test Passenger"
        }
    }
}
```

### 4. Passenger Scans QR and Pays
Passenger uses the QR code to complete payment:
```bash
POST /api/v1/payments/qr/verify
Authorization: Bearer PASSENGER_TOKEN
Content-Type: application/json

{
    "order_number": "ORD_123456789",
    "gateway_payment_id": "pay_123456789",
    "gateway_signature": "generated_signature"
}
```

**Response:**
```json
{
    "success": true,
    "message": "QR payment completed successfully",
    "data": {
        "payment": {
            "status": "success",
            "amount": 165.00
        },
        "ride": {
            "id": 4,
            "rideNumber": "RD202401010005",
            "amount": 165.00,
            "paymentStatus": "paid",
            "paidAt": "2026-05-11T17:30:00.000Z"
        }
    }
}
```

### 5. Driver Gets Payment Confirmation
- Driver is notified when payment is completed
- Ride payment status updates to 'paid'
- Driver can view payment status

## API Endpoints

### QR Generation (Driver Only)
- **URL**: `POST /api/v1/payments/qr/generate`
- **Authorization**: Driver token required
- **Body**: `{ "ride_id": number }`
- **Purpose**: Generate QR code for completed ride payment

### QR Payment Verification (Passenger Only)
- **URL**: `POST /api/v1/payments/qr/verify`
- **Authorization**: Passenger token required
- **Body**: `{ "order_number": string, "gateway_payment_id": string, "gateway_signature": string }`
- **Purpose**: Passenger scans QR and completes payment

### QR Payment Status
- **URL**: `GET /api/v1/payments/qr/status/:order_number`
- **Authorization**: Any authenticated user
- **Purpose**: Check QR payment status

## Payment Methods Updated

### Supported Payment Methods
- `cash` - Cash payment collected by driver
- `card` - Card payment (existing flow)
- `wallet` - Wallet payment (existing flow)
- `qr` - QR payment (new Ola/Uber style flow)

### Removed Payment Methods
- `upi` - Removed in favor of QR flow

## Validation & Authorization

### QR Generation Requirements
- Driver must be authenticated
- Driver must be assigned to the ride
- Ride must be completed
- Ride payment method must be 'qr'
- Payment must not be already completed

### QR Payment Requirements
- Passenger must be authenticated
- Passenger must be the ride owner
- Order must be valid QR payment order
- Payment gateway validation required

## Error Handling

### Common Errors
- **400**: Ride not completed, invalid payment method, payment already completed
- **403**: Access denied (wrong user role or not assigned to ride)
- **404**: Ride not found
- **500**: Server error or payment gateway issues

### Example Error Responses
```json
{
    "success": false,
    "statuscode": 400,
    "message": "Ride must be completed before generating QR payment",
    "data": {}
}
```

## Testing Flow

### Test Data
- **Driver**: Amit Kumar (9876543212)
- **Passenger**: Test Passenger (9876543210)
- **Test Ride**: ID 4 (completed with QR payment method)

### Test Steps
1. Login as passenger and book ride with QR payment
2. Login as driver and complete the ride
3. Driver generates QR using `/payments/qr/generate`
4. Passenger verifies payment using `/payments/qr/verify`
5. Check payment status using `/payments/qr/status/:order_number`

## Security Features

- Role-based authorization (driver for QR generation, passenger for payment)
- Ride ownership validation
- Payment gateway signature verification
- QR code expiration handling
- Duplicate payment prevention

## Integration Notes

- Uses Razorpay payment gateway for QR processing
- Automatic ride payment status updates
- Driver notification system for payment completion
- Passenger payment history tracking
- Real-time payment status synchronization
