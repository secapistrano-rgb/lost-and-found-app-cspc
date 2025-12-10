# Appeal for Account Unsuspension Feature

## Overview
Added functionality for suspended users to appeal their account suspension directly from suspension notifications by opening Gmail with a pre-filled appeal email.

## Implementation Date
November 25, 2025

## Changes Made

### 1. LoginScreen.js
**Location:** `src/features/auth/screens/LoginScreen.js`

**Changes:**
- Added `Linking` import to handle opening Gmail app
- Added "Appeal" button to the suspension modal dialog
- Button opens Gmail with pre-filled email to `lostfoundcspc@gmail.com`
- Email includes:
  - Subject: "Appeal for Account Unsuspension"
  - User's email address
  - Template for appeal reason
- Added new styles:
  - `modalButtonContainer`: Container for both Appeal and OK buttons
  - `appealButton`: Green button for appeal action
  - `appealButtonText`: Text styling for appeal button
- Modified `modalButton` style to work in horizontal layout

### 2. SuspensionContext.js
**Location:** `src/contexts/SuspensionContext.js`

**Changes:**
- Added `Linking` import
- Updated Alert.alert to include "Appeal" button before "OK" button
- Appeal button opens Gmail with same pre-filled template
- Maintains existing logout functionality on "OK" button

### 3. useSuspensionCheck.js
**Location:** `src/shared/hooks/useSuspensionCheck.js`

**Changes:**
- Added `Linking` import
- Updated Alert.alert in default suspension handling to include "Appeal" button
- Appeal button opens Gmail with pre-filled template
- Maintains existing logout and navigation functionality

## User Flow

1. **User attempts to login with suspended account:**
   - Sees suspension modal with message explaining suspension
   - Two buttons displayed:
     - **Appeal** (Green): Opens Gmail with pre-filled appeal email
     - **OK** (Red): Dismisses modal and stays on login screen

2. **User gets suspended while using the app:**
   - Alert dialog appears with suspension details
   - Two options:
     - **Appeal**: Opens Gmail to send appeal email
     - **OK**: Logs out user and returns to login screen

3. **Appeal email template includes:**
   - Subject: "Appeal for Account Unsuspension"
   - User's email address automatically filled
   - Template structure for user to explain their appeal
   - Recipient: lostfoundcspc@gmail.com

## Technical Details

### Email Format
```javascript
Subject: Appeal for Account Unsuspension
Body:
Dear Support Team,

I would like to appeal the suspension of my account.

Account Email: [user's email]

Reason for Appeal:
[Please describe your reason here]

Thank you for your consideration.
```

### Button Styling
- **Appeal Button:**
  - Background: #28a745 (green)
  - Icon: mail-outline
  - Position: Left side
  
- **OK Button:**
  - Background: #dc3545 (red)
  - No icon
  - Position: Right side

### Files Modified
1. `src/features/auth/screens/LoginScreen.js`
2. `src/contexts/SuspensionContext.js`
3. `src/shared/hooks/useSuspensionCheck.js`

## Benefits

1. **User Rights:** Provides suspended users with a clear path to appeal their suspension
2. **Convenience:** Pre-filled email template makes it easy for users to submit appeals
3. **Professionalism:** Maintains a structured appeal process
4. **Transparency:** Shows users their options when suspended
5. **Direct Communication:** Opens default Gmail app for seamless email sending

## Testing Recommendations

1. Test suspension modal on login screen
2. Test real-time suspension detection while app is running
3. Verify Gmail app opens correctly on both Android and iOS
4. Confirm pre-filled email content is correct
5. Test both temporary and permanent suspension scenarios
6. Verify "OK" button still works correctly after adding Appeal button

## Future Enhancements

1. Add in-app appeal form (optional)
2. Track appeal submissions in database
3. Add appeal status checking
4. Send confirmation when appeal is received
5. Allow admins to respond to appeals within app
