# Payment Flow — Complete Documentation

---

## Tables Involved

| Table | Kya store hota hai |
|-------|-------------------|
| `wallets` | Har user (passenger + driver) ka balance |
| `transactions` | Wallet ke har credit/debit ka record |
| `payment_orders` | Razorpay orders (recharge, ride payment) |
| `driver_earnings_transactions` | Driver ki har ride ki earning |
| `driver_cash_balance` | Driver ne kitna cash rakha hua hai (company ka) |
| `cash_collections` | Cash ride ka record |
| `cash_deposits` | Driver ne company ko cash deposit kiya |
| `company_earnings` | Har ride mein company ka platform fee record |
| `payout_requests` | Driver withdrawal requests |

---

## 1. WALLET RECHARGE (Passenger ya Driver — app mein paise daalna)

```
User → POST /payments/orders
         { amount: 500, purpose: "wallet_recharge", payment_method: "upi" }
         ↓
       Razorpay order create hota hai
         ↓
       Frontend Razorpay SDK se payment karta hai
         ↓
       POST /payments/verify
         { gateway_order_id, gateway_payment_id, signature }
         ↓
       Signature verify hoti hai
         ↓
       wallets.balance += 500          ← DB update
       transactions INSERT (credit, wallet_recharge, success)
       payment_orders.status = success
```

**Real paise kahan:** Razorpay account mein (company ka) ✅
**DB effect:** `wallets.balance +500`, `transactions` mein record

---

## 2. RIDE PAYMENT — WALLET (Passenger wallet se pay kare)

```
Ride complete
  ↓
rideService.updateRideStatus(completed)
  ↓
walletService.payForRide()
  wallets.balance -= 100        ← passenger debit
  transactions INSERT (debit, ride_payment)
  ↓
earningsService.creditDriverEarnings()
  wallets.balance += 85         ← driver credit
  driver_earnings_transactions INSERT
  drivers.total_earnings += 85
  company_earnings INSERT       ← platform_fee=15, status='earned'
  ↓
rides.payment_status = completed
```

**Real paise kahan:**
- ₹500 recharge ke waqt Razorpay mein aaya tha
- Ride pe ₹100 DB mein cut hua (passenger wallet -100)
- Driver ko ₹85 DB mein mila (driver wallet +85)
- Company ka ₹15 DB track mein hai — actual Razorpay account balance se driver withdrawal pe nikalta hai

**Tables affected:**
```
wallets          → passenger -100, driver +85
transactions     → 2 rows (passenger debit, driver credit)
driver_earnings_transactions → 1 row
company_earnings → 1 row (platform_fee=15, status='earned')
rides            → payment_status='completed'
```

---

## 3. RIDE PAYMENT — CASH

```
Ride complete
  ↓
Driver haath mein ₹100 physical cash leta hai
  ↓
earningsService.creditDriverEarnings(paymentMethod='cash')
  wallets.balance += 85              ← driver wallet credit (net earnings)
  driver_cash_balance.pending_amount += 15   ← company ka paisa track
  driver_cash_balance.total_cash_collected += 100
  drivers.cash_balance += 15
  company_earnings INSERT (status='held')   ← held = driver ke paas hai
  ↓
Driver → POST /rides/cash/confirm { ride_id }
  cash_collections INSERT
  rides.payment_status = 'cash_confirmed'
```

**Real paise kahan:**
- ₹100 driver ke haath mein physically
- ₹85 driver wallet mein (DB) — withdrawal pe real transfer hoga
- ₹15 company ka — driver ke haath mein hai (held)

**Tables affected:**
```
wallets                    → driver +85
driver_earnings_transactions → 1 row
driver_cash_balance        → pending_amount +15
company_earnings           → status='held'
cash_collections           → 1 row
rides                      → payment_status='cash_confirmed'
```

---

## 4. RIDE PAYMENT — UPI / QR

```
Ride complete
  ↓
Driver app → POST /payments/qr/generate { ride_id, amount }
  payment_orders INSERT
  Razorpay order create
  QR code generate
  ↓
Passenger QR scan karke pay kare
  ↓
POST /payments/qr/verify
  Signature verify
  payment_orders.status = success
  rides.payment_status = completed
  earningsService.creditDriverEarnings(paymentMethod='upi')
    wallets.balance += 85     ← driver credit
    company_earnings INSERT (status='earned')
```

**Real paise kahan:** Razorpay account mein ₹100 aaya ✅
**Tables affected:**
```
payment_orders   → status='success'
wallets          → driver +85
company_earnings → status='earned', platform_fee=15
rides            → payment_status='completed'
```

---

## 5. CASH LIMIT & DRIVER BLOCK

```
Driver har cash ride pe:
  driver_cash_balance.pending_amount badhta hai
  
Jab pending_amount >= cash_limit (default ₹2000):
  driver_cash_balance.is_limit_exceeded = TRUE

Driver online hone ki koshish kare:
  toggleAvailability() → findCashBalance() check
  is_limit_exceeded = TRUE → 403 ERROR
  "Cash limit exceed, pehle ₹X deposit karo"

Ride complete ke baad limit exceed ho:
  driverRepo.updateDriver → is_available = FALSE
  Socket: driver:blocked event
  FCM: notification bhejo
  → Driver automatically offline
```

