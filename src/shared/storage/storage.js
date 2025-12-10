import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
export const LOST_ITEMS_KEY = 'lost_items';
export const FOUND_ITEMS_KEY = 'found_items';
export const MATCHES_KEY = 'matches';
export const USER_KEY = 'user_data';
export const APP_SETTINGS_KEY = 'app_settings';

/**
 * Generic function to get data from AsyncStorage
 * @param {string} key - Storage key
 * @returns {Promise<Array|Object|null>} Parsed data or null if not found
 */
export const getData = async (key) => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (error) {
    console.error(`Error getting data for key ${key}:`, error);
    return null;
  }
};

/**
 * Generic function to store data in AsyncStorage
 * @param {string} key - Storage key
 * @param {Array|Object} value - Data to store
 * @returns {Promise<boolean>} Success status
 */
export const storeData = async (key, value) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
    return true;
  } catch (error) {
    console.error(`Error storing data for key ${key}:`, error);
    return false;
  }
};

// Lost Items Functions
export const getLostItems = async () => {
  return getData(LOST_ITEMS_KEY);
};

export const saveLostItems = async (items) => {
  return storeData(LOST_ITEMS_KEY, items);
};

export const addLostItem = async (item) => {
  try {
    const lostItems = await getLostItems() || [];
    
    // Ensure reporter information is preserved
    const newItem = {
      ...item,
      id: item.id || Date.now().toString(),
      createdAt: item.createdAt || new Date().toISOString(),
      status: item.status || 'active',
      type: 'lost', // Add type property
      // Preserve reporter information
      reporter: item.reporter || null,
      reporterId: item.reporterId || null,
    };
    
    // Log the item being added for debugging
    console.log('Adding lost item with reporter info:', 
      newItem.reporterId, 
      newItem.reporter?.email);
    
    lostItems.unshift(newItem);
    await saveLostItems(lostItems);
    
    // Verify the item was added correctly
    const updatedItems = await getLostItems() || [];
    console.log('Total lost items after adding:', updatedItems.length);
    
    return newItem;
  } catch (error) {
    console.error('Error adding lost item:', error);
    return null;
  }
};

// Found Items Functions
export const getFoundItems = async () => {
  return getData(FOUND_ITEMS_KEY);
};

export const saveFoundItems = async (items) => {
  return storeData(FOUND_ITEMS_KEY, items);
};

export const addFoundItem = async (item) => {
  try {
    const foundItems = await getFoundItems() || [];
    
    // Ensure reporter information is preserved
    const newItem = {
      ...item,
      id: item.id || Date.now().toString(),
      createdAt: item.createdAt || new Date().toISOString(),
      status: item.status || 'active',
      type: 'found', // Add type property
      // Preserve reporter information
      reporter: item.reporter || null,
      reporterId: item.reporterId || null,
    };
    
    // Log the item being added for debugging
    console.log('Adding found item with reporter info:', 
      newItem.reporterId, 
      newItem.reporter?.email);
    
    foundItems.unshift(newItem);
    await saveFoundItems(foundItems);
    
    // Verify the item was added correctly
    const updatedItems = await getFoundItems() || [];
    console.log('Total found items after adding:', updatedItems.length);
    
    return newItem;
  } catch (error) {
    console.error('Error adding found item:', error);
    return null;
  }
};

export const updateLostItem = async (itemId, updatedData) => {
  try {
    const lostItems = await getLostItems() || [];
    const itemIndex = lostItems.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      console.error('Lost item not found for update:', itemId);
      return null;
    }
    
    // Update the item with new data
    lostItems[itemIndex] = {
      ...lostItems[itemIndex],
      ...updatedData,
      updatedAt: new Date().toISOString()
    };
    
    await saveLostItems(lostItems);
    return lostItems[itemIndex];
  } catch (error) {
    console.error('Error updating lost item:', error);
    return null;
  }
};

export const updateFoundItem = async (itemId, updatedData) => {
  try {
    const foundItems = await getFoundItems() || [];
    const itemIndex = foundItems.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      console.error('Found item not found for update:', itemId);
      return null;
    }
    
    // Update the item with new data
    foundItems[itemIndex] = {
      ...foundItems[itemIndex],
      ...updatedData,
      updatedAt: new Date().toISOString()
    };
    
    await saveFoundItems(foundItems);
    return foundItems[itemIndex];
  } catch (error) {
    console.error('Error updating found item:', error);
    return null;
  }
};

export const deleteLostItem = async (itemId) => {
  try {
    const lostItems = await getLostItems() || [];
    const filteredItems = lostItems.filter(item => item.id !== itemId);
    
    if (filteredItems.length === lostItems.length) {
      console.error('Lost item not found for deletion:', itemId);
      return false;
    }
    
    await saveLostItems(filteredItems);
    return true;
  } catch (error) {
    console.error('Error deleting lost item:', error);
    return false;
  }
};

