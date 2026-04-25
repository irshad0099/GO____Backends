#!/bin/bash

# MSG91 OTP Debug Script
# Usage: ./scripts/debug-otp.sh [LAST_4_DIGITS]
# Example: ./scripts/debug-otp.sh 3210

echo "==================================="
echo "MSG91 OTP Debug Script"
echo "==================================="
echo ""

# Check if log file exists
if [ ! -f "logs/app.log" ]; then
    echo "❌ Error: logs/app.log not found!"
    exit 1
fi

SEARCH_TERM="${1:-}"

if [ -z "$SEARCH_TERM" ]; then
    echo "Usage: ./scripts/debug-otp.sh [LAST_4_DIGITS]"
    echo "Example: ./scripts/debug-otp.sh 3210"
    echo ""
    echo "Showing last 10 OTP operations (all):"
    echo "---"
    grep -E "OTP|SMS|MSG91" logs/app.log | grep -E "✅|❌|📤|📲|📡" | tail -10
else
    echo "Searching for phone ending with: $SEARCH_TERM"
    echo "---"
    echo ""

    echo "📤 OTP Sending Attempts:"
    grep "$SEARCH_TERM" logs/app.log | grep "SMS sending initiated" | tail -5
    echo ""

    echo "✅ Successful Sends:"
    grep "$SEARCH_TERM" logs/app.log | grep "✅ OTP sent successfully" | tail -5
    echo ""

    echo "❌ Failed Sends:"
    grep "$SEARCH_TERM" logs/app.log | grep "❌" | tail -5
    echo ""

    echo "📡 MSG91 API Requests:"
    grep "$SEARCH_TERM" logs/app.log | grep "📡 MSG91 API" | tail -3
    echo ""

    echo "📨 MSG91 API Responses:"
    grep "$SEARCH_TERM" logs/app.log | grep "📨 MSG91 API" | tail -3
fi

echo ""
echo "==================================="
echo "Tips:"
echo "- Check JSON logs for full details"
echo "- Visit MSG91 dashboard for message status"
echo "- Database: SELECT * FROM otps WHERE phone_number LIKE '%XXXX';"
echo "==================================="
