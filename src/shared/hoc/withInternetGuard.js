import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import OfflineScreen from '../components/OfflineScreen';

/**
 * Higher-Order Component that blocks screen access when offline
 * Wraps any screen and shows OfflineScreen when no internet connection
 * 
 * Usage:
 * export default withInternetGuard(LoginScreen);
 */
export const withInternetGuard = (WrappedComponent, options = {}) => {
  const {
    checkInterval = 5000, // Check every 5 seconds when offline
    allowOfflineAccess = false, // Set to true to allow certain screens offline
  } = options;

  return (props) => {
    const [isConnected, setIsConnected] = useState(true);
    const [isChecking, setIsChecking] = useState(true);

    const checkConnection = async () => {
      try {
        const state = await NetInfo.fetch();
        const hasInternet = state.isConnected && state.isInternetReachable !== false;
        
        console.log('🌐 Internet Guard Check:', {
          screen: WrappedComponent.name,
          connected: state.isConnected,
          reachable: state.isInternetReachable,
          hasInternet,
        });
        
        setIsConnected(hasInternet);
        setIsChecking(false);
        
        return hasInternet;
      } catch (error) {
        console.error('❌ Error checking connection:', error);
        setIsConnected(false);
        setIsChecking(false);
        return false;
      }
    };

    useEffect(() => {
      // Initial check
      checkConnection();

      // Subscribe to network state updates
      const unsubscribe = NetInfo.addEventListener(state => {
        const hasInternet = state.isConnected && state.isInternetReachable !== false;
        setIsConnected(hasInternet);
      });

      // Periodic check when offline (in case connection restores)
      let intervalId;
      if (!isConnected && !allowOfflineAccess) {
        intervalId = setInterval(checkConnection, checkInterval);
      }

      return () => {
        unsubscribe();
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }, [isConnected, allowOfflineAccess]);

    // Show loading while checking initial connection
    if (isChecking) {
      return null; // Or a loading spinner if preferred
    }

    // Show offline screen if no connection and offline access not allowed
    if (!isConnected && !allowOfflineAccess) {
      return <OfflineScreen onRetry={checkConnection} />;
    }

    // Render the wrapped component
    return <WrappedComponent {...props} isConnected={isConnected} />;
  };
};

/**
 * Hook to manually check internet before actions
 * Returns a function that checks internet and shows alert if offline
 * 
 * Usage:
 * const checkInternet = useInternetGuard();
 * const hasInternet = await checkInternet('login');
 */
export const useInternetGuard = () => {
  const checkAndAlert = async (action = 'perform this action') => {
    try {
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
    } catch (error) {
      console.error('❌ Error checking internet:', error);
      return false;
    }
  };

  return checkAndAlert;
};

export default withInternetGuard;
