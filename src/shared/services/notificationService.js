import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API_CONFIG } from '../../config/apiConfig';

// Storage key for notifications
const NOTIFICATIONS_KEY = 'notifications';

// API base URL from centralized config
const API_BASE_URL = `${API_CONFIG.BASE_URL}/api`;

// Initialize notifications
let isInitialized = false;

export const initializeNotifications = async () => {
  if (isInitialized) return true;
  
  try {
    // Set up notification handler FIRST
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        // Log for debugging
        console.log('Notification received:', notification.request.content.title);
        
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      },
    });

    // Set up channels for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('matches', {
        name: 'Item Matches',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#e74c3c',
        sound: 'default',
      });
    }

    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowDisplayInCarPlay: false,
        allowCriticalAlerts: false,
        allowProvisional: false,
        allowAnnouncements: false,
      },
      android: {},
    });
    
    if (status !== 'granted') {
      return false;
    }
    
    // Set up categories
    await setupNotificationCategories();
    
    isInitialized = true;
    return true;
  } catch (error) {
    return false;
  }
};

// Force reinitialize notifications (resets the isInitialized flag)
export const forceReinitializeNotifications = async () => {
  try {
    console.log('Force reinitializing notification system...');
    
    // Reset the initialization flag
    isInitialized = false;
    
    // Reinitialize the notification system
    const result = await initializeNotifications();
    
    if (result) {
      console.log('Notification system successfully reinitialized');
    } else {
      console.warn('Failed to reinitialize notification system');
    }
    
    return result;
  } catch (error) {
    console.error('Error force reinitializing notifications:', error);
    return false;
  }
};

// Set up notification categories and actions
const setupNotificationCategories = async () => {
  if (Platform.OS === 'ios') {
    await Notifications.setNotificationCategoryAsync('match', [
      { identifier: 'view', buttonTitle: 'View Match', options: { opensAppToForeground: true } },
    ]);
  }
};

/**
 * Request notification permissions and set up channels
 * @returns {Promise<boolean>} Whether permission was granted
 */
export const requestNotificationPermissions = async () => {
  try {
    // Request permissions with platform-specific settings
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowDisplayInCarPlay: false,
        allowCriticalAlerts: false,
        provideAppNotificationSettings: true,
        allowProvisional: true,
        allowAnnouncements: false,
      },
      android: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowVibrate: true,
      },
    });
    
    console.log(`📱 Notification permission status: ${status}`);
    
    if (status !== 'granted') {
      return false;
    }
    
    // Configure badge count on app icon
    if (status === 'granted') {
      // Reset badge count when app opens
      try {
        await Notifications.setBadgeCountAsync(0);
      } catch (badgeError) {
        console.log('Could not reset badge count:', badgeError.message);
      }
    }
    
    return status === 'granted';
  } catch (error) {
    return false;
  }
};

/**
 * Schedule a local notification
 * @param {Object} notification - Notification content
 * @returns {Promise<string>} Notification identifier
 */
export const scheduleNotification = async (notification) => {
  try {
    const { title, body, data = {}, trigger = null, channelId = 'default', badge = null } = notification;
    
    // Update badge count if provided
    if (badge !== null) {
      try {
        await Notifications.setBadgeCountAsync(badge);
      } catch (badgeError) {
        console.log('Could not update badge count:', badgeError.message);
      }
    }
    
    // Determine priority and visual settings based on notification type
    const isMatchNotification = data.type === 'match' || channelId === 'matches';
    const priority = isMatchNotification ? 'max' : 'high';
    const color = isMatchNotification ? '#e74c3c' : '#3498db'; // Red for matches, blue for others
    
    // Schedule the notification with enhanced configuration
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        badge,
        sound: isMatchNotification ? 'default' : true, // Use default sound for matches
        priority: isMatchNotification ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.HIGH,
        color,
        // For iOS
        categoryIdentifier: data.type || 'default',
        interruptionLevel: isMatchNotification ? 'timeSensitive' : 'active', // iOS 15+ time-sensitive for matches
        relevanceScore: isMatchNotification ? 1.0 : 0.5, // iOS relevance score for better visibility
        // For Android
        channelId,
        sticky: isMatchNotification, // Make match notifications sticky on Android
        autoDismiss: !isMatchNotification, // Don't auto-dismiss match notifications
        vibrate: isMatchNotification ? [0, 300, 150, 300] : [0, 250, 250, 250],
      },
      trigger,
    });
    
    if (notificationId) {
      console.log(`📱 Notification scheduled with ID: ${notificationId} (type: ${data.type || 'default'}, channel: ${channelId})`);
    }
    
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

