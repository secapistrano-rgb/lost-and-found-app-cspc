# 🚀 Enable Background Push Notifications - Complete Setup

## Goal
Enable push notifications to work when the app is **closed or in background**, so users receive system notifications on their device even when not using the app.

---

## 📋 Prerequisites

1. ✅ Expo account (create at expo.dev if you don't have one)
2. ✅ Firebase project (your existing project or create new one)
3. ✅ Android device for testing (or iOS if on Mac)

---

## 🔧 Step-by-Step Setup

### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 2: Login to Expo

```bash
eas login
```

Enter your Expo credentials.

### Step 3: Configure Firebase Cloud Messaging (Android)

#### 3.1 Get Firebase Server Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create new one)
3. Click **Project Settings** (gear icon)
4. Go to **Cloud Messaging** tab
5. Under **Cloud Messaging API (Legacy)**, copy the **Server Key**

**Important**: If you see "Cloud Messaging API (Legacy) is disabled", enable it:
- Click **Manage API**
- Enable **Cloud Messaging API (Legacy)**

#### 3.2 Save Server Key

Create a file called `secrets.json` in your project root:

```json
{
  "FCM_SERVER_KEY": "YOUR_FIREBASE_SERVER_KEY_HERE"
}
```

⚠️ **Add to .gitignore**:
```bash
echo "secrets.json" >> .gitignore
```

### Step 4: Update app.json Configuration

I'll update this for you now...

---

## 🎯 Quick Start (Automated Setup)

Run this command to set everything up:

```bash
node setup_production_push.js
```

This will:
1. Check your Firebase configuration
2. Update app.json with proper settings
3. Configure EAS build
4. Guide you through the build process

---

## 📱 Build and Test

### Build for Android (Development)

```bash
# Configure EAS Build
eas build:configure

# Build development APK (faster, for testing)
eas build --platform android --profile development

# Or build preview APK
eas build --platform android --profile preview
```

**Wait time**: ~10-15 minutes for first build

### Install on Device

1. Build will upload to Expo servers
2. You'll get a download link
3. Download APK to your Android device
4. Install the APK
5. Open the app and login

### Test Background Push

1. **Login to the app** (registers push token)
2. **Close the app completely** (swipe away from recent apps)
3. **Run test**:
   ```bash
   node test_push_notifications.js
   ```
4. **Check your device** - notification should appear! 🎉

---

## 🔄 Alternative: Quick Test with Development Build

If you want to test faster without full production setup:

### Option A: Use Expo Development Client

```bash
# Install development client
npx expo install expo-dev-client

# Start development server
npx expo start --dev-client

# Build development client
eas build --platform android --profile development

# Install on device and test
```

### Option B: Use Local Build (Faster)

```bash
# For Android (if you have Android Studio)
npx expo run:android

# This builds locally and installs on connected device
```

---

## 📝 Configuration Files I'll Create

1. **eas.json** - EAS Build configuration
2. **setup_production_push.js** - Automated setup script
3. **firebase-credentials.json** - Firebase config (you'll need to add your key)
4. **Updated app.json** - With proper FCM settings

---

## ⚡ Fast Track (For Immediate Testing)

If you want to test ASAP:

```bash
# 1. Login to EAS
eas login

# 2. Configure build
eas build:configure

# 3. Build for Android (takes ~15 min)
eas build --platform android --profile development

# 4. Install APK on your device

# 5. Test!
node test_push_notifications.js
```

---

## 🎯 What Happens After Setup

```
┌─────────────────────────────────────────────┐
│  Before (Current - Expo Go)                 │
├─────────────────────────────────────────────┤
│  App Closed    → ❌ No notification         │
│  App Background → ❌ No notification         │
│  App Open      → ✅ Notification works      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  After (Production Build)                   │
├─────────────────────────────────────────────┤
│  App Closed    → ✅ System notification     │
│  App Background → ✅ System notification     │
│  App Open      → ✅ Notification works      │
│                                             │
│  🔔 Push notification appears on:           │
│     • Lock screen                           │
│     • Notification shade                    │
│     • With sound & vibration                │
│     • Opens app when tapped                 │
└─────────────────────────────────────────────┘
```

---

## 🚦 Ready to Start?

I'll now create all the necessary configuration files for you. 

**Your choice:**

1. **Full Production Setup** (~30 min total)
   - Complete EAS Build setup
   - Production-ready APK
   - Firebase integration
   - Best for final deployment

2. **Quick Development Build** (~15 min)
   - Faster to test
   - Good for development
   - Still works for push notifications

Which would you prefer? Type 1 or 2, or just say "start" and I'll do the full setup!

---

## 📞 Need Help?

- EAS Build Docs: https://docs.expo.dev/build/introduction/
- Push Notifications: https://docs.expo.dev/push-notifications/overview/
- Firebase Setup: https://firebase.google.com/docs/cloud-messaging

**Let me know when you're ready and I'll configure everything!** 🚀
