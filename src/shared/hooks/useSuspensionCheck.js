import { useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkUserSuspension, handleSuspensionLogout } from '../services/suspensionService';
import { Alert, Linking } from 'react-native';

/**
 * Custom hook for checking user suspension status
 * @param {Object} navigation - Navigation object
 * @param {Object} options - Configuration options
 * @param {boolean} options.checkOnFocus - Check suspension when screen comes into focus
 * @param {boolean} options.checkOnMount - Check suspension when component mounts
 * @param {number} options.intervalMs - Interval for periodic checks (0 to disable)
 * @param {Function} options.onSuspended - Custom callback when user is suspended
 * @returns {Object} Suspension check utilities
 */
export const useSuspensionCheck = (navigation, options = {}) => {
  const {
    checkOnFocus = true,
    checkOnMount = true,
    intervalMs = 0, // Disabled by default to avoid conflicts with context
    onSuspended = null
  } = options;

  const intervalRef = useRef(null);
  const isCheckingRef = useRef(false);

  // Check suspension status
  const checkSuspension = useCallback(async () => {
    if (isCheckingRef.current) {
      return false;
    }

    isCheckingRef.current = true;

    try {
      // Get user email from storage
      const userData = await AsyncStorage.getItem('user_data');
      if (!userData) {
        return false;
      }

      const user = JSON.parse(userData);
      const userEmail = user.email;

      if (!userEmail) {
        return false;
      }

      const suspensionStatus = await checkUserSuspension(userEmail);
      
      if (suspensionStatus.isSuspended) {
        // Stop any periodic checking
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Call custom callback if provided
        if (onSuspended) {
          onSuspended(suspensionStatus);
          return true;
        }

        // Default suspension handling
        Alert.alert(
          'Account Suspended',
          suspensionStatus.message,
          [
            {
              text: 'Appeal',
              onPress: () => {
                const subject = 'Appeal for Account Unsuspension';
                const body = 'Dear Support Team,\\n\\nI would like to appeal the suspension of my account.\\n\\nAccount Email: ' + 
                            (userEmail || '') + 
                            '\\n\\nReason for Appeal:\\n[Please describe your reason here]\\n\\nThank you for your consideration.';
                Linking.openURL(`mailto:lostfoundcspc@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
              }
            },
            {
              text: 'OK',
              onPress: async () => {
                await handleSuspensionLogout(userEmail);
                // Reset navigation to login screen
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }
            }
          ],
          { cancelable: false }
        );

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error in suspension check:', error);
      return false;
    } finally {
      isCheckingRef.current = false;
    }
  }, [navigation, onSuspended]);

  // Start periodic checking
  const startPeriodicCheck = useCallback(() => {
    if (intervalMs <= 0) {
      return;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Start new interval
    intervalRef.current = setInterval(checkSuspension, intervalMs);
  }, [checkSuspension, intervalMs]);

  // Stop periodic checking
  const stopPeriodicCheck = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Check on component mount
  useEffect(() => {
    if (checkOnMount) {
      checkSuspension();
    }

    if (intervalMs > 0) {
      startPeriodicCheck();
    }

    // Cleanup on unmount
    return () => {
      stopPeriodicCheck();
    };
  }, [checkOnMount, checkSuspension, startPeriodicCheck, stopPeriodicCheck, intervalMs]);

  // Check when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (checkOnFocus) {
        checkSuspension();
      }
    }, [checkOnFocus, checkSuspension])
  );

  return {
    checkSuspension,
    startPeriodicCheck,
    stopPeriodicCheck,
    isChecking: isCheckingRef.current
  };
};

/**
 * Simplified hook for basic suspension checking
 * @param {Object} navigation - Navigation object
 * @returns {Function} Check suspension function
 */
export const useBasicSuspensionCheck = (navigation) => {
  const { checkSuspension } = useSuspensionCheck(navigation, {
    checkOnFocus: true,
    checkOnMount: true,
    intervalMs: 0
  });

  return checkSuspension;
};

/**
 * Hook for screens that need real-time suspension monitoring
 * @param {Object} navigation - Navigation object
 * @param {number} intervalMs - Check interval in milliseconds (default: 30 seconds)
 * @returns {Object} Suspension check utilities
 */
export const useRealtimeSuspensionCheck = (navigation, intervalMs = 30000) => {
  return useSuspensionCheck(navigation, {
    checkOnFocus: true,
    checkOnMount: true,
    intervalMs
  });
};

export default useSuspensionCheck;