/**
 * Test notification function - sends immediately like login notification
 */
export const sendTestNotification = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test Match Found! 🎯",
        body: "This is a test match notification to verify the system works!",
        sound: 'default',
      },
      trigger: null,
    });
    
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Test match notification specifically - bypasses all matching logic
 */
export const sendTestMatchNotification = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }

    // Send notification using exact same structure as sendMatchNotification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Match Found! (85% match)",
        body: "We found a potential match for your lost wallet!",
        data: { 
          type: 'match', 
          matchId: 'test-match-123',
          lostItemId: 'test-lost-456',
          foundItemId: 'test-found-789',
          score: 85
        },
        badge: 1,
        sound: 'default',
      },
      trigger: null,
    });
    
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Send a match notification with immediate push notification
 * @param {Object} match - Match data
 * @param {Object} user - Current user data
 * @returns {Promise<string>} Notification identifier
 */
export const sendMatchNotification = async (match, user = null) => {
  try {
    console.log('=== SENDING MATCH NOTIFICATION ===');
    console.log('Match:', match);
    console.log('User:', user);
    
    // Simple permission check
    const { status } = await Notifications.getPermissionsAsync();
    console.log('Permission status:', status);
    
    if (status !== 'granted') {
      console.log('❌ No notification permission');
      return null;
    }

    const { lostItem, foundItem, score } = match;
    const scorePercent = Math.round(score * 100);
    
    // Get current notifications to update badge count
    const notifications = await getNotifications() || [];
    const unreadCount = notifications.filter(notification => !notification.read).length + 1;
    
    // Customize notification based on user context
    let title, body;
    if (user && lostItem.reporterId === user.email) {
      title = `Suggested Match Found for Your Lost Item (${scorePercent}%)`;
      body = `We found a potential match for your lost ${lostItem.title || 'item'}!`;
    } else if (user && foundItem.reporterId === user.email) {
      title = `Suggested Match Found for Your Found Item (${scorePercent}%)`;
      body = `Your found item may belong to someone who reported it lost!`;
    } else {
      title = `Suggested Match Found (${scorePercent}%)`;
      body = `We found a potential match for ${lostItem.title || 'an item'}!`;
    }
    
    console.log('Notification title:', title);
    console.log('Notification body:', body);
    
    // Send notification using the exact same pattern as login notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { 
          type: 'match', 
          matchId: match.id,
          lostItemId: lostItem.id,
          foundItemId: foundItem.id,
          score: scorePercent
        },
        badge: unreadCount,
        sound: 'default',
      },
      trigger: null, // Send immediately
    });
    
    console.log('✅ Match notification sent with ID:', notificationId);
    
    // Always save to notification storage for in-app display
    const localNotificationId = notificationId || `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await saveNotification({
      id: localNotificationId,
      type: 'match',
      title,
      message: body,
      data: { 
        type: 'match', 
        matchId: match.id,
        lostItemId: lostItem.id,
        foundItemId: foundItem.id,
        score: scorePercent,
        timestamp: new Date().toISOString()
      },
      read: false,
      timestamp: new Date().toISOString()
    });
    
    return notificationId;
    
  } catch (error) {
    return null;
  }
};

/**
 * Send a claim notification
 * @param {Object} item - Item being claimed
 * @returns {Promise<string>} Notification identifier
 */
export const sendClaimNotification = async (item) => {
  try {
    const notificationId = await scheduleNotification({
      title: 'Item Claimed',
      body: `Someone has claimed the item: ${item.title}`,
      data: { type: 'claim', itemId: item.id },
    });
    
    // Save notification to storage
    await saveNotification({
      id: notificationId,
      type: 'claim',
      title: 'Item Claimed',
      message: `Someone has claimed the item: ${item.title}`,
      data: { type: 'claim', itemId: item.id },
    });
    
    return notificationId;
  } catch (error) {
    console.error('Error sending claim notification:', error);
    return null;
  }
};

/**
 * DEPRECATED: Claim notifications are now handled by database triggers
 * See: create_claim_notification_triggers.sql
 * The trigger automatically creates notifications when claim status changes
 * This function is kept for backward compatibility but is no longer used
 */
export const sendClaimRequestStatusNotification = async (claimRequest, status) => {
  console.log('⚠️ DEPRECATED: Claim notifications are now handled by database triggers');
  console.log('This function should not be called. Please remove calls to sendClaimRequestStatusNotification');
  return null;
};

/**
 * Send an email alert notification when verification code is sent
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} email - User's email address
 * @returns {Promise<string>} Notification identifier
 */
export const sendEmailAlertNotification = async (title, message, email) => {
  try {
    console.log('Sending user-specific email alert notification for:', email);
    
    // Extract user name from email for personalization
    const userName = email.split('@')[0];
    const personalizedMessage = message.replace(/for \w+/, `for ${userName}`);
    
    // Generate unique notification ID
    const notificationId = `email_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Save to notification storage for in-app display (user-specific notification)
    await saveNotification({
      id: notificationId,
      type: 'email_alert',
      title,
      message: personalizedMessage,
      data: { 
        type: 'email_alert',
        email: email,
        action: 'open_gmail',
        userSpecific: true
      },
      read: false,
      createdAt: new Date().toISOString(),
      userEmail: email // Associate notification with specific user
    });
    
    console.log('User-specific email alert notification saved successfully with ID:', notificationId);
    
    // Optional: Send a subtle in-app notification (not system push notification)
    // This will only show when the user is actively using the app
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: personalizedMessage,
          data: { 
            type: 'email_alert',
            email: email,
            action: 'open_gmail',
            userSpecific: true
          },
          sound: false, // No sound for user-specific notifications
          priority: 'normal',
          color: '#3266a8',
        },
        trigger: null, // Send immediately but quietly
      });
    } catch (pushError) {
      console.log('Push notification failed, but user notification saved:', pushError.message);
    }
    
    return notificationId;
  } catch (error) {
    console.error('Error sending email alert notification:', error);
    return null;
  }
};

