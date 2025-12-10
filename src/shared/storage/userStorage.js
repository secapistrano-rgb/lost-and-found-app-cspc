import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys with user-specific prefixes
const STATISTICS_KEY_PREFIX = 'user_statistics_';
const ACHIEVEMENTS_KEY_PREFIX = 'user_achievements_';
const FEEDBACK_KEY_PREFIX = 'user_feedback_';
const SETTINGS_KEY_PREFIX = 'user_settings_';
const HELP_SUPPORT_KEY_PREFIX = 'user_help_support_';

/**
 * Get user-specific key by combining the prefix with user email
 * @param {string} prefix - Key prefix
 * @param {string} email - User email
 * @returns {string} User-specific storage key
 */
const getUserKey = (prefix, email) => {
  if (!email) {
    throw new Error('User email is required for user-specific storage');
  }
  return `${prefix}${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
};

/**
 * Generic function to get user-specific data from AsyncStorage
 * @param {string} prefix - Key prefix
 * @param {string} email - User email
 * @returns {Promise<Object|Array|null>} Parsed data or null if not found
 */
const getUserData = async (prefix, email) => {
  try {
    const key = getUserKey(prefix, email);
    console.log(`Getting data with key: ${key}`);
    const jsonValue = await AsyncStorage.getItem(key);
    console.log(`Data retrieved for ${key}:`, jsonValue ? 'Found data' : 'No data found');
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (error) {
    console.error(`Error getting user data for prefix ${prefix}:`, error);
    return null;
  }
};

/**
 * Generic function to store user-specific data in AsyncStorage
 * @param {string} prefix - Key prefix
 * @param {string} email - User email
 * @param {Object|Array} value - Data to store
 * @returns {Promise<boolean>} Success status
 */
const storeUserData = async (prefix, email, value) => {
  try {
    const key = getUserKey(prefix, email);
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
    return true;
  } catch (error) {
    console.error(`Error storing user data for prefix ${prefix}:`, error);
    return false;
  }
};

// Statistics Functions
export const getUserStatistics = async (email) => {
  return getUserData(STATISTICS_KEY_PREFIX, email);
};

export const saveUserStatistics = async (email, statistics) => {
  return storeUserData(STATISTICS_KEY_PREFIX, email, statistics);
};

export const updateUserStatistic = async (email, statName, value) => {
  try {
    const statistics = await getUserStatistics(email) || {};
    const updatedStatistics = {
      ...statistics,
      [statName]: value,
      updatedAt: new Date().toISOString(),
    };
    
    await saveUserStatistics(email, updatedStatistics);
    return updatedStatistics;
  } catch (error) {
    console.error(`Error updating user statistic ${statName}:`, error);
    return null;
  }
};

// Achievements Functions
export const getUserAchievements = async (email) => {
  console.log('Getting achievements for email:', email);
  try {
    const achievements = await getUserData(ACHIEVEMENTS_KEY_PREFIX, email);
    console.log('Retrieved achievements:', achievements ? 'Found' : 'Not found');
    return achievements;
  } catch (error) {
    console.error('Error in getUserAchievements:', error);
    return null;
  }
};

export const saveUserAchievements = async (email, achievements) => {
  return storeUserData(ACHIEVEMENTS_KEY_PREFIX, email, achievements);
};

export const unlockAchievement = async (email, achievementId, achievementData) => {
  try {
    const achievements = await getUserAchievements(email) || {};
    
    // Only update if the achievement doesn't exist or isn't unlocked yet
    if (!achievements[achievementId] || !achievements[achievementId].unlocked) {
      const updatedAchievements = {
        ...achievements,
        [achievementId]: {
          ...achievementData,
          unlocked: true,
          unlockedAt: new Date().toISOString(),
        },
      };
      
      await saveUserAchievements(email, updatedAchievements);
      return updatedAchievements;
    }
    
    return achievements;
  } catch (error) {
    console.error(`Error unlocking achievement ${achievementId}:`, error);
    return null;
  }
};

// Feedback Functions
export const getUserFeedback = async (email) => {
  return getUserData(FEEDBACK_KEY_PREFIX, email);
};

export const saveUserFeedback = async (email, feedback) => {
  return storeUserData(FEEDBACK_KEY_PREFIX, email, feedback);
};

export const addUserFeedback = async (email, feedbackItem) => {
  try {
    // Get existing feedback and ensure it's an array
    let existingFeedback = await getUserFeedback(email);
    
    // If feedback is null, undefined, or not an array, initialize as empty array
    if (!existingFeedback || !Array.isArray(existingFeedback)) {
      existingFeedback = [];
    }
    
    // Create new feedback item with ID and timestamp
    const newFeedbackItem = {
      id: Date.now().toString(),
      ...feedbackItem,
      createdAt: new Date().toISOString(),
    };
    
    // Add new feedback to the beginning of the array
    const newFeedback = [newFeedbackItem, ...existingFeedback];
    
    // Save the updated feedback
    const saveResult = await saveUserFeedback(email, newFeedback);
    
    if (saveResult) {
      return newFeedback;
    } else {
      console.error('Failed to save user feedback');
      return [newFeedbackItem]; // Return at least the new item
    }
  } catch (error) {
    console.error('Error adding user feedback:', error);
    return [];
  }
};

// Settings Functions
export const getUserSettings = async (email) => {
  return getUserData(SETTINGS_KEY_PREFIX, email);
};

export const saveUserSettings = async (email, settings) => {
  return storeUserData(SETTINGS_KEY_PREFIX, email, settings);
};

export const updateUserSetting = async (email, settingName, value) => {
  try {
    const settings = await getUserSettings(email) || {};
    const updatedSettings = {
      ...settings,
      [settingName]: value,
      updatedAt: new Date().toISOString(),
    };
    
    await saveUserSettings(email, updatedSettings);
    return updatedSettings;
  } catch (error) {
    console.error(`Error updating user setting ${settingName}:`, error);
    return null;
  }
};

// Help & Support Functions
export const getUserHelpSupport = async (email) => {
  return getUserData(HELP_SUPPORT_KEY_PREFIX, email);
};

export const saveUserHelpSupport = async (email, helpSupport) => {
  return storeUserData(HELP_SUPPORT_KEY_PREFIX, email, helpSupport);
};

export const addUserHelpRequest = async (email, helpRequest) => {
  try {
    const helpSupport = await getUserHelpSupport(email) || { requests: [] };
    const newRequest = {
      id: Date.now().toString(),
      ...helpRequest,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    const updatedHelpSupport = {
      ...helpSupport,
      requests: [newRequest, ...helpSupport.requests],
    };
    
    await saveUserHelpSupport(email, updatedHelpSupport);
    return updatedHelpSupport;
  } catch (error) {
    console.error('Error adding user help request:', error);
    return null;
  }
};

// Default settings for new users
export const getDefaultUserSettings = () => {
  return {
    notifications: true,
    language: 'en',
    emailAlerts: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

// Initialize user data with defaults if not exists
export const initializeUserData = async (email) => {
  try {
    // Check if user settings exist
    const settings = await getUserSettings(email);
    if (!settings) {
      // Initialize with defaults
      await saveUserSettings(email, getDefaultUserSettings());
    }
    
    // Initialize statistics if not exists
    const statistics = await getUserStatistics(email);
    if (!statistics) {
      await saveUserStatistics(email, {
        itemsReported: 0,
        itemsFound: 0,
        itemsReturned: 0,
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
    
    // Initialize achievements if not exists
    const achievements = await getUserAchievements(email);
    if (!achievements) {
      await saveUserAchievements(email, {});
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing user data:', error);
    return false;
  }
};

// Clear user-specific data
export const clearUserData = async (email) => {
  try {
    const prefixes = [
      STATISTICS_KEY_PREFIX,
      ACHIEVEMENTS_KEY_PREFIX,
      FEEDBACK_KEY_PREFIX,
      SETTINGS_KEY_PREFIX,
      HELP_SUPPORT_KEY_PREFIX,
    ];
    
    for (const prefix of prefixes) {
      const key = getUserKey(prefix, email);
      await AsyncStorage.removeItem(key);
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing user data:', error);
    return false;
  }
};