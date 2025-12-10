/**
 * Script to add internet guards to all remaining screens
 * 
 * Screens to update:
 * - EditItemScreen
 * - UserItemHistory
 * - MatchesScreen
 * - MatchDetailsScreen
 * - ClaimRequestsScreen
 * - ClaimDetailsScreen
 * - UserProfileScreen
 * - UserStatsScreen
 * - UserAchievementsScreen
 * - UserFeedbackScreen
 * - SettingsScreen
 * - HelpSupportScreen
 * - ClearStorageScreen
 * - HelpSignInScreen
 * - TwoFactorVerificationScreen
 * - NotificationsScreen
 */

const screensToUpdate = [
  {
    path: 'src/features/items/screens/EditItemScreen.js',
    name: 'EditItemScreen'
  },
  {
    path: 'src/features/items/screens/UserItemHistory.js',
    name: 'UserItemHistory'
  },
  {
    path: 'src/features/matching/screens/MatchesScreen.js',
    name: 'MatchesScreen'
  },
  {
    path: 'src/features/matching/screens/MatchDetailsScreen.js',
    name: 'MatchDetailsScreen'
  },
  {
    path: 'src/features/matching/screens/ClaimRequestsScreen.js',
    name: 'ClaimRequestsScreen'
  },
  {
    path: 'src/features/matching/screens/ClaimDetailsScreen.js',
    name: 'ClaimDetailsScreen'
  },
  {
    path: 'src/features/profile/screens/UserProfileScreen.js',
    name: 'UserProfileScreen'
  },
  {
    path: 'src/features/profile/screens/UserStatsScreen.js',
    name: 'UserStatsScreen'
  },
  {
    path: 'src/features/profile/screens/UserAchievementsScreen.js',
    name: 'UserAchievementsScreen'
  },
  {
    path: 'src/features/profile/screens/UserFeedbackScreen.js',
    name: 'UserFeedbackScreen'
  },
  {
    path: 'src/features/profile/screens/SettingsScreen.js',
    name: 'SettingsScreen'
  },
  {
    path: 'src/features/profile/screens/HelpSupportScreen.js',
    name: 'HelpSupportScreen'
  },
  {
    path: 'src/features/profile/screens/ClearStorageScreen.js',
    name: 'ClearStorageScreen'
  },
  {
    path: 'src/features/auth/screens/HelpSignInScreen.js',
    name: 'HelpSignInScreen'
  },
  {
    path: 'src/features/auth/screens/TwoFactorVerificationScreen.js',
    name: 'TwoFactorVerificationScreen'
  },
  {
    path: 'src/features/notifications/screens/NotificationsScreen.js',
    name: 'NotificationsScreen'
  }
];

// For each screen:
// 1. Add import: import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';
// 2. Change export: export default withInternetGuard(ScreenName);

console.log('Screens to update:', screensToUpdate.length);