export const deleteFoundItem = async (itemId) => {
  try {
    const foundItems = await getFoundItems() || [];
    const filteredItems = foundItems.filter(item => item.id !== itemId);
    
    if (filteredItems.length === foundItems.length) {
      console.error('Found item not found for deletion:', itemId);
      return false;
    }
    
    await saveFoundItems(filteredItems);
    return true;
  } catch (error) {
    console.error('Error deleting found item:', error);
    return false;
  }
};

// Matches Functions
export const getMatches = async () => {
  try {
    const matches = await getData(MATCHES_KEY);
    // Ensure we always return an array
    return Array.isArray(matches) ? matches : [];
  } catch (error) {
    console.error('Error getting matches:', error);
    return [];
  }
};

export const saveMatches = async (matches) => {
  return storeData(MATCHES_KEY, matches);
};

export const addMatch = async (matchData) => {
  try {
    const matches = await getMatches();
    const newMatch = {
      ...matchData,
      id: matchData.id || `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: matchData.created_at || new Date().toISOString(),
      status: matchData.status || 'pending'
    };
    
    matches.push(newMatch);
    await saveMatches(matches);
    return newMatch;
  } catch (error) {
    console.error('Error adding match:', error);
    return null;
  }
};

export const getMatchesByUser = async (userEmail) => {
  try {
    const matches = await getMatches();
    // Ensure matches is an array before filtering
    if (!matches || !Array.isArray(matches)) {
      return [];
    }
    return matches.filter(match => match.user_email === userEmail);
  } catch (error) {
    console.error('Error getting matches by user:', error);
    return [];
  }
};

export const updateMatchStatus = async (matchId, status) => {
  try {
    const matches = await getMatches();
    const matchIndex = matches.findIndex(match => match.id === matchId);
    
    if (matchIndex === -1) {
      console.error('Match not found:', matchId);
      return false;
    }
    
    matches[matchIndex] = {
      ...matches[matchIndex],
      status,
      updated_at: new Date().toISOString()
    };
    
    await saveMatches(matches);
    return matches[matchIndex];
  } catch (error) {
    console.error('Error updating match status:', error);
    return false;
  }
};

export const deleteMatch = async (matchId) => {
  try {
    const matches = await getMatches();
    const filteredMatches = matches.filter(match => match.id !== matchId);
    
    if (filteredMatches.length === matches.length) {
      console.error('Match not found for deletion:', matchId);
      return false;
    }
    
    await saveMatches(filteredMatches);
    return true;
  } catch (error) {
    console.error('Error deleting match:', error);
    return false;
  }
};

export const clearMatchesData = async () => {
  return clearData(MATCHES_KEY);
};

// User Functions
export const getUser = async () => {
  return getData(USER_KEY);
};

export const saveUser = async (userData) => {
  return storeData(USER_KEY, userData);
};

export const updateUserField = async (field, value) => {
  try {
    const user = await getUser() || {};
    const updatedUser = {
      ...user,
      [field]: value,
      updatedAt: new Date().toISOString(),
    };
    
    await saveUser(updatedUser);
    return updatedUser;
  } catch (error) {
    console.error(`Error updating user field ${field}:`, error);
    return null;
  }
};

// App Settings Functions
export const getAppSettings = async () => {
  return getData(APP_SETTINGS_KEY) || getDefaultSettings();
};

export const saveAppSettings = async (settings) => {
  return storeData(APP_SETTINGS_KEY, settings);
};

export const updateAppSetting = async (setting, value) => {
  try {
    const settings = await getAppSettings();
    const updatedSettings = {
      ...settings,
      [setting]: value,
      updatedAt: new Date().toISOString(),
    };
    
    await saveAppSettings(updatedSettings);
    return updatedSettings;
  } catch (error) {
    console.error(`Error updating app setting ${setting}:`, error);
    return null;
  }
};

// Default app settings
export const getDefaultSettings = () => {
  return {
    notifications: true,
    language: 'en',
    fontSize: 'medium',
    createdAt: new Date().toISOString(),
  };
};

// Clear specific data
export const clearData = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error clearing data for key ${key}:`, error);
    return false;
  }
};

// Clear all app data
export const clearAllData = async () => {
  try {
    const keys = [
      LOST_ITEMS_KEY,
      FOUND_ITEMS_KEY,
      MATCHES_KEY,
      USER_KEY,
      APP_SETTINGS_KEY,
    ];
    
    await AsyncStorage.multiRemove(keys);
    return true;
  } catch (error) {
    console.error('Error clearing all data:', error);
    return false;
  }
};

// clearMatchesData function removed - matches API no longer available