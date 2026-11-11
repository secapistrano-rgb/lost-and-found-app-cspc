import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, LogBox, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ExpoSplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeNotifications } from './src/shared/services/notificationService';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { SuspensionProvider } from './src/contexts/SuspensionContext';
import { InternetConnectionProvider } from './src/contexts/InternetConnectionContext';
import { getUserByEmail, updateUserStatus } from './src/config/apiConfig';

import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/components/common/layout/SplashScreen';
import ProfessionalAlert from './src/components/common/modals/ProfessionalAlert';
import useProfessionalAlert from './src/shared/hooks/useProfessionalAlert';
import NetworkMonitor from './src/shared/components/NetworkMonitor';

// Keep the native splash screen visible while we load the app
ExpoSplashScreen.preventAutoHideAsync();

// Firebase imports
import '@react-native-firebase/app';
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';

// Firebase configuration - this ensures Firebase is properly configured
const firebaseConfig = {
  apiKey: "",
  authDomain: "lost-and-found-31669.firebaseapp.com",
  projectId: "lost-and-found-31669",
  storageBucket: "lost-and-found-31669.firebasestorage.app",
  messagingSenderId: "539830824567",
  appId: "1:539830824567:android:2844dce4afb9a753ad6072"
};

// Ignore specific warnings
LogBox.ignoreLogs([
  'Asyncstorage has been extracted',
  'ViewPropTypes will be removed',
  'AsyncStorage has been extracted',
]);

export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  
  const { alertConfig, showError, hideAlert } = useProfessionalAlert();

  // Handle app state changes (background/foreground)
  useEffect(() => {
    let heartbeatInterval = null;

    const handleAppStateChange = async (nextAppState) => {
      console.log('App state changing from', appState.current, 'to', nextAppState);
      
      // When app goes to background or inactive
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        console.log('App has gone to the background or is closing');
        await setUserOfflineStatus();
        
        // Stop heartbeat when app goes to background
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
          console.log('Heartbeat stopped (app in background)');
        }
      }
      
      // When app comes to foreground
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground');
        await setUserOnlineStatus();
        
        // Start heartbeat when app comes to foreground
        heartbeatInterval = startHeartbeat();
      }

      appState.current = nextAppState;
      setAppStateVisible(appState.current);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Start heartbeat immediately if app is active
    if (AppState.currentState === 'active') {
      heartbeatInterval = startHeartbeat();
    }

    // Cleanup: Set user offline and stop heartbeat when component unmounts (app closes)
    return () => {
      subscription.remove();
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      setUserOfflineStatus();
    };
  }, []);

  // Send heartbeat to server every 2 minutes to keep user online
  const startHeartbeat = () => {
    console.log('Starting heartbeat...');
    
    // Send initial heartbeat
    sendHeartbeat();
    
    // Send heartbeat every 2 minutes
    const interval = setInterval(() => {
      sendHeartbeat();
    }, 2 * 60 * 1000); // Every 2 minutes
    
    return interval;
  };

  // Send heartbeat to server
  const sendHeartbeat = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const user = JSON.parse(userData);
        if (user && user.email) {
          const existingUser = await getUserByEmail(user.email);
          if (existingUser) {
            // Send heartbeat to server
            const response = await fetch(`https://api.lostfound.systems/api/users/${existingUser.id}/heartbeat`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            
            if (response.ok) {
              console.log('💓 Heartbeat sent successfully');
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  };

  // Set user status to Offline
  const setUserOfflineStatus = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const user = JSON.parse(userData);
        if (user && user.email) {
          console.log('Setting user status to Offline:', user.email);
          const existingUser = await getUserByEmail(user.email);
          if (existingUser) {
            await updateUserStatus(existingUser.id, 'Offline');
            console.log('User status set to Offline successfully');
          }
        }
      }
    } catch (error) {
      console.error('Error setting user offline status:', error);
    }
  };

  // Set user status to Online
  const setUserOnlineStatus = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const user = JSON.parse(userData);
        if (user && user.email) {
          console.log('Setting user status to Online:', user.email);
          const existingUser = await getUserByEmail(user.email);
          if (existingUser) {
            await updateUserStatus(existingUser.id, 'Online');
            console.log('User status set to Online successfully');
          }
        }
      }
    } catch (error) {
      console.error('Error setting user online status:', error);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize notifications when the app starts
        await initializeNotifications();
        
        // Initialize Firebase with explicit configuration
        await initializeFirebase();
      } finally {
        // Hide the native splash screen once we're ready to show our custom splash
        await ExpoSplashScreen.hideAsync();
      }
    };

    const initializeFirebase = async () => {
      try {
        if (!firebase.apps.length) {
          const app = firebase.initializeApp(firebaseConfig);
          console.log('Firebase initialized successfully with explicit config:', app.name);
          
          // Verify Firebase Auth is working
          const authInstance = auth();
          console.log('Firebase Auth initialized:', authInstance ? 'Yes' : 'No');
          
          // Enable persistence to improve the user experience
          await auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
          console.log('Firebase persistence enabled');
          
          // Mark app as ready
          setIsAppReady(true);
        } else {
          console.log('Firebase already initialized:', firebase.apps[0].name);
          setIsAppReady(true);
        }
      } catch (error) {
        console.error('Firebase initialization error:', error.message);
        showError(
          'Firebase Error',
          'There was a problem initializing Firebase. Please restart the app.'
        );
        setIsAppReady(true); // Still continue to app even if Firebase fails
      }
    };

    initialize();
  }, []);

  // Show splash screen until both Firebase is ready and splash animation completes
  if (!isSplashComplete) {
    return (
      <SplashScreen onAnimationComplete={() => setIsSplashComplete(true)} />
    );
  }

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar style="auto" />
      <InternetConnectionProvider>
        <NotificationProvider>
          <SuspensionProvider>
            <NetworkMonitor />
            <AppNavigator />
          </SuspensionProvider>
        </NotificationProvider>
      </InternetConnectionProvider>
      
      <ProfessionalAlert
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onDismiss={hideAlert}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
