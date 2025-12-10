# All Screens Protected with Internet Guard

## ✅ COMPLETED - Screens with Internet Guard Applied

### Authentication Screens (3)
1. ✅ **LoginScreen** - `src/features/auth/screens/LoginScreen.js`
   - Blocks Google Sign-In when offline
   - Full screen protection

2. ⏳ **HelpSignInScreen** - `src/features/auth/screens/HelpSignInScreen.js`
   - Help/instructions for signing in
   - Needs guard for consistency

3. ⏳ **TwoFactorVerificationScreen** - `src/features/auth/screens/TwoFactorVerificationScreen.js`
   - 2FA verification
   - Needs guard for authentication security

### Home & Discovery (1)
4. ✅ **HomeScreen** - `src/features/home/screens/HomeScreen.js`
   - Main feed of lost/found items
   - Full screen protection

### Item Management Screens (4)
5. ✅ **ReportItemScreen** - `src/features/items/screens/ReportItemScreen.js`
   - Create new lost/found item reports
   - Full screen protection + action guards

6. ✅ **ItemDetailsScreen** - `src/features/items/screens/ItemDetailsScreen.js`
   - View item details
   - Full screen protection

7. ✅ **EditItemScreen** - `src/features/items/screens/EditItemScreen.js`
   - Edit existing items
   - Full screen protection

8. ✅ **UserItemHistory** - `src/features/items/screens/UserItemHistory.js`
   - View user's reported items
   - Full screen protection

### Matching & Claims Screens (5)
9. ⏳ **MatchesScreen** - `src/features/matching/screens/MatchesScreen.js`
   - View potential matches
   - Needs guard

10. ⏳ **MatchDetailsScreen** - `src/features/matching/screens/MatchDetailsScreen.js`
    - Detailed match comparison
    - Needs guard

11. ✅ **ClaimItemScreen** - `src/features/items/screens/ClaimItemScreen.js`
    - Submit claim requests
    - Full screen protection + action guards

12. ⏳ **ClaimRequestsScreen** - `src/features/matching/screens/ClaimRequestsScreen.js`
    - View claim requests
    - Needs guard

13. ⏳ **ClaimDetailsScreen** - `src/features/matching/screens/ClaimDetailsScreen.js`
    - Detailed claim information
    - Needs guard

### Profile & User Screens (6)
14. ⏳ **UserProfileScreen** - `src/features/profile/screens/UserProfileScreen.js`
    - User profile and information
    - Needs guard

15. ⏳ **UserStatsScreen** - `src/features/profile/screens/UserStatsScreen.js`
    - User statistics and analytics
    - Needs guard

16. ⏳ **UserAchievementsScreen** - `src/features/profile/screens/UserAchievementsScreen.js`
    - Achievements and badges
    - Needs guard

17. ⏳ **UserFeedbackScreen** - `src/features/profile/screens/UserFeedbackScreen.js`
    - Submit feedback
    - Needs guard

18. ⏳ **SettingsScreen** - `src/features/profile/screens/SettingsScreen.js`
    - App settings
    - Consider allowing offline access with `allowOfflineAccess: true`

19. ⏳ **HelpSupportScreen** - `src/features/profile/screens/HelpSupportScreen.js`
    - Help and support
    - Consider allowing offline access

20. ⏳ **ClearStorageScreen** - `src/features/profile/screens/ClearStorageScreen.js`
    - Clear local storage
    - Consider allowing offline access

### Notifications (1)
21. ⏳ **NotificationsScreen** - `src/features/notifications/screens/NotificationsScreen.js`
    - View notifications
    - Needs guard

---

## Implementation Instructions

### For Each Remaining Screen:

#### Step 1: Add Import
Add this import near the top of the file (after other imports):
```javascript
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';
```

#### Step 2: Wrap Export
Change the export from:
```javascript
export default ScreenName;
```

To:
```javascript
export default withInternetGuard(ScreenName);
```

#### Step 3 (Optional): Add Action Guards
For screens with submit/save actions, add internet check in the action handler:
```javascript
import { requireInternet } from '../../../shared/utils/internetRequired';

const handleAction = async () => {
  const hasInternet = await requireInternet('perform this action');
  if (!hasInternet) return;
  
  // Continue with action
};
```

---

## Special Considerations

### Screens That May Allow Offline Access

Some screens could potentially work offline for read-only purposes:

1. **SettingsScreen** - View settings offline (but block changes)
   ```javascript
   export default withInternetGuard(SettingsScreen, {
     allowOfflineAccess: true
   });
   ```

2. **HelpSupportScreen** - View help content offline
   ```javascript
   export default withInternetGuard(HelpSupportScreen, {
     allowOfflineAccess: true
   });
   ```

3. **ClearStorageScreen** - Allow clearing local cache offline
   ```javascript
   export default withInternetGuard(ClearStorageScreen, {
     allowOfflineAccess: true
   });
   ```

**Decision:** For now, block ALL screens to ensure data consistency. Can be adjusted later if needed.

---

## Quick Reference Commands

### Find All Screen Files
```powershell
Get-ChildItem -Path "src" -Recurse -Filter "*Screen.js" | Select-Object FullName
```

### Check If Screen Has Guard
```powershell
Select-String -Path "src/features/*/screens/*Screen.js" -Pattern "withInternetGuard"
```

### Batch Update Script
Use the provided PowerShell script:
```powershell
.\update-all-screens.ps1
```

---

## Progress Tracker

- ✅ Completed: 8 screens
- ⏳ Remaining: 13 screens
- **Total:** 21 screens

### Completed (8/21)
- LoginScreen ✅
- HomeScreen ✅
- ReportItemScreen ✅
- ItemDetailsScreen ✅
- EditItemScreen ✅
- UserItemHistory ✅
- ClaimItemScreen ✅

### In Progress (0/21)
(None currently)

### Pending (13/21)
- HelpSignInScreen
- TwoFactorVerificationScreen
- MatchesScreen
- MatchDetailsScreen
- ClaimRequestsScreen
- ClaimDetailsScreen
- UserProfileScreen
- UserStatsScreen
- UserAchievementsScreen
- UserFeedbackScreen
- SettingsScreen
- HelpSupportScreen
- ClearStorageScreen
- NotificationsScreen

---

## Testing Checklist

After updating all screens:

### Test Each Screen Type:
- [ ] Authentication screens (login, help, 2FA)
- [ ] Home/discovery screens
- [ ] Item management screens (report, details, edit, history)
- [ ] Matching screens (matches list, match details)
- [ ] Claims screens (claim form, requests list, details)
- [ ] Profile screens (profile, stats, achievements, feedback)
- [ ] Settings screens (settings, help, clear storage)
- [ ] Notifications screen

### Test Scenarios:
1. [ ] Open app offline - all screens should show OfflineScreen
2. [ ] Navigate between screens offline - should stay blocked
3. [ ] Lose connection while using app - should immediately switch to OfflineScreen
4. [ ] Reconnect and retry - should load normally
5. [ ] Try actions (submit, save, delete) offline - should show alert

---

## Deployment Notes

### After All Screens Updated:
1. Test on physical device with airplane mode
2. Verify all screens are blocked when offline
3. Test reconnection flow works smoothly
4. Update app documentation
5. Deploy to production

### User Communication:
- Update FAQ with internet requirement info
- Add to onboarding/welcome screen
- Include in app store description

---

**Status:** 🟡 IN PROGRESS (38% complete - 8/21)  
**Last Updated:** January 2025  
**Target:** 100% coverage on all screens
