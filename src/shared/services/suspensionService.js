import { getUserByEmail } from '../../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

/**
 * Suspension Service - Handles real-time user suspension checking
 */

/**
 * Check if the current user is suspended
 * @param {string} userEmail - User's email address
 * @returns {Promise<Object>} Suspension status and details
 */
export const checkUserSuspension = async (userEmail) => {
  try {
    if (!userEmail) {
      return { isSuspended: false, message: null };
    }

    const user = await getUserByEmail(userEmail);
    
    if (!user) {
      return { isSuspended: false, message: null };
    }

    // Check if user is suspended
    if (user.status === 'Temporary Suspended' || user.status === 'Permanently Suspended') {
      const now = new Date();
      const suspendedUntil = user.suspended_until ? new Date(user.suspended_until) : null;
      
      // Check if temporary suspension has expired
      if (suspendedUntil && suspendedUntil <= now) {
        return { isSuspended: false, message: null, expired: true };
      }
      
      // Build suspension message based on status
      let suspensionMessage = 'Your account has been suspended.\n\n';
      
      if (user.status === 'Temporary Suspended') {
        // Temporary suspension
        if (suspendedUntil && suspendedUntil > now) {
          const timeRemaining = Math.ceil((suspendedUntil - now) / (1000 * 60 * 60 * 24)); // days
          suspensionMessage = `Your account is temporarily suspended until:\n${suspendedUntil.toLocaleDateString()}\n\n${timeRemaining} day(s) remaining.`;
        } else {
          suspensionMessage = 'Your account is temporarily suspended.\n\n';
        }
      } else if (user.status === 'Permanently Suspended') {
        // Permanent suspension
        suspensionMessage = 'Your account has been permanently suspended.\n\n';
      }
      
      // Add reason if available
      if (user.suspension_reason) {
        suspensionMessage += `Reason:\n${user.suspension_reason}\n\n`;
      }
      
      suspensionMessage += 'To reactivate your account, please click the appeal button below to contact support from the SSC Lost & Found Team.';
      
      return {
        isSuspended: true,
        message: suspensionMessage,
        suspendedUntil: suspendedUntil,
        reason: user.suspension_reason,
        suspendedBy: user.suspended_by,
        suspensionDate: user.suspension_date
      };
    }
    
    return { isSuspended: false, message: null };
  } catch (error) {
    console.error('Error checking user suspension:', error);
    return { isSuspended: false, message: null, error: error.message };
  }
};

/**
 * Handle user logout when suspended
 * @param {string} userEmail - User's email address
 * @returns {Promise<boolean>} Success status
 */
export const handleSuspensionLogout = async (userEmail) => {
  try {
    // Clear local storage
    await AsyncStorage.multiRemove([
      'user_data',
      'has_logged_in_before',
      'login_history'
    ]);
    
    // Sign out from Firebase and Google
    try {
      await auth().signOut();
      await GoogleSignin.signOut();
    } catch (signOutError) {
      console.error('Error during sign out:', signOutError);
      // Continue even if sign out fails
    }
    
    return true;
  } catch (error) {
    console.error('Error during suspension logout:', error);
    return false;
  }
};

/**
 * Create a suspension check middleware for screens
 * @param {Function} navigation - Navigation object
 * @param {Function} showAlert - Alert function to display suspension message
 * @returns {Function} Middleware function
 */
export const createSuspensionMiddleware = (navigation, showAlert) => {
  return async (userEmail) => {
    const suspensionStatus = await checkUserSuspension(userEmail);
    
    if (suspensionStatus.isSuspended) {
      // Show suspension message
      showAlert(
        'error',
        'Account Suspended',
        suspensionStatus.message,
        [{
          text: 'OK',
          onPress: async () => {
            // Logout and redirect to login
            await handleSuspensionLogout(userEmail);
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        }]
      );
      
      return true; // User is suspended
    }
    
    return false; // User is not suspended
  };
};

/**
 * Periodic suspension check for active sessions
 * @param {string} userEmail - User's email address
 * @param {Function} onSuspended - Callback when user is found to be suspended
 * @param {number} intervalMs - Check interval in milliseconds (default: 30 seconds)
 * @returns {Function} Cleanup function to stop the interval
 */
export const startPeriodicSuspensionCheck = (userEmail, onSuspended, intervalMs = 30000) => {
  const intervalId = setInterval(async () => {
    const suspensionStatus = await checkUserSuspension(userEmail);
    
    if (suspensionStatus.isSuspended) {
      clearInterval(intervalId);
      onSuspended(suspensionStatus);
    }
  }, intervalMs);
  
  // Return cleanup function
  return () => clearInterval(intervalId);
};