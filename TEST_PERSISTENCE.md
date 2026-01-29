# 🧪 Testing Persistence - Quick Guide

## ✅ Quick Test (5 minutes)

### Step 1: Start Fresh

```bash
cd D:/Presidium

# Delete old history (if exists)
rm backend/chat_history.json

# Start servers
npm run dev
```

**Expected:**
- Backend: `http://localhost:3000` ✅
- Frontend: `http://localhost:5173` ✅

---

### Step 2: First Chat

1. Open browser: `http://localhost:5173`
2. You should see: **"Start a conversation with Presidium Core"**
3. Send messages:
   - Type: `hello`
   - Wait 1.5s
   - See: `👋 Presidium v0.1 Online...`
   - Type: `crypto`
   - Wait 1.5s
   - See: `🔒 [SECURE ENCLAVE]...`

**Expected:**
- 4 messages visible (2 user + 2 AI)
- Timestamps displayed
- Smooth animations

---

### Step 3: Check Storage File

```bash
# View chat history file
cat backend/chat_history.json

# Or on Windows PowerShell:
Get-Content backend/chat_history.json
```

**Expected Output:**
```json
[
  {
    "id": "uuid-1",
    "text": "hello",
    "sender": "user",
    "timestamp": "2025-12-19T02:45:00.000Z"
  },
  {
    "id": "uuid-2",
    "text": "👋 Presidium v0.1 Online. Neural interface active. Waiting for command.",
    "sender": "server",
    "timestamp": "2025-12-19T02:45:01.500Z"
  },
  {
    "id": "uuid-3",
    "text": "crypto",
    "sender": "user",
    "timestamp": "2025-12-19T02:45:10.000Z"
  },
  {
    "id": "uuid-4",
    "text": "🔒 [SECURE ENCLAVE]: Processing quantum-resistant transaction. Status: PENDING.",
    "sender": "server",
    "timestamp": "2025-12-19T02:45:11.500Z"
  }
]
```

✅ **File exists and contains all messages!**

---

### Step 4: Test Persistence (Critical!)

```bash
# Stop servers
# Press Ctrl+C in terminal

# Wait 2 seconds

# Restart servers
npm run dev
```

**Expected:**
- Backend restarts successfully
- Frontend restarts successfully

---

### Step 5: Verify History Loaded

1. Refresh browser: `http://localhost:5173`
2. **Wait 1 second for history to load**

**Expected:**
- ✅ All 4 previous messages still visible!
- ✅ Timestamps preserved
- ✅ Order maintained (oldest to newest)
- ✅ No "Start a conversation..." message

**Console Log (Frontend):**
```
Loaded 4 messages from history
```

---

### Step 6: Continue Chat

1. Send new message: `audit`
2. Wait 1.5s
3. See AI response: `🔍 Scanning repo...`

**Expected:**
- Now 6 messages total (4 old + 2 new)
- New messages append to existing history
- File grows with each interaction

---

### Step 7: Multiple Browser Tabs

1. Open new tab: `http://localhost:5173`
2. Both tabs should show same history

**Expected:**
- ✅ Tab 1: 6 messages
- ✅ Tab 2: 6 messages (after load)
- ✅ Both tabs synchronized

---

## 🎯 Success Criteria

### ✅ Persistence Works If:

1. **File Created:**
   - `backend/chat_history.json` exists
   - Contains valid JSON array

2. **Messages Saved:**
   - User messages saved immediately
   - AI responses saved after processing
   - File grows with each chat

3. **History Loads:**
   - Frontend fetches `/api/history` on mount
   - Previous messages display immediately
   - No data loss after restart

4. **Server Restart:**
   - Stop servers → Restart servers
   - All messages still visible
   - Can continue chatting

---

## 🐛 Troubleshooting

### Problem: History Not Loading

**Symptoms:**
- Browser shows "Start a conversation..." even after restart
- Console error: "Failed to load chat history"

**Solutions:**
1. Check backend is running: `http://localhost:3000/api/history`
2. Check file exists: `ls backend/chat_history.json`
3. Check file is valid JSON: `cat backend/chat_history.json`
4. Check browser console for errors

---

### Problem: File Not Created

**Symptoms:**
- `backend/chat_history.json` doesn't exist
- No error messages

**Solutions:**
1. Check backend started successfully
2. Send at least one message (triggers file creation)
3. Check file permissions in backend folder
4. Check backend console for errors

---

### Problem: Messages Duplicate

**Symptoms:**
- Same message appears twice
- History grows unexpectedly

**Solutions:**
1. This is expected if you send same message twice
2. Each message has unique UUID
3. Check `chat_history.json` for duplicate IDs

---

### Problem: File Corrupted

**Symptoms:**
- Backend error: "JSON parse error"
- History not loading

**Solutions:**
```bash
# Backup corrupted file
mv backend/chat_history.json backend/chat_history.json.backup

# Delete and restart
rm backend/chat_history.json
npm run dev

# File will be recreated empty
```

---

## 📊 Advanced Testing

### Test 1: Large History

```bash
# Send 50 messages
for i in {1..50}; do
  curl -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Test message $i\"}"
  sleep 2
done

# Check file size
ls -lh backend/chat_history.json

# Restart and verify all 100 messages load (50 user + 50 AI)
```

---

### Test 2: Concurrent Access

```bash
# Open 3 browser tabs
# Send messages in different tabs simultaneously
# All tabs should eventually show all messages
```

---

### Test 3: API Direct Test

```bash
# Get history
curl http://localhost:3000/api/history

# Expected: JSON with history array

# Send message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'

# Get history again (should have 2 new messages)
curl http://localhost:3000/api/history
```

---

## 📈 Performance Test

### Measure Load Time

```javascript
// In browser console
console.time('history-load');
fetch('http://localhost:3000/api/history')
  .then(r => r.json())
  .then(data => {
    console.timeEnd('history-load');
    console.log(`Loaded ${data.history.length} messages`);
  });
```

**Expected:**
- < 50ms for small history (< 100 messages)
- < 200ms for medium history (< 1000 messages)
- < 1s for large history (< 10000 messages)

---

## ✅ Final Checklist

After testing, verify:

- [x] `backend/chat_history.json` exists
- [x] File contains valid JSON array
- [x] Messages saved when sent
- [x] History loads on app start
- [x] Survives server restart
- [x] No console errors
- [x] Frontend displays all messages
- [x] Timestamps correct
- [x] Can continue chatting after restart

---

## 🎉 Success!

If all tests pass:
- ✅ Persistence is working correctly
- ✅ Chat history survives restarts
- ✅ No data loss
- ✅ Ready for production use

---

**Next Steps:**
1. Test with real usage patterns
2. Monitor file size growth
3. Consider database migration for scale
4. Add backup/restore functionality

---

**Version:** 1.0.0  
**Date:** December 19, 2025  
**Status:** ✅ Ready to Test