---

## 6. CASH DEPOSIT (Driver company ko paisa deta hai)

```
Driver → UPI se company ko ₹15 transfer kare
       → POST /rides/cash/deposit ya admin verify kare
         ↓
       cash_deposits INSERT (status='pending')
         ↓
       Admin verify kare
         ↓
       cash_deposits.status = 'verified'
       driver_cash_balance.pending_amount -= amount
       driver_cash_balance.total_deposited += amount
       is_limit_exceeded = FALSE (agar limit ke neeche aa gaya)
       company_earnings.status = 'settled'
         ↓
       Driver ab online ho sakta hai
```

**Ya auto-deduct (already implemented):**
```
Driver ki koi wallet/UPI ride aaye
  → pending cash dues automatically cut ho jaate hain
  → driver ko pata bhi nahi chalta
```

---

## 7. DRIVER WITHDRAWAL (Wallet se real bank mein)

```
Driver → POST /payments/payout
           { amount: 500, payout_method: "upi", upi_id: "driver@upi" }
           ↓
         Balance check → wallets.balance >= 500
           ↓
         wallets.balance -= 500   ← turant debit
         payout_requests INSERT (status='pending')
           ↓
         Razorpay Payout API call (async)
           ↓
         SUCCESS:
           payout_requests.status = 'success'
           Driver bank/UPI mein ₹500 ← real transfer
           
         FAIL:
           payout_requests.status = 'failed'
           wallets.balance += 500   ← refund automatic
```

**Tables affected:**
```
wallets         → driver -500
payout_requests → 1 row
```

---

## 8. COMPANY EARNINGS SUMMARY

```
company_earnings table:

payment_method | status  | meaning
---------------|---------|------------------------------------------
wallet         | earned  | Paisa Razorpay mein hai ✅
upi            | earned  | Paisa Razorpay mein hai ✅
cash           | held    | Paisa driver ke haath mein hai ⏳
cash           | settled | Driver ne deposit kar diya ✅
```

**Admin check kare:**
```
GET /admin/company-earnings?from=2026-05-01&to=2026-05-31

Response:
{
  wallet → earned  → ₹675  (company ke Razorpay mein)
  upi    → earned  → ₹150  (company ke Razorpay mein)
  cash   → held    → ₹450  (drivers ke paas, pending)
  cash   → settled → ₹300  (deposit aa gaya)
}
```

---

## 9. REAL PAISE — COMPANY ACCOUNT KAB AATE HAIN

| Payment Method | Company ko kab milega |
|----------------|----------------------|
| **Wallet ride** | Passenger ne recharge kiya tab aaya — ride pe sirf DB entry |
| **UPI/QR ride** | Ride pe turant Razorpay mein ✅ |
| **Cash ride** | Driver deposit kare tab — ya auto-deduct next online ride pe |
| **Driver withdrawal** | Razorpay se driver ko jaata hai — company balance kam hota hai |

---

## 10. COMPLETE MONEY FLOW DIAGRAM

```
PASSENGER                    COMPANY                      DRIVER
    |                           |                            |
    | Recharge ₹500             |                            |
    |──── Razorpay ────────────▶| ₹500 Razorpay account     |
    | wallet.balance = 500      |                            |
    |                           |                            |
    | Book ride (wallet ₹100)   |                            |
    |──── wallet -100 ─────────▶|                            |
    |                           |──── wallet +85 ───────────▶|
    |                           | company_earnings +15       |
    |                           |                            |
    |                           | Driver withdraws ₹85       |
    |                           |◀─── Razorpay Payout ───────|
    |                           | Razorpay balance -85       |
    |                           |                            |
    |                           | Net: ₹15 company mein ✅   |
```

---

## 11. SOCKET EVENTS (Driver App)

| Event | Kab aata hai | Data |
|-------|-------------|------|
| `ride:status_changed` | Ride complete | `{ status, paymentMethod, finalFare }` |
| `driver:blocked` | Cash limit exceed | `{ reason, message, pendingAmount }` |
| `payment:received` | Wallet ride pe earning | `{ rideId, netEarnings, platformFee }` |

---

## 12. QUICK REFERENCE — KONSA API KAHAN

| Kaam | API | Role |
|------|-----|------|
| Wallet mein paise daalo | `POST /payments/orders` + `POST /payments/verify` | all |
| Balance dekho | `GET /wallet/balance` | all |
| Cash confirm karo | `POST /rides/cash/confirm` | driver |
| QR generate karo | `POST /payments/qr/generate` | driver |
| Paise nikalo (withdrawal) | `POST /payments/payout` | driver |
| Company earnings dekho | `GET /admin/company-earnings` | admin |
| Transaction history | `GET /wallet/transactions` | all |