/**
 * Send a profile update notification
 * @returns {Promise<string>} Notification identifier
 */
export const sendProfileUpdateNotification = async () => {
  return await scheduleNotification({
    title: 'Profile Updated',
    body: 'Your profile information has been successfully updated.',
    data: { type: 'profile_update' },
  });
};

/**
 * Send a settings update notification
 * @returns {Promise<string>} Notification identifier
 */
export const sendSettingsUpdateNotification = async () => {
  try {
    // Check if push notifications are enabled
    const { isPushNotificationsEnabled } = require('../utils/settingsUtils');
    const pushEnabled = await isPushNotificationsEnabled();
    
    if (!pushEnabled) {
      console.log('Push notifications disabled, skipping settings update notification');
      return null;
    }
    
    return await scheduleNotification({
      title: 'Settings Updated',
      body: 'Your app settings have been successfully updated.',
      data: { type: 'settings_update' },
    });
  } catch (error) {
    console.error('Error sending settings update notification:', error);
    return null;
  }
};

/**
 * Send a feedback response notification when admin responds to user feedback
 * @param {Object} feedbackData - Original feedback data
 * @param {Object} responseData - Admin response data
 * @returns {Promise<string>} Notification identifier
 */
export const sendFeedbackResponseNotification = async (feedbackData, responseData) => {
  try {
    console.log('=== FEEDBACK RESPONSE NOTIFICATION DEBUG ===');
    console.log('Feedback data:', feedbackData);
    console.log('Response data:', responseData);
    console.log('Current time:', new Date().toISOString());
    
    const title = 'Admin Response Received 💬';
    const body = `An admin has responded to your ${feedbackData.type} feedback. Tap to view the response.`;
    
    console.log('Notification title:', title);
    console.log('Notification body:', body);
    
    let notificationId = null;
    
    // Send immediate push notification (like claim notifications)
    console.log('Scheduling feedback response notification...');
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { 
          type: 'feedback_response', 
          feedbackId: feedbackData.id,
          responseId: responseData.id,
          feedbackType: feedbackData.type
        },
        sound: true,
        priority: 'high',
        color: '#3498db',
      },
      trigger: null, // Send immediately
    });
    console.log('Feedback response notification scheduled successfully with ID:', notificationId);
    
    // Always save to notification storage for in-app display
    const savedNotification = {
      id: notificationId || `feedback_response_${Date.now()}`,
      type: 'feedback_response',
      title,
      message: body,
      data: { 
        type: 'feedback_response', 
        feedbackId: feedbackData.id,
        responseId: responseData.id,
        feedbackType: feedbackData.type
      },
      read: false,
      createdAt: new Date().toISOString()
    };
    
    console.log('Saving notification to storage:', savedNotification);
    await saveNotification(savedNotification);
    console.log('Notification saved to storage successfully');
    
    console.log('=== END FEEDBACK RESPONSE NOTIFICATION DEBUG ===');
    return notificationId;
  } catch (error) {
    console.error('Error sending feedback response notification:', error);
    console.error('Error stack:', error.stack);
    return null;
  }
};

