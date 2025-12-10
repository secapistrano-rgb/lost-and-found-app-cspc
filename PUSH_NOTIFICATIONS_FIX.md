# 🔧 Push Notification Setup - Fixed!

## ✅ What Was Fixed

### Issue
```
Error registering push token with backend: [SyntaxError: JSON Parse error: Unexpected character: <]
```

### Root Cause
The API URL was incorrectly constructed:
- **Before**: `${API_BASE_URL}/../users/${email}/push-token`
- **After**: `${API_CONFIG.BASE_URL}/api/users/${email}/push-token`

The `../` was causing the request to go to the wrong endpoint, returning HTML error page instead of JSON.

### Files Fixed
- ✅ `src/shared/services/notificationService.js`
  - Fixed `registerPushTokenWithBackend()` function
  - Fixed `removePushTokenFromBackend()` function

---

## 🧪 Testing Results

### Backend API Tests
All endpoints are working correctly:

```bash
$ node test_push_token_api.js

✅ Push token registration successful
✅ Push token retrieval successful  
✅ Push token removal successful
✅ Token removal verified
```

---

## 🚀 Next Steps

### 1. Rebuild Your App
Since we modified the client-side code, you need to rebuild:

```bash
# Stop the current app if running (Ctrl+C in terminal)
# Then restart:
npm start
```

Or press **`r`** in the Expo terminal to reload.

### 2. Test on Your Device

1. **Login to the app** on your device
2. Watch the console logs - you should see:
   ```
   ✅ Expo push token obtained: ExponentPushToken[...]
   Registering push token for your-email@my.cspc.edu.ph...
   Push token registration URL: http://192.168.254.106:3000/api/users/...
   ✅ Push token registered successfully
   ```

3. If you see an error, check:
   - Is the backend server running? (Should be on http://192.168.254.106:3000)
   - Can your device reach the server? (Same network)
   - Check the URL in the logs

### 3. Verify in Database

Check if your push token was saved:

```sql
SELECT email, expo_push_token FROM users 
WHERE email = 'secapistrano@my.cspc.edu.ph';
```

You should see your ExponentPushToken in the `expo_push_token` column.

### 4. Test Push Notification

Once your token is registered:

1. Get your actual push token from the app console logs
2. Update `test_push_notifications.js`:
   ```javascript
   const TEST_PUSH_TOKEN = 'ExponentPushToken[YOUR_ACTUAL_TOKEN]';
   ```
3. **Close the app completely** on your device
4. Run: `node test_push_notifications.js`
5. Check your device for the notification! 📱

---

## 📱 Expected Flow

### On Login
```
User logs in 
→ App requests notification permission
→ App gets Expo push token
→ POST /api/users/{email}/push-token
→ Token saved to database
→ ✅ User will now receive push notifications
```

### On Match Found
```
Match created in database
→ Backend notification service triggered
→ Fetch user's push token from database
→ Send push notification via Expo
→ User receives notification (app closed/background)
```

### On Logout
```
User logs out
→ DELETE /api/users/{email}/push-token
→ Token removed from database
→ User won't receive notifications until next login
```

---

## 🐛 Troubleshooting

### Still Getting JSON Parse Error?

1. **Check the URL in console logs**:
   - Should be: `http://192.168.254.106:3000/api/users/YOUR_EMAIL/push-token`
   - Should NOT contain `/../` or malformed paths

2. **Test the endpoint manually**:
   ```bash
   node test_push_token_api.js
   ```
   If this works but app doesn't, it's a client-side issue.

3. **Check API_CONFIG**:
   ```javascript
   // In src/config/apiConfig.js
   BASE_URL: 'http://192.168.254.106:3000'
   ```
   Make sure this matches your backend server IP.

4. **Clear app cache and rebuild**:
   ```bash
   npm start -- --clear
   ```

### Push Notifications Not Received?

1. **Check notification permissions**:
   - iOS: Settings → Your App → Notifications
   - Android: Settings → Apps → Your App → Notifications

2. **Verify token in database**:
   - Run: `node test_push_token_api.js` (should show your token)

3. **Test with script**:
   - Update `test_push_notifications.js` with your token
   - Run: `node test_push_notifications.js`
   - **Close the app first!**

4. **Check Expo push service status**:
   - Visit: https://status.expo.dev/

---

## 📊 Monitoring

### Check Logs

**App Console** (when logging in):
```
Registering push notification token...
✅ Expo push token obtained: ExponentPushToken[...]
Registering push token for user@example.com...
Push token registration URL: http://192.168.254.106:3000/api/users/...
✅ Push token registered successfully
```

**Server Console** (when match is created):
```
✓ Push token registered for user@example.com: ExponentPushToken[...]
📱 Sending push notifications for new match: match_123
Sending push notification to user@example.com
Push notification sent: [{ status: 'ok' }]
✅ Match notifications sent for match match_123 (85% score)
```

---

## ✅ Summary

The API endpoints are working correctly! The issue was in the client-side URL construction, which has been fixed. 

**Now when you login:**
- Push token will be registered correctly
- You'll receive notifications when matches are found
- Even when the app is closed or in background! 🎉

**Test files available:**
- `test_push_token_api.js` - Test backend API endpoints
- `test_push_notifications.js` - Test actual push notifications
- `PUSH_NOTIFICATIONS_QUICK_START.md` - Quick setup guide
- `PUSH_NOTIFICATIONS_IMPLEMENTATION.md` - Full documentation
