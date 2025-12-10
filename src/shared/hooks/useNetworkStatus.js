import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Hook to monitor network connectivity status
 * @returns {Object} - { isConnected, isInternetReachable, checkConnection }
 */
export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  /**
   * Manually check connection status
   * @returns {Promise<Object>} - Connection state
   */
  const checkConnection = async () => {
    const state = await NetInfo.fetch();
    setIsConnected(state.isConnected);
    setIsInternetReachable(state.isInternetReachable);
    return {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type
    };
  };

  return {
    isConnected,
    isInternetReachable,
    checkConnection,
    hasInternet: isConnected && isInternetReachable !== false
  };
};

export default useNetworkStatus;
