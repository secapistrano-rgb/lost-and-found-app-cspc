import { getData, getUser } from '../storage/storage';
import { getUserSettings, saveUserSettings } from '../storage/userStorage';

/**
 * Check if push notifications are enabled in user settings
 * @returns {Promise<boolean>} Whether push notifications are enabled
 */
export const isPushNotificationsEnabled = async () => {
  try {
    // Get current user
    const user = await getUser();
    if (!user) {
      return true; // Default to enabled if no user logged in
    }
    
    // Check the user-specific push notification setting
    const pushEnabled = await getData(`push_notifications_enabled_${user.email}`);
    if (pushEnabled !== null) {
      return pushEnabled;
    }
    
    // Fallback to user settings
    const userSettings = await getUserSettings(user.email);
    return userSettings?.notifications ?? true; // Default to true if not set
  } catch (error) {
    console.error('Error checking push notification settings:', error);
    return true; // Default to enabled on error
  }
};

/**
 * Check if email alerts are enabled in user settings
 * @returns {Promise<boolean>} Whether email alerts are enabled
 */
export const isEmailAlertsEnabled = async () => {
  try {
    // Get current user
    const user = await getUser();
    if (!user) {
      return true; // Default to enabled if no user logged in
    }
    
    // Check the user-specific email alert setting
    const emailEnabled = await getData(`email_alerts_enabled_${user.email}`);
    if (emailEnabled !== null) {
      return emailEnabled;
    }
    
    // Fallback to user settings
    const userSettings = await getUserSettings(user.email);
    return userSettings?.emailAlerts ?? true; // Default to true if not set
  } catch (error) {
    console.error('Error checking email alert settings:', error);
    return true; // Default to enabled on error
  }
};

/**
 * Get all current user settings
 * @returns {Promise<Object>} User settings object
 */
export const getCurrentUserSettings = async () => {
  try {
    const user = await getUser();
    if (!user) {
      return {
        notifications: true,
        emailAlerts: true,
        saveImageToGallery: false
      };
    }
    
    const userSettings = await getUserSettings(user.email);
    return userSettings || {
      notifications: true,
      emailAlerts: true,
      saveImageToGallery: false
    };
  } catch (error) {
    console.error('Error getting user settings:', error);
    return {
      notifications: true,
      emailAlerts: true,
      saveImageToGallery: false
    };
  }
};



/**
 * Update a specific setting for the current user
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 * @returns {Promise<boolean>} Whether the update was successful
 */
export const updateUserSetting = async (key, value) => {
  try {
    const user = await getUser();
    if (!user) {
      console.error('No user logged in, cannot update settings');
      return false;
    }
    
    const settings = await getCurrentUserSettings();
    const updatedSettings = { ...settings, [key]: value };
    await saveUserSettings(user.email, updatedSettings);
    return true;
  } catch (error) {
    console.error('Error updating user setting:', error);
    return false;
  }
};