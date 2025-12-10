import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOST_ITEMS_KEY, FOUND_ITEMS_KEY, MATCHES_KEY } from '../storage/storage';

// Storage keys
const CLAIM_REQUESTS_KEY = 'claimRequests';
const NOTIFICATIONS_KEY = 'notifications';

/**
 * Clear all lost and found items from storage
 * @returns {Promise<boolean>} Success status
 */
export const clearAllReportItems = async () => {
  try {
    await AsyncStorage.multiRemove([LOST_ITEMS_KEY, FOUND_ITEMS_KEY]);
    return true;
  } catch (error) {
    console.error('Error clearing report items:', error);
    return false;
  }
};

/**
 * Clear only lost items from storage
 * @returns {Promise<boolean>} Success status
 */
export const clearLostItems = async () => {
  try {
    await AsyncStorage.removeItem(LOST_ITEMS_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing lost items:', error);
    return false;
  }
};

/**
 * Clear only found items from storage
 * @returns {Promise<boolean>} Success status
 */
export const clearFoundItems = async () => {
  try {
    await AsyncStorage.removeItem(FOUND_ITEMS_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing found items:', error);
    return false;
  }
};

/**
 * Clear all matches from storage
 * @returns {Promise<boolean>} Success status
 */
export const clearMatches = async () => {
  try {
    await AsyncStorage.removeItem(MATCHES_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing matches:', error);
    return false;
  }
};

/**
 * Clear all items and matches from storage
 * @returns {Promise<boolean>} Success status
 */
export const clearAllItemsAndMatches = async () => {
  try {
    await AsyncStorage.multiRemove([LOST_ITEMS_KEY, FOUND_ITEMS_KEY, MATCHES_KEY]);
    return true;
  } catch (error) {
    console.error('Error clearing all items and matches:', error);
    return false;
  }
};

/**
 * Clear all claim requests from storage
 * @returns {Promise<boolean>} Success status
 */
export const clearClaimRequests = async () => {
  try {
    await AsyncStorage.removeItem(CLAIM_REQUESTS_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing claim requests:', error);
    return false;
  }
};

/**
 * Clear all notifications from storage
 * @returns {Promise<boolean>} Success status
 */
export const clearNotifications = async () => {
  try {
    await AsyncStorage.removeItem(NOTIFICATIONS_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return false;
  }
};

/**
 * Clear everything from storage (items, matches, claim requests, notifications)
 * @returns {Promise<boolean>} Success status
 */
export const clearEverything = async () => {
  try {
    await AsyncStorage.multiRemove([LOST_ITEMS_KEY, FOUND_ITEMS_KEY, MATCHES_KEY, CLAIM_REQUESTS_KEY, NOTIFICATIONS_KEY]);
    return true;
  } catch (error) {
    console.error('Error clearing everything:', error);
    return false;
  }
};