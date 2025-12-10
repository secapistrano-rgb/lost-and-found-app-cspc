# API Key Configuration

## ✅ Gemini API Key Setup Complete

The Gemini API key is now stored securely in `app.json` instead of being hardcoded.

---

## 📁 Files Modified:

### 1. **`app.json`**
Added `geminiApiKey` to the `extra` section:
```json
"extra": {
  "eas": {
    "projectId": "bbf80429-491c-40aa-b18c-7e176cd0a85e"
  },
  "geminiApiKey": "AIzaSyCosO2umUUVmaccMBXZYmijWkBJVhy_WyU"
}
```

### 2. **`src/shared/api/GeminiAPI.js`**
Updated to read API key from configuration:
```javascript
import Constants from 'expo-constants';

const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey;

if (!GEMINI_API_KEY) {
  console.error('❌ Gemini API key is not configured!');
  console.error('Please add geminiApiKey to app.json extra section');
}
```

### 3. **`.gitignore`**
Added warning comment about API keys in `app.json`

### 4. **`app.json.example`**
Created example configuration file with placeholder values

---

## 🔒 Security Best Practices:

### ⚠️ **IMPORTANT: Your API Key is Still Exposed!**

**Current API Key:** `AIzaSyCosO2umUUVmaccMBXZYmijWkBJVhy_WyU`

**This key is:**
- ✅ Visible in your `app.json` file
- ✅ Potentially committed to Git
- ✅ Already exposed in previous commits

### 🚨 **RECOMMENDED ACTIONS:**

#### **1. Revoke the Current API Key**
1. Go to: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Find the key: `AIzaSyCosO2umUUVmaccMBXZYmijWkBJVhy_WyU`
3. Click **Delete** to revoke it

#### **2. Create a New API Key**
1. In Google AI Studio, click **"Create API key"**
2. Select your project or create a new one
3. Copy the new API key
4. Replace it in `app.json`:
   ```json
   "geminiApiKey": "YOUR_NEW_API_KEY_HERE"
   ```

#### **3. Prevent Future Exposure**

**Option A: Never Commit `app.json` with Real Keys**
```bash
# Before committing, replace with placeholder
# Or use git-crypt to encrypt sensitive files
```

**Option B: Use EAS Secrets (Recommended for Production)**
```bash
eas secret:create --scope project --name GEMINI_API_KEY --value "your_actual_key"
```

Then update `app.json`:
```json
"extra": {
  "geminiApiKey": "${GEMINI_API_KEY}"
}
```

---

## 📊 How It Works Now:

### **Development:**
```javascript
// App reads from app.json at runtime
const apiKey = Constants.expoConfig?.extra?.geminiApiKey;
// No more hardcoded API keys in source code ✅
```

### **Production (with EAS Secrets):**
```bash
# Set secret
eas secret:create --name GEMINI_API_KEY --value "prod_key_here"

# Build will inject the secret
eas build --platform android
```

---

## 🧪 Testing:

### **Verify API Key is Loading:**
1. Run the app: `npx expo start --clear`
2. Check logs for:
   - ✅ No error messages about missing API key
   - ✅ Gemini API calls working properly

### **If You See This Error:**
```
❌ Gemini API key is not configured!
Please add geminiApiKey to app.json extra section
```

**Solution:** Make sure `app.json` has:
```json
"extra": {
  "geminiApiKey": "YOUR_API_KEY_HERE"
}
```

---

## �️ Server Configuration (VPS):

The file `src/shared/api/geminiMatcher.js` is used on your **Node.js server** (VPS).

### **Set Environment Variable on VPS:**

```bash
# SSH into your VPS
ssh user@api.lostfound.systems

# Set environment variable
export GEMINI_API_KEY="your_gemini_api_key_here"

# OR add to ~/.bashrc for persistence
echo 'export GEMINI_API_KEY="your_key_here"' >> ~/.bashrc
source ~/.bashrc

# OR use .env file (if using dotenv package)
cd /path/to/your/app
nano .env
# Add: GEMINI_API_KEY=your_key_here

# Restart your server
pm2 restart lost-and-found-api
```

### **Using .env File (Recommended):**

1. Copy `.env.example` to `.env` on your VPS
2. Fill in your actual API key
3. Install dotenv: `npm install dotenv`
4. Load it in your server.js:
   ```javascript
   require('dotenv').config();
   ```

---

## �📝 For New Developers:

1. Copy `app.json.example` to `app.json`
2. Replace placeholder values with real API keys
3. Never commit `app.json` with real keys
4. Use EAS Secrets for production builds

---

## ✅ Current Status:

- ✅ API key moved to configuration
- ✅ Code no longer has hardcoded keys
- ✅ Example file created for reference
- ⚠️ **Still need to revoke old key and create new one**
- ⚠️ Consider using EAS Secrets for production

---

## 🔗 Useful Links:

- [Get Gemini API Key](https://aistudio.google.com/app/apikey)
- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/#using-secrets-in-environment-variables)
- [Expo Constants API](https://docs.expo.dev/versions/latest/sdk/constants/)
