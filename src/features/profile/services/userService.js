import { getUser, saveUser } from '../../../shared/storage/storage';

/**
 * User Service - Handles user-related operations
 */

/**
 * Get the current user profile
 * @returns {Promise<Object|null>} User object or null if not found
 */
export const getCurrentUser = async () => {
  try {
    const user = await getUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Update user profile information
 * @param {Object} userData - User data to update
 * @returns {Promise<boolean>} Success status
 */
export const updateUserProfile = async (userData) => {
  try {
    // Get existing user data
    const currentUser = await getUser();
    
    // Merge with new data
    const updatedUser = {
      ...currentUser,
      ...userData,
      updatedAt: new Date().toISOString()
    };
    
    // Save updated user
    await saveUser(updatedUser);
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    return false;
  }
};

/**
 * Create a new user profile
 * @param {Object} userData - User data
 * @returns {Promise<Object|null>} Created user object or null if failed
 */
export const createUserProfile = async (userData) => {
  try {
    const newUser = {
      ...userData,
      createdAt: new Date().toISOString()
    };
    
    await saveUser(newUser);
    return newUser;
  } catch (error) {
    console.error('Error creating user profile:', error);
    return null;
  }
};

/**
 * Check if user exists
 * @returns {Promise<boolean>} True if user exists, false otherwise
 */
export const userExists = async () => {
  try {
    const user = await getUser();
    return !!user;
  } catch (error) {
    console.error('Error checking if user exists:', error);
    return false;
  }
};

/**
 * Get user's reported items (both lost and found)
 * @param {Array} lostItems - List of lost items
 * @param {Array} foundItems - List of found items
 * @returns {Array} Combined list of user's items
 */
export const getUserItems = (lostItems = [], foundItems = []) => {
  // In a real app with user authentication, we would filter by user ID
  // For now, we'll return all items as if they belong to the current user
  
  const formattedLostItems = lostItems.map(item => ({ ...item, type: 'lost' }));
  const formattedFoundItems = foundItems.map(item => ({ ...item, type: 'found' }));
  
  // Combine and sort by creation date (newest first)
  return [...formattedLostItems, ...formattedFoundItems]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};
