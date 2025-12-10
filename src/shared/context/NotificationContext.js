import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNotifications, getUserNotifications, initializeNotifications } from '../services/notificationService';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load notifications and count
  const loadNotifications = async () => {
    try {
      // Get current user's email
      const userData = await AsyncStorage.getItem('user_data');
      let notificationsList = [];
      
      if (userData) {
        const user = JSON.parse(userData);
        const userEmail = user.email;
        
        if (userEmail) {
          // Load user-specific notifications
          notificationsList = await getUserNotifications(userEmail) || [];
        } else {
          // Fallback to all notifications if no user email
          notificationsList = await getNotifications() || [];
        }
      } else {
        // Fallback to all notifications if no user data
        notificationsList = await getNotifications() || [];
      }
      
      setNotifications(notificationsList);
      const unread = notificationsList.filter(notification => !notification.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update unread count
  const updateUnreadCount = async () => {
    try {
      // Get current user's email
      const userData = await AsyncStorage.getItem('user_data');
      let notificationsList = [];
      
      if (userData) {
        const user = JSON.parse(userData);
        const userEmail = user.email;
        
        if (userEmail) {
          // Load user-specific notifications
          notificationsList = await getUserNotifications(userEmail) || [];
        } else {
          // Fallback to all notifications if no user email
          notificationsList = await getNotifications() || [];
        }
      } else {
        // Fallback to all notifications if no user data
        notificationsList = await getNotifications() || [];
      }
      
      const unread = notificationsList.filter(notification => !notification.read).length;
      setUnreadCount(unread);
      setNotifications(notificationsList);
    } catch (error) {
      console.error('Error updating unread count:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const { markNotificationAsRead } = require('../services/notificationService');
      await markNotificationAsRead(notificationId);
      await updateUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Clear all notifications
  const clearAll = async () => {
    try {
      const { clearAllNotifications } = require('../services/notificationService');
      const success = await clearAllNotifications();
      
      // Force update local state immediately regardless of API result
      setUnreadCount(0);
      setNotifications([]);
      
      return success;
    } catch (error) {
      // Still update UI even if there's an error
      setUnreadCount(0);
      setNotifications([]);
      return false;
    }
  };

  // Initialize notifications and set up listeners
  useEffect(() => {
    let notificationListener;
    let responseListener;
    let appStateListener;

    const setupNotifications = async () => {
      // Initialize notification system
      await initializeNotifications();
      
      // Load initial notifications
      await loadNotifications();

      // Listen for new notifications
      notificationListener = Notifications.addNotificationReceivedListener(async (notification) => {
        console.log('New notification received:', notification);
        // Update the notification count immediately
        await updateUnreadCount();
      });

      // Listen for notification responses (when user taps notification)
      responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
        console.log('Notification response received:', response);
        
        // Handle different notification types
        const notificationData = response.notification.request.content.data;
        console.log('Notification data:', notificationData);
        
        if (notificationData && notificationData.type === 'feedback_response') {
          // Navigate to feedback screen when user taps feedback response notification
          console.log('Handling feedback response notification tap');
          // Note: Navigation will be handled by the app's navigation system
          // The notification data contains feedbackId, responseId, and feedbackType
          // which can be used by the navigation handler
        }
        
        // Update the notification count when user interacts with notification
        await updateUnreadCount();
      });

      // Listen for app state changes to refresh notifications
      appStateListener = AppState.addEventListener('change', async (nextAppState) => {
        if (nextAppState === 'active') {
          // App became active, refresh notifications
          await updateUnreadCount();
        }
      });
    };

    setupNotifications();

    // Cleanup listeners
    return () => {
      if (notificationListener) {
        Notifications.removeNotificationSubscription(notificationListener);
      }
      if (responseListener) {
        Notifications.removeNotificationSubscription(responseListener);
      }
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, []);

  // Refresh notifications periodically when app is active
  useEffect(() => {
    let interval;
    
    const startPeriodicRefresh = () => {
      // Refresh every 3 seconds when app is active for near real-time updates
      interval = setInterval(async () => {
        if (AppState.currentState === 'active') {
          await updateUnreadCount();
        }
      }, 3000); // Changed from 30000ms (30s) to 3000ms (3s)
    };

    startPeriodicRefresh();

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  const value = {
    unreadCount,
    notifications,
    isLoading,
    loadNotifications,
    updateUnreadCount,
    markAsRead,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;