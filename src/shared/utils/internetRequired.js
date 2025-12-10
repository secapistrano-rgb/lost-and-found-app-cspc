import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/**
 * Check if internet connection is available
 * Shows alert if not connected
 * @param {string} action - Optional action description
 * @returns {Promise<boolean>} - True if connected, false otherwise
 */
export const requireInternet = async (action = 'this action') => {
  const state = await NetInfo.fetch();
  const hasInternet = state.isConnected && state.isInternetReachable !== false;
  
  if (!hasInternet) {
    Alert.alert(
      'No Internet Connection',
      `Internet connection is required to ${action}. Please check your connection and try again.`,
      [{ text: 'OK', style: 'cancel' }],
      { cancelable: false }
    );
    return false;
  }
  
  return true;
};

/**
 * Wrapper for async functions that require internet
 * Blocks execution if no internet connection
 * @param {Function} asyncFunction - Async function to execute
 * @param {string} action - Action description for error message
 * @returns {Promise<any>} - Result of the function or null if blocked
 */
export const withInternetRequired = async (asyncFunction, action = 'perform this action') => {
  const hasInternet = await requireInternet(action);
  
  if (!hasInternet) {
    return null;
  }
  
  return await asyncFunction();
};

/**
 * HOC (Higher Order Component) that blocks component actions when offline
 * @param {Function} Component - React component
 * @returns {Function} - Wrapped component with internet checking
 */
export const withInternetCheck = (Component) => {
  return (props) => {
    const checkAndExecute = async (callback, action = 'perform this action') => {
      const hasInternet = await requireInternet(action);
      if (hasInternet && callback) {
        callback();
      }
    };
    
    return <Component {...props} checkAndExecute={checkAndExecute} />;
  };
};

export default {
  requireInternet,
  withInternetRequired,
  withInternetCheck,
};