/**
 * Send a support ticket notification
 * @param {Object} ticketData - Support ticket data
 * @param {string} action - Action performed (created, updated, resolved)
 * @param {Object} user - User object (optional)
 * @returns {Promise<string>} Notification identifier
 */
export const sendSupportTicketNotification = async (ticketData, action = 'created', user = null) => {
  try {
    console.log('=== SENDING SUPPORT TICKET NOTIFICATION ===');
    console.log('Ticket data:', ticketData);
    console.log('Action:', action);
    console.log('User:', user);

    // Check notification permissions
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('❌ No notification permission for support ticket');
      return null;
    }

    // Create notification content based on action
    let title, body;
    
    switch (action) {
      case 'created':
        title = 'Support Ticket Created';
        body = `Your support ticket "${ticketData.subject || 'Issue'}" has been submitted successfully.`;
        break;
      case 'updated':
        title = 'Support Ticket Updated';
        body = `Your support ticket "${ticketData.subject || 'Issue'}" has been updated.`;
        break;
      case 'resolved':
        title = 'Support Ticket Resolved';
        body = `Your support ticket "${ticketData.subject || 'Issue'}" has been resolved.`;
        break;
      case 'response':
        title = 'Support Response Received';
        body = `You have received a response to your support ticket "${ticketData.subject || 'Issue'}".`;
        break;
      default:
        title = 'Support Ticket Notification';
        body = `Your support ticket "${ticketData.subject || 'Issue'}" status has changed.`;
    }

    console.log('Scheduling support ticket notification...');
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { 
          type: 'support_ticket', 
          ticketId: ticketData.id,
          action: action,
          subject: ticketData.subject,
          status: ticketData.status
        },
        sound: true,
        priority: action === 'created' ? 'high' : 'normal',
        color: action === 'resolved' ? '#28a745' : '#3498db',
      },
      trigger: null, // Send immediately
    });
    
    console.log('✅ Support ticket notification sent with ID:', notificationId);

    // Save notification to storage
    const savedNotification = {
      id: notificationId || `support_ticket_${Date.now()}`,
      type: 'support_ticket',
      title,
      message: body,
      data: { 
        type: 'support_ticket', 
        ticketId: ticketData.id,
        action: action,
        subject: ticketData.subject,
        status: ticketData.status
      },
      read: false,
      createdAt: new Date().toISOString()
    };
    
    await saveNotification(savedNotification);
    console.log('Support ticket notification saved to storage successfully');
    
    console.log('=== END SUPPORT TICKET NOTIFICATION DEBUG ===');
    return notificationId;
  } catch (error) {
    console.error('Error sending support ticket notification:', error);
    console.error('Error stack:', error.stack);
    return null;
  }
};

/**
 * Send a general feedback notification (for feedback creation, not responses)
 * @param {Object} feedbackData - Feedback data
 * @param {string} action - Action performed (submitted, under_review, processed)
 * @param {Object} user - User object (optional)
 * @returns {Promise<string>} Notification identifier
 */
