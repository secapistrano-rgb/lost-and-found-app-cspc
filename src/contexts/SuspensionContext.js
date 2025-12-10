import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkUserSuspension, handleSuspensionLogout } from '../shared/services/suspensionService';
import { Alert, Linking } from 'react-native';

const SuspensionContext = createContext();

export const useSuspension = () => {
  const context = useContext(SuspensionContext);
  if (!context) {
    throw new Error('useSuspension must be used within a SuspensionProvider');
  }
  return context;
};

export const SuspensionProvider = ({ children }) => {
  const [userEmail, setUserEmail] = useState(null);
  const [navigationRef, setNavigationRef] = useState(null);
  const intervalRef = useRef(null);
  
  // Check every 3 seconds for testing
  const CHECK_INTERVAL = 3000;

  // Load user email from storage
  useEffect(() => {
    const loadUserEmail = async () => {
      try {
        const userData = await AsyncStorage.getItem('user_data');
        if (userData) {
          const user = JSON.parse(userData);
          setUserEmail(user.email);
        } else {
          setUserEmail(null);
        }
      } catch (error) {
        console.error('Error loading user email:', error);
      }
    };

    loadUserEmail();
  }, []);

  // Start checking when user is logged in
  useEffect(() => {
    if (userEmail) {
      startChecking();
    } else {
      stopChecking();
    }

    return () => {
      stopChecking();
    };
  }, [userEmail]);

  const startChecking = () => {
    stopChecking(); // Clear any existing interval
    
    intervalRef.current = setInterval(async () => {
      await checkSuspension();
    }, CHECK_INTERVAL);
    
    // Check immediately
    checkSuspension();
  };

  const stopChecking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const checkSuspension = async () => {
    if (!userEmail) {
      return;
    }

    try {
      const suspensionStatus = await checkUserSuspension(userEmail);
      
      if (suspensionStatus.isSuspended) {
        stopChecking();
        
        Alert.alert(
          'Account Suspended',
          suspensionStatus.message,
          [
            {
              text: 'Appeal',
              onPress: () => {
                const subject = 'Appeal for Account Unsuspension';
                const body = 'Dear Support Team,\n\nI would like to appeal the suspension of my account.\n\nAccount Email: ' + 
                            (userEmail || '') + 
                            '\n\nReason for Appeal:\n[Please describe your reason here]\n\nThank you for your consideration.';
                Linking.openURL(`mailto:lostfoundcspc@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
              }
            },
            {
              text: 'OK',
              onPress: async () => {
                try {
                  console.log('SuspensionContext: Starting logout process for user:', userEmail);
                  console.log('SuspensionContext: Navigation ref available:', navigationRef ? 'Yes' : 'No');
                  
                  // First handle the logout
                  const logoutResult = await handleSuspensionLogout(userEmail);
                  console.log('SuspensionContext: Logout result:', logoutResult);
                  
                  setUserEmail(null);
                  console.log('SuspensionContext: User email cleared');
                  
                  // Then navigate to login screen with improved fallback logic
                  const navigateToLogin = () => {
                    if (!navigationRef) {
                      console.error('SuspensionContext: Navigation reference is null');
                      return false;
                    }

                    // Try reset method first (preferred for logout)
                    if (typeof navigationRef.reset === 'function') {
                      try {
                        if (typeof navigationRef.isReady === 'function' && navigationRef.isReady()) {
                          console.log('SuspensionContext: Using navigation reset (ready)');
                          navigationRef.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                          });
                          return true;
                        } else {
                          console.log('SuspensionContext: Navigation not ready, trying reset anyway');
                          navigationRef.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                          });
                          return true;
                        }
                      } catch (error) {
                        console.error('SuspensionContext: Reset failed:', error);
                      }
                    }

                    // Fallback to navigate method
                    if (typeof navigationRef.navigate === 'function') {
                      try {
                        console.log('SuspensionContext: Using fallback navigation');
                        navigationRef.navigate('Login');
                        return true;
                      } catch (error) {
                        console.error('SuspensionContext: Navigate failed:', error);
                      }
                    }

                    console.error('SuspensionContext: No working navigation method available');
                    return false;
                  };

                  const navigationSuccess = navigateToLogin();
                  if (!navigationSuccess) {
                    console.error('SuspensionContext: All navigation methods failed');
                  }
                } catch (error) {
                  console.error('SuspensionContext: Error during suspension logout:', error);
                  // Force navigation even if logout fails
                  const forceNavigateToLogin = () => {
                    if (!navigationRef) {
                      console.error('SuspensionContext: Navigation reference is null during error handling');
                      return;
                    }

                    if (typeof navigationRef.reset === 'function') {
                      try {
                        console.log('SuspensionContext: Force navigation after error');
                        navigationRef.reset({
                          index: 0,
                          routes: [{ name: 'Login' }],
                        });
                      } catch (navError) {
                        console.error('SuspensionContext: Force navigation failed:', navError);
                      }
                    }
                  };

                  forceNavigateToLogin();
                }
              }
            }
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const updateUserEmail = (email) => {
    setUserEmail(email);
  };

  const setNavigation = (navRef) => {
    console.log('SuspensionContext: Setting navigation reference', navRef ? 'Success' : 'Failed');
    if (navRef) {
      console.log('SuspensionContext: Navigation ref methods available:', {
        isReady: typeof navRef.isReady === 'function',
        navigate: typeof navRef.navigate === 'function',
        reset: typeof navRef.reset === 'function'
      });
    }
    setNavigationRef(navRef);
  };

  const value = {
    userEmail,
    updateUserEmail,
    setNavigation,
    checkSuspension
  };

  return (
    <SuspensionContext.Provider value={value}>
      {children}
    </SuspensionContext.Provider>
  );
};

export default SuspensionProvider;