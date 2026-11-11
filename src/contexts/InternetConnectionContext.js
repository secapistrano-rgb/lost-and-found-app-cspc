import React, { createContext, useState, useEffect, useContext } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

// Create context
const InternetConnectionContext = createContext({
  isConnected: true,
  isInternetReachable: true,
  checkConnection: async () => true,
  requireInternet: async (action) => true,
});

/**
 * Internet Connection Provider
 * Monitors internet connection and provides status to all children
 */
export const InternetConnectionProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('🌐 Network state changed:', {
        connected: state.isConnected,
        reachable: state.isInternetReachable,
        type: state.type,
      });
      
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);
    });

    // Initial check
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Check current connection status
   */
  const checkConnection = async () => {
    const state = await NetInfo.fetch();
    const hasInternet = state.isConnected && state.isInternetReachable !== false;
    
    setIsConnected(state.isConnected ?? false);
    setIsInternetReachable(state.isInternetReachable ?? false);
    
    return hasInternet;
  };

  /**
   * Require internet connection with custom error message
   */
  const requireInternet = async (action = 'perform this action') => {
    const hasInternet = await checkConnection();
    
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

  const value = {
    isConnected,
    isInternetReachable,
    hasInternet: isConnected && isInternetReachable !== false,
    checkConnection,
    requireInternet,
  };

  return (
    <InternetConnectionContext.Provider value={value}>
      {children}
    </InternetConnectionContext.Provider>
  );
};

/**
 * Hook to access internet connection status
 */
export const useInternetConnection = () => {
  const context = useContext(InternetConnectionContext);
  
  if (!context) {
    throw new Error('useInternetConnection must be used within InternetConnectionProvider');
  }
  
  return context;
};

export default InternetConnectionContext;