export const sendFeedbackNotification = async (feedbackData, action = 'submitted', user = null) => {
  try {
    console.log('=== SENDING FEEDBACK NOTIFICATION ===');
    console.log('Feedback data:', feedbackData);
    console.log('Action:', action);
    console.log('User:', user);

    // Check notification permissions
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('❌ No notification permission for feedback');
      return null;
    }

    // Create notification content based on action
    let title, body;
    
    switch (action) {
      case 'submitted':
        title = 'Feedback Submitted';
        body = `Your feedback "${feedbackData.subject || feedbackData.type || 'feedback'}" has been submitted successfully.`;
        break;
      case 'under_review':
        title = 'Feedback Under Review';
        body = `Your feedback "${feedbackData.subject || feedbackData.type || 'feedback'}" is now under review.`;
        break;
      case 'processed':
        title = 'Feedback Processed';
        body = `Your feedback "${feedbackData.subject || feedbackData.type || 'feedback'}" has been processed.`;
        break;
      default:
        title = 'Feedback Notification';
        body = `Your feedback "${feedbackData.subject || feedbackData.type || 'feedback'}" status has changed.`;
    }

    console.log('Scheduling feedback notification...');
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { 
          type: 'feedback', 
          feedbackId: feedbackData.id,
          action: action,
          feedbackType: feedbackData.type,
          subject: feedbackData.subject
        },
        sound: true,
        priority: 'normal',
        color: '#9b59b6',
      },
      trigger: null, // Send immediately
    });
    
    console.log('✅ Feedback notification sent with ID:', notificationId);

    // Save notification to storage
    const savedNotification = {
      id: notificationId || `feedback_${Date.now()}`,
      type: 'feedback',
      title,
      message: body,
      data: { 
        type: 'feedback', 
        feedbackId: feedbackData.id,
        action: action,
        feedbackType: feedbackData.type,
        subject: feedbackData.subject
      },
      read: false,
      createdAt: new Date().toISOString()
    };
    
    await saveNotification(savedNotification);
    console.log('Feedback notification saved to storage successfully');
    
    console.log('=== END FEEDBACK NOTIFICATION DEBUG ===');
    return notificationId;
  } catch (error) {
    console.error('Error sending feedback notification:', error);
    console.error('Error stack:', error.stack);
    return null;
  }
};

/**
 * Save notification to storage
 * @param {Object} notification - Notification data
 * @returns {Promise<boolean>} Success status
 */
export const saveNotification = async (notification) => {
  try {
    // Generate ID if not provided
    const notificationWithId = {
      ...notification,
      id: notification.id || `notification_${Date.now()}`,
      createdAt: notification.createdAt || new Date().toISOString(),
      read: notification.read || false
    };
    
    // Get existing notifications from local storage only (faster than getNotifications)
    const localData = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    const existingNotifications = localData ? JSON.parse(localData) : [];
    
    // Add new notification
    const updatedNotifications = [notificationWithId, ...existingNotifications];
    
    // Save to storage
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications));
    
    // Update badge count (simplified - just increment by 1)
    try {
      const currentBadge = await Notifications.getBadgeCountAsync();
      await Notifications.setBadgeCountAsync((currentBadge || 0) + 1);
    } catch (badgeError) {
      console.log('Could not update badge count:', badgeError.message);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving notification:', error);
    return false;
  }
};

/**
 * Get all notifications
 * @returns {Promise<Array>} List of notifications
 */
export const getNotifications = async () => {
  try {
    // Always check local storage first
    const localData = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    const localNotifications = localData ? JSON.parse(localData) : [];
    
    // If local storage is empty, return empty array (respects clearing)
    if (localNotifications.length === 0) {
      return [];
    }
    
    // Only try backend if local storage has notifications
  const userData = await AsyncStorage.getItem('user_data');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.email) {
        try {
          const response = await fetch(`${API_BASE_URL}/notifications/user/${encodeURIComponent(user.email)}`);
          if (response.ok) {
            const backendNotifications = await response.json();
            const normalizedNotifications = backendNotifications.map(notification => ({
              ...notification,
              createdAt: notification.created_at || notification.createdAt
            }));
            
            // Update local storage with backend data
            await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(normalizedNotifications));
            return normalizedNotifications;
          }
        } catch (apiError) {
          // If API fails, return local notifications
          return localNotifications;
        }
      }
    }
    
    // Fallback to local storage
    return localNotifications;
  } catch (error) {
    // Always fallback to empty array on error
    return [];
  }
};

/**
 * Get notifications for a specific user
 * @param {string} userEmail - User's email address
 * @returns {Promise<Array>} List of user-specific notifications
 */
