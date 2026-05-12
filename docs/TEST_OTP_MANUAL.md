# OTP Testing Guide - अपने Mobile पर OTP कैसे पाएं

## 🚀 5 मिनट में Test करो

### **Step 1: अपना MSG91 Account Setup करो**

1. **Website खोलो**: https://msg91.com
2. **Sign up करो** (या login करो अगर पहले से account है)
3. **API Key लो**:
   - Dashboard में जाओ → Settings → API Keys
   - अपनी **Auth Key** copy करो (यह important है!)
   
4. **Sender ID बनाओ**:
   - Settings → Sender IDs
   - या अगर default है तो ठीक है

---

### **Step 2: अपने `.env` File में लिखो**

`.env` file खोलो और यह lines ढूंढो:

```bash
SMS_PROVIDER=console
MSG91_AUTH_KEY=
MSG91_SENDER_ID=
```

इन्हें यूँ बदल दो:

```bash
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=यहाँ_तुम्हारी_AUTH_KEY_पेस्ट_करो
MSG91_SENDER_ID=GoMob
```

**Example:**
```bash
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=abc123xyz789def
MSG91_SENDER_ID=GoMob
```

👉 **File सेव करो!**

---

### **Step 3: Server को Restart करो**

Terminal में:

```bash
# अगर server चल रहा है तो Ctrl+C दबाओ
# फिर फिर से start करो
npm start
```

या सीधे:

```bash
# Terminal से
npm start
```

**Check करो कि server चल रहा है:**
```
Server is running on port 5000
```

---

### **Step 4: Postman में Test करो**

#### **तरीका 1: Postman से**

1. **Postman खोलो** (या Browser Developer Tools का इस्तेमाल कर)

2. **Signup Request भेजो:**

   ```
   Method: POST
   URL: http://localhost:5000/api/v1/auth/signup
   
   Body (JSON):
   {
     "phone": "9876543210",
     "email": "test@gmail.com",
     "fullName": "मेरा नाम",
     "role": "passenger"
   }
   ```

   👉 **9876543210 की जगह अपना actual phone number डालो!**

3. **Send करो** और Response देखो

---

### **Step 5: अपने Mobile पर OTP देखो**

**अब तुम्हारे फोन पर SMS आना चाहिए:**

```
Your OTP for GoMobility is: 1234. Valid for 5 minutes. Do not share.
```

**अगर 30 सेकंड में नहीं आया:**

### **तुरंत ठीक करो:**

```bash
# 1. Terminal में यह कमांड चलाओ (logs देखने के लिए)
tail -f logs/app.log | grep -E "✅|❌|MSG91"
```

अब फिर से Postman से request भेजो और logs देखो:

**अगर यह दिखे तो सब ठीक है:**
```
✅ OTP sent successfully via MSG91
```

**अगर यह दिखे तो problem है:**
```
❌ MSG91 SMS failed
MSG91 API error: 401
```

---

## 🔴 अगर OTP नहीं आया तो यह करो

### **Problem 1: लॉग में ❌ दिख रहा है**

```bash
# Full error देखने के लिए:
tail -50 logs/app.log | grep "MSG91\|OTP"
```

**अगर `401 - Authentication failed` दिख रहा है:**
- ✅ MSG91_AUTH_KEY सही है? (copy-paste करते समय कोई space न हो)
- ✅ `.env` फ़ाइल सेव की है?
- ✅ Server restart किया है?

### **Problem 2: "Invalid phone number format"**

तुम्हारा phone number सही format में नहीं है:

❌ गलत:
```
+919876543210
0 9876543210
919876543210
```

✅ सही:
```
9876543210     ← बस 10 digit, कोई +91 नहीं, कोई 0 नहीं
```

### **Problem 3: लॉग में कुछ भी नहीं दिख रहा**

```bash
# Check करो कि SMS_PROVIDER सही है:
grep "Initializing" logs/app.log | tail -5

# Output होना चाहिए:
# 🔌 Initializing MSG91 SMS Provider
```

अगर यह नहीं दिखा तो:
- ✅ `.env` में `SMS_PROVIDER=msg91` है?
- ✅ Server restart किया है?

---

## ✅ Full Test Flow (Complete करने के लिए)

### **1️⃣ Postman से Signup करो**

```
POST http://localhost:5000/api/v1/auth/signup
{
  "phone": "9876543210",
  "email": "test@gmail.com", 
  "fullName": "Test User",
  "role": "passenger"
}
```

**Response:**
```json
{
  "message": "OTP sent successfully",
  "expiryInMinutes": 5,
  "provider": "msg91"
}
```

### **2️⃣ अपने फोन पर OTP wait करो**

```
Your OTP for GoMobility is: 1234. Valid for 5 minutes. Do not share.
```

### **3️⃣ OTP को Database में verify करो**

```bash
# Terminal में:
sqlite3 या psql खोलो

# फिर:
SELECT * FROM otps WHERE phone_number = '+919876543210' ORDER BY created_at DESC LIMIT 1;
```

अगर row दिखा तो ✅ OTP DB में save हुआ है।

### **4️⃣ OTP को Verify करो**

Postman में:

```
POST http://localhost:5000/api/v1/auth/verify-signup
{
  "phone": "9876543210",
  "otp": "1234",
  "email": "test@gmail.com",
  "fullName": "Test User",
  "role": "passenger"
}
```

**Response:**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": 1,
    "phone": "9876543210",
    "fullName": "Test User"
  }
}
```

---

## 🎯 Console Mode में Practice करो (पहले)

अगर MSG91 credentials नहीं हैं या test करना है:

### `.env` में लिखो:
```bash
SMS_PROVIDER=console
```

फिर OTP **logs में दिखेगा**, तुम्हारे phone पर नहीं:

```
logs/app.log में देखो:
🔔 [CONSOLE MODE] SMS to 6543:
{
  "purpose": "otp_signup",
  "message": "Your OTP for GoMobility is: 1234..."
}
```

यह practice के लिए बढ़िया है!

---

## 📱 Production में OTP Test करने के लिए

### सबसे पहले **अपना ही phone use करो:**

1. अपना phone number डालो
2. OTP आएगा
3. फिर दूसरों के साथ test करो

### Debug करने के लिए:

```bash
# Real-time logs देखो
tail -f logs/app.log | grep -E "OTP|SMS|MSG91"

# अपने phone number के last 4 digits से search करो:
tail -f logs/app.log | grep "3210"    # example
```

---

## 🆘 Still नहीं आया? Check करो:

```bash
# 1. Server running है?
ps aux | grep node

# 2. logs/app.log exist है?
ls -la logs/app.log

# 3. MSG91_AUTH_KEY set है?
grep "MSG91_AUTH_KEY" .env

# 4. Last 10 SMS attempts:
tail -100 logs/app.log | grep "SMS sending\|OTP"

# 5. All errors:
tail -100 logs/app.log | grep "❌\|ERROR"
```

---

## 📞 अगर MSG91 से भी नहीं आया:

1. **MSG91 Dashboard खोलो**: https://msg91.com/dashboard
2. **Messages → Search**: अपना phone number search करो
3. क्या message show हो रहा है? 
   - ✅ अगर हाँ → server काम कर रहा है, MSG91 का issue है
   - ❌ अगर नहीं → server से message ही नहीं जा रहा

---

## ⚡ Quick Checklist

- [ ] MSG91 account बनाया है?
- [ ] Auth Key copy किया है?
- [ ] `.env` में put किया है?
- [ ] Server restart किया है?
- [ ] Phone number format सही है? (10 digit, कोई +91 नहीं)
- [ ] Postman में request भेजा है?
- [ ] Logs में देखा है?
- [ ] Mobile पर SMS आया है?

---

## 🎓 समझो कि क्या हो रहा है:

```
तुम्हारा Request
       ↓
Server → OTP Generate करो (1234)
       ↓
DB में save करो
       ↓
MSG91 API को call करो
       ↓
MSG91 तुम्हारे phone पर SMS भेजता है
       ↓
तुम्हें OTP मिलता है
       ↓
तुम Server को OTP वापस भेजते हो
       ↓
Server verify करता है
       ↓
✅ Signup complete!
```

---

## 💡 Pro Tips

1. **First time हमेशा logs देखो:**
   ```bash
   tail -f logs/app.log
   ```

2. **अपने phone number से ही test करो पहले**

3. **30 seconds से ज्यादा wait न करो**, अगर नहीं आया तो logs check करो

4. **Console mode में practice करना ज्यादा फास्ट है**

5. **MSG91 Dashboard में Message ID देख सकते हो** - failed messages detect करने के लिए

---

**Ready हो? शुरू करो! 🚀**

कोई issue हो तो logs paste करो मुझे!
