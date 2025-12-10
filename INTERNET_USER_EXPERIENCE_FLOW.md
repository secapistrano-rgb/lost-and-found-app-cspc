# Internet Connection Requirement - User Experience Flow

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER OPENS APP                              │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                    ┌─────────────┴──────────────┐
                    │                            │
            Has Internet?                  No Internet?
                    │                            │
                    ↓                            ↓
        ┌───────────────────────┐   ┌──────────────────────────┐
        │   Normal App Screen   │   │    🌐 OFFLINE SCREEN     │
        │  ✅ Can use all       │   │  ❌ Access Blocked       │
        │     features          │   │  "No Internet            │
        │                       │   │   Connection"            │
        │  - Login              │   │                          │
        │  - Create Items       │   │  [Retry Connection]      │
        │  - Submit Claims      │   │                          │
        └───────────┬───────────┘   └────────────┬─────────────┘
                    │                            │
                    │                            │
                    │                    User Clicks Retry
                    │                            │
                    │                            ↓
                    │                   Checks Connection
                    │                            │
                    │              ┌─────────────┴────────────┐
                    │              │                          │
                    │         Connected?                Not Connected?
                    │              │                          │
                    │              ↓                          ↓
                    └──────> App Loads         Stay on Offline Screen
                                  │                          │
                                  │                          └─────┐
                                  │                                │
                                  ↓                                ↓
                      User Can Use All Features      User Sees "Try Again"
```

---

## Scenario 1: User Opens App Offline

### Step-by-Step Experience

**1. App Launch**
```
[Splash Screen]
  ↓
Checking Internet...
  ↓
❌ No Connection Detected
```

**2. Offline Screen Appears**
```
╔════════════════════════════════════════╗
║                                        ║
║            🌐 (Red Icon)              ║
║         No Internet Connection         ║
║                                        ║
║  This app requires an active internet  ║
║  connection to work.                   ║
║                                        ║
║  Please check your connection          ║
║                                        ║
║  Requirements:                         ║
║  ✓ Wi-Fi or Mobile Data               ║
║  ✓ Active Internet Connection         ║
║                                        ║
║    ┌───────────────────────────┐      ║
║    │  🔄 Retry Connection      │      ║
║    └───────────────────────────┘      ║
║                                        ║
║  ℹ️ Internet required for login,      ║
║     creating items, and all features   ║
╚════════════════════════════════════════╝
```

**3. User Actions**
- ❌ Cannot navigate away from OfflineScreen
- ❌ Cannot access any app features
- ✅ Can only click "Retry Connection"

**4. User Connects to Internet**
- Turns on Wi-Fi or Mobile Data
- Clicks "Retry Connection"
- App checks connection
- ✅ App loads normally

---

## Scenario 2: User Loses Connection While Using App

### Step-by-Step Experience

**1. User is Browsing Items (Online)**
```
┌─────────────────────────────┐
│  Lost & Found CSPC          │
├─────────────────────────────┤
│  📱 Lost: iPhone 13         │
│  👕 Found: Blue Jacket      │
│  💼 Lost: Backpack          │
│  📚 Found: Notebook         │
└─────────────────────────────┘
```

**2. User Clicks "Report Item"**
```
Navigation starts...
  ↓
withInternetGuard checks connection
  ↓
❌ No Internet Detected!
```

**3. Screen Immediately Switches**
```
╔════════════════════════════════════════╗
║  🌐 No Internet Connection            ║
║                                        ║
║  You've lost your internet connection  ║
║                                        ║
║    ┌───────────────────────────┐      ║
║    │  🔄 Retry Connection      │      ║
║    └───────────────────────────┘      ║
╚════════════════════════════════════════╝
```

**4. User Cannot Proceed**
- ❌ Report Item screen blocked
- ❌ Cannot fill form
- ❌ Cannot upload images
- ✅ Must reconnect to continue

---

## Scenario 3: User Tries to Login Offline

### Step-by-Step Experience

**1. User Opens App (Offline)**
```
┌─────────────────────────────┐
│    🌐 OFFLINE SCREEN        │
│  "No Internet Connection"   │
└─────────────────────────────┘
```

**2. User Connects Internet & Retries**
```
Checking Connection...
  ↓
✅ Connected!
  ↓
Login Screen Loads
```

**3. Login Screen Appears**
```
┌─────────────────────────────────┐
│   Lost & Found CSPC             │
│                                 │
│   [Logo]                        │
│                                 │
│   ┌─────────────────────────┐  │
│   │  🔐 Sign in with Google │  │
│   └─────────────────────────┘  │
│                                 │
│   Use your @my.cspc.edu.ph     │
│   email to sign in              │
└─────────────────────────────────┘
```

**4. User Clicks "Sign in with Google"**
```
Checking Internet...
  ↓
✅ Connection OK
  ↓
Opening Google Sign-In...
  ↓
✅ Authentication Proceeds
```

---

## Scenario 4: User Loses Connection During Form Submission

### Step-by-Step Experience

**1. User Filling Report Item Form (Online)**
```
┌─────────────────────────────────┐
│  Report Item                    │
├─────────────────────────────────┤
│  Type: [Lost] [Found]           │
│  Title: [Lost iPhone 13____]    │
│  Description: [Black iPhone_]   │
│  Location: [Library_______]     │
│                                 │
│   [Submit Report]               │
└─────────────────────────────────┘
```

**2. User Loses Internet Connection**
```
[Internet disconnects]
  ↓
NetInfo detects change (<2 seconds)
  ↓
❌ Connection Lost!
```

**3. Screen Switches to Offline**
```
╔════════════════════════════════════════╗
║  🌐 No Internet Connection            ║
║                                        ║
║  Connection lost. Please reconnect.    ║
║                                        ║
║    ┌───────────────────────────┐      ║
║    │  🔄 Retry Connection      │      ║
║    └───────────────────────────┘      ║
╚════════════════════════════════════════╝
```

**4. User's Form Data**
- ⚠️ Form data is LOST (not saved)
- ❌ Cannot submit report
- ❌ Cannot continue editing
- ✅ Must reconnect and start over

**5. User Clicks "Submit" Before Screen Switches**
```
User clicks [Submit Report]
  ↓
requireInternet() checks connection
  ↓
❌ No Connection Detected
  ↓
Alert Appears:
╔═══════════════════════════════════════╗
║  ⚠️ No Internet Connection           ║
║                                       ║
║  Internet connection is required to   ║
║  report an item. Please check your    ║
║  connection and try again.            ║
║                                       ║
║            [  OK  ]                   ║
╚═══════════════════════════════════════╝
```

---

## Alert Examples

### 1. Login Attempt Offline
```
╔═══════════════════════════════════════╗
║  ⚠️ No Internet Connection           ║
║  ───────────────────────────────────  ║
║  Internet connection is required to   ║
║  sign in with Google. Please check    ║
║  your connection and try again.       ║
║                                       ║
║            [  OK  ]                   ║
╚═══════════════════════════════════════╝
```

### 2. Report Item Attempt Offline
```
╔═══════════════════════════════════════╗
║  ⚠️ No Internet Connection           ║
║  ───────────────────────────────────  ║
║  Internet connection is required to   ║
║  report an item. Please check your    ║
║  connection and try again.            ║
║                                       ║
║            [  OK  ]                   ║
╚═══════════════════════════════════════╝
```

### 3. Claim Submit Attempt Offline
```
╔═══════════════════════════════════════╗
║  ⚠️ No Internet Connection           ║
║  ───────────────────────────────────  ║
║  Internet connection is required to   ║
║  submit a claim request. Please check ║
║  your connection and try again.       ║
║                                       ║
║            [  OK  ]                   ║
╚═══════════════════════════════════════╝
```

---

## State Transitions

### Connection State Machine

```
          ┌──────────┐
          │  ONLINE  │
          └────┬─────┘
               │
       Connection Lost
               │
               ↓
          ┌──────────┐
          │ OFFLINE  │◄────┐
          └────┬─────┘     │
               │            │
         User Clicks        │
           Retry        Still No
               │        Connection
               ↓            │
          ┌──────────┐     │
          │ CHECKING │─────┘
          └────┬─────┘
               │
        Connection Found
               │
               ↓
          ┌──────────┐
          │  ONLINE  │
          └──────────┘
```

### Screen State Transitions

```
Any Protected Screen
       │
       ├─── Internet? ───┐
       │                 │
      YES               NO
       │                 │
       ↓                 ↓
 Actual Screen    OfflineScreen
       │                 │
       │           User Retries
       │                 │
       │           Checks Again
       │                 │
       └─────────────────┘
```

---

## User Education Messages

### On Offline Screen
```
Why do I need internet?

This app requires internet to:
• Authenticate your CSPC account
• Upload and download item images
• Create and update item reports
• Match lost and found items
• Send and receive notifications
• Keep data synced and up-to-date

Please connect to Wi-Fi or mobile data to continue.
```

### First-Time Users
```
┌────────────────────────────────────┐
│  ℹ️ Important Notice               │
├────────────────────────────────────┤
│  Lost & Found CSPC requires an     │
│  active internet connection to      │
│  work. Make sure you're connected   │
│  to Wi-Fi or mobile data before     │
│  using the app.                     │
│                                     │
│  All features including login,      │
│  item reporting, and claiming       │
│  require internet access.           │
│                                     │
│        [  Got It  ]                │
└────────────────────────────────────┘
```

---

## Summary of User Experience

### ✅ What Users CAN Do
1. See clear offline message
2. Understand why internet is needed
3. Retry connection easily
4. Know exactly what's blocked

### ❌ What Users CANNOT Do
1. Access login screen offline
2. Browse items offline (currently)
3. Create items offline
4. Submit claims offline
5. Perform any write operations offline

### 🔄 How Users Recover
1. Connect to Wi-Fi or Mobile Data
2. Click "Retry Connection" button
3. App checks connection (1-2 seconds)
4. If connected, app loads normally
5. User can continue using app

---

**User Experience Rating:** ⭐⭐⭐⭐⭐
- Clear communication ✅
- Easy recovery process ✅
- No confusing errors ✅
- Professional design ✅
- Prevents data loss ✅