export const getUserNotifications = async (userEmail) => {
  try {
    if (userEmail) {
      // Fetch from backend API
      const response = await fetch(`${API_BASE_URL}/notifications/user/${encodeURIComponent(userEmail)}`);
      if (response.ok) {
        const notifications = await response.json();
        // Normalize date field from API (created_at -> createdAt)
        const normalizedNotifications = notifications.map(notification => ({
          ...notification,
          createdAt: notification.created_at || notification.createdAt
        }));
        return normalizedNotifications;
      }
    }
    
    // Fallback to local storage filtering
    const allNotifications = await getNotifications();
    
    // Filter notifications for the specific user
    const userNotifications = allNotifications.filter(notification => {
      // Include notifications that are:
      // 1. Specifically assigned to this user (userEmail field)
      // 2. Email alert notifications for this user
      // 3. Match notifications involving this user's items
      // 4. General notifications (no specific user)
      
      if (notification.userEmail === userEmail) {
        return true;
      }
      
      if (notification.type === 'email_alert' && notification.data?.email === userEmail) {
        return true;
      }
      
      if (notification.type === 'match' && notification.data) {
        // Check if this match involves the user's items
        // This would need to be enhanced based on your match data structure
        return true;
      }
      
      // Include general notifications that don't have a specific user
      if (!notification.userEmail && !notification.data?.email) {
        return true;
      }
      
      return false;
    });
    
    // Sort by creation date (newest first)
    return userNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
};

/**
 * Mark a notification as read
 * @param {string} notificationId - ID of the notification
 * @returns {Promise<boolean>} Success status
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    // Try to update via backend API
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      // Update badge count
      try {
        const userData = await AsyncStorage.getItem('user_data');
        if (userData) {
          const user = JSON.parse(userData);
          if (user.email) {
            const countResponse = await fetch(`${API_BASE_URL}/notifications/user/${encodeURIComponent(user.email)}/count`);
            if (countResponse.ok) {
              const { unreadCount } = await countResponse.json();
              await Notifications.setBadgeCountAsync(unreadCount);
            }
          }
        }
      } catch (badgeError) {
        console.log('Could not update badge count:', badgeError.message);
        // Continue even if badge update fails
      }
      return true;
    }
    
    // Fallback to local storage
    const notifications = await getNotifications() || [];
    
    // Find and update the notification
    const updatedNotifications = notifications.map(notification => {
      if (notification.id === notificationId) {
        return { ...notification, read: true };
      }
      return notification;
    });
    
    // Save to storage
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications));
    
    // Update badge count
    try {
      const unreadCount = updatedNotifications.filter(n => !n.read).length;
      await Notifications.setBadgeCountAsync(unreadCount);
    } catch (badgeError) {
      console.log('Could not update badge count:', badgeError.message);
      // Continue even if badge update fails
    }
    
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - ID of the notification
 * @returns {Promise<boolean>} Success status
 */
export const deleteNotification = async (notificationId) => {
  try {
    // Try to delete via backend API
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      return true;
    }
    
    // Fallback to local storage
    const notifications = await getNotifications() || [];
    const filteredNotifications = notifications.filter(
      notification => notification.id !== notificationId
    );
    
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filteredNotifications));
    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
};

/**
 * Clear all notifications
 * @returns {Promise<boolean>} Success status
 */
export const clearAllNotifications = async () => {
  try {
    // Clear local storage first (immediate UI update)
    await AsyncStorage.removeItem(NOTIFICATIONS_KEY);
    
    // Clear badge count
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (badgeError) {
      console.log('Could not clear badge count:', badgeError.message);
    }
    
    // Clear all displayed notifications from notification center
    await Notifications.dismissAllNotificationsAsync();
    
    // Clear backend API synchronously
    const userData = await AsyncStorage.getItem('user_data');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.email) {
        try {
          await fetch(`${API_BASE_URL}/notifications/user/${encodeURIComponent(user.email)}`, {
            method: 'DELETE',
          });
        } catch (apiError) {
          // Ignore API errors, local clear is what matters for UI
        }
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Register for push notification token
 * @returns {Promise<string|null>} Push token or null if failed
 */
export const registerForPushNotificationsAsync = async () => {
  try {
    // Check if permission is granted
    const permissionGranted = await requestNotificationPermissions();
    if (!permissionGranted) {
      return null;
    }
    
    // Get Expo push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'lost-and-found-app',
    });
    
    return token.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
};