import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Switch, 
  TouchableOpacity, 
  ScrollView,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storeData, getData, getUser } from '../../../shared/storage/storage';
import { getUserSettings as getLocalUserSettings, saveUserSettings as saveLocalUserSettings, getDefaultUserSettings } from '../../../shared/storage/userStorage';
import { getUserSettings, updateUserSettings } from '../../../config/apiConfig';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';

import { handleUserLogout } from '../../auth/screens/LoginScreen';

const SettingsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const { alertConfig, showError, showSuccess, showConfirm, hideAlert } = useProfessionalAlert();
  const styles = createStyles();
  const [settings, setSettings] = useState({
    notifications: true,
    emailAlerts: true
  });

  useEffect(() => {
    loadSettings();
  }, []);



  const loadSettings = async () => {
    setLoading(true);
    try {
      // Get current user
      const user = await getUser();
      if (!user) {
        showError('Error', 'Please log in to access settings');
        return;
      }
      
      setCurrentUser(user);
      
      // Try to get user settings from MySQL API first
      try {
        const apiSettings = await getUserSettings(user.email);
        if (apiSettings) {
          setSettings(apiSettings);
          return;
        }
      } catch (apiError) {
        console.warn('API settings not available, falling back to local storage:', apiError);
      }
      
      // Fallback to local storage if API fails
      const localSettings = await getLocalUserSettings(user.email);
      if (localSettings) {
        setSettings(localSettings);
        // Try to sync local settings to API
        try {
          await updateUserSettings(user.email, localSettings);
          console.log('Local settings synced to API successfully');
        } catch (syncError) {
          console.warn('Failed to sync local settings to API:', syncError);
        }
      } else {
        // Use default settings
        const defaultSettings = getDefaultUserSettings();
        setSettings(defaultSettings);
        // Try to save default settings to API
        try {
          await updateUserSettings(user.email, defaultSettings);
        } catch (saveError) {
          console.warn('Failed to save default settings to API:', saveError);
          // Fallback to local storage
          await saveLocalUserSettings(user.email, defaultSettings);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showError('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      if (!currentUser) {
        showError('Error', 'Please log in to update settings');
        return;
      }
      
      const updatedSettings = { ...settings, [key]: value };
      setSettings(updatedSettings);
      
      // Try to save to MySQL API first
      try {
        await updateUserSettings(currentUser.email, updatedSettings);
        console.log('Settings saved to API successfully');
      } catch (apiError) {
        console.warn('Failed to save settings to API, falling back to local storage:', apiError);
        // Fallback to local storage
        await saveLocalUserSettings(currentUser.email, updatedSettings);
      }
      
      // Handle specific setting changes
      if (key === 'notifications') {
        await togglePushNotifications(value);
      } else if (key === 'emailAlerts') {
        await toggleEmailAlerts(value);
      }
      
      showSuccess('Success', `${key === 'notifications' ? 'Push notifications' : key === 'emailAlerts' ? 'Email alerts' : 'Setting'} ${value ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error saving setting:', error);
      showError('Error', 'Failed to save setting');
    }
  };

  // Toggle push notifications on/off
  const togglePushNotifications = async (enabled) => {
    try {
      if (!currentUser) {
        showError('Error', 'Please log in to update notification settings');
        return;
      }
      
      if (enabled) {
        // Request notification permissions and reinitialize when enabling
        const { requestNotificationPermissions, forceReinitializeNotifications } = require('../../../shared/services/notificationService');
        const permissionGranted = await requestNotificationPermissions();
        
        if (!permissionGranted) {
          showError('Permission Required', 'Please enable notification permissions in your device settings to receive push notifications.');
          // Revert the setting if permission denied
          const revertedSettings = { ...settings, notifications: false };
          setSettings(revertedSettings);
          try {
            await updateUserSettings(currentUser.email, revertedSettings);
          } catch (apiError) {
            console.warn('Failed to save reverted settings to API:', apiError);
            await saveLocalUserSettings(currentUser.email, revertedSettings);
          }
          return;
        }
        
        // Force reinitialization of the notification system
        console.log('Reinitializing notification system after enabling...');
        const reinitResult = await forceReinitializeNotifications();
        if (reinitResult) {
          console.log('Notification system reinitialized successfully');
        } else {
          console.warn('Failed to reinitialize notification system');
        }
      }
      
      // Store the user-specific notification preference
      await storeData(`push_notifications_enabled_${currentUser.email}`, enabled);
      console.log(`Push notifications ${enabled ? 'enabled' : 'disabled'} for user ${currentUser.email}`);
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      throw error;
    }
  };

  // Toggle email alerts on/off
  const toggleEmailAlerts = async (enabled) => {
    try {
      if (!currentUser) {
        showError('Error', 'Please log in to update email alert settings');
        return;
      }
      
      if (enabled) {
        // Reinitialize email alert service when enabling
        const { forceReinitializeEmailAlerts } = require('../../../shared/services/emailAlertService');
        
        console.log('Reinitializing email alert service after enabling...');
        const reinitResult = await forceReinitializeEmailAlerts();
        if (reinitResult) {
          console.log('Email alert service reinitialized successfully');
        } else {
          console.warn('Failed to reinitialize email alert service');
        }
      }
      
      // Store the user-specific email alert preference
      await storeData(`email_alerts_enabled_${currentUser.email}`, enabled);
      console.log(`Email alerts ${enabled ? 'enabled' : 'disabled'} for user ${currentUser.email}`);
    } catch (error) {
      console.error('Error toggling email alerts:', error);
      throw error;
    }
  };

  const clearAppData = async () => {
    showConfirm(
      'Clear All Data',
      'This will clear ALL your data including:\n\n• Cached local data\n• User session\n• All your reported items\n• All your matches\n• All your claims\n• All your notifications\n\nThis action CANNOT be undone. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear Everything', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              if (!currentUser) {
                showError('Error', 'No user logged in');
                return;
              }
              
              // Import API functions
              const { deleteUserData } = require('../../../config/apiConfig');
              
              // Delete all user data from database
              console.log('Deleting all user data from database...');
              await deleteUserData(currentUser.email);
              
              // Handle user logout (clears push token and sets status to Offline)
              await handleUserLogout(currentUser.email);
              
              // Clear all local storage
              await AsyncStorage.clear();
              
              showSuccess('Success', 'All your data has been permanently deleted');
              
              // Reset current user and settings
              setCurrentUser(null);
              const defaultSettings = getDefaultUserSettings();
              setSettings(defaultSettings);
              
              // Navigate back to login since all data is cleared
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Error clearing data:', error);
              showError('Error', 'Failed to clear all data: ' + error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3266a8" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#f8f9fa' }]}>
      <View style={[styles.header, { backgroundColor: '#fff', borderBottomColor: '#e0e0e0' }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: '#000' }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={[styles.scrollView, { backgroundColor: '#f8f9fa' }]}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#2c3e50' }]}>Notifications</Text>
          
          <View style={[styles.settingItem, { backgroundColor: '#fff' }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: '#2c3e50' }]}>Push Notifications</Text>
              <Text style={[styles.settingDescription, { color: '#666' }]}>
                Receive notifications about matches and updates
              </Text>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={(value) => updateSetting('notifications', value)}
              trackColor={{ false: '#e0e0e0', true: '#7ba7d9' }}
              thumbColor={settings.notifications ? '#3266a8' : '#ccc'}
            />
          </View>
          
          <View style={[styles.settingItem, { backgroundColor: '#fff' }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: '#2c3e50' }]}>Email Alerts</Text>
              <Text style={[styles.settingDescription, { color: '#666' }]}>
                Receive email notifications for important updates
              </Text>
            </View>
            <Switch
              value={settings.emailAlerts}
              onValueChange={(value) => updateSetting('emailAlerts', value)}
              trackColor={{ false: '#e0e0e0', true: '#7ba7d9' }}
              thumbColor={settings.emailAlerts ? '#3266a8' : '#ccc'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#2c3e50' }]}>Data Management</Text>
          <TouchableOpacity 
            style={[styles.settingItem, styles.dangerItem, { backgroundColor: '#fff' }]}
            onPress={clearAppData}
          >
            <View style={styles.settingContent}>
              <Ionicons name="trash-outline" size={24} color="#ff3b30" />
              <Text style={[styles.settingText, styles.dangerText]}>Clear Data</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ff3b30" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#2c3e50' }]}>About</Text>
          
          <View style={[styles.aboutItem, { backgroundColor: '#fff' }]}>
            <Text style={[styles.aboutLabel, { color: '#2c3e50' }]}>Version</Text>
            <Text style={[styles.aboutValue, { color: '#666' }]}>1.0.90</Text>
          </View>
          
          <View style={[styles.aboutItem, { backgroundColor: '#fff' }]}>
            <Text style={[styles.aboutLabel, { color: '#2c3e50' }]}>Build</Text>
            <Text style={[styles.aboutValue, { color: '#666' }]}>2025.03.06</Text>
          </View>
        </View>
      </ScrollView>
      
      <ProfessionalAlert
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onDismiss={hideAlert}
      />
    </SafeAreaView>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop:32,
    backgroundColor: '#3266a8',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },

  dangerItem: {
    borderColor: '#ff3b30',
  },
  dangerText: {
    color: '#ff3b30',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  aboutLabel: {
    fontSize: 16,
    color: '#2c3e50',
  },
  aboutValue: {
    fontSize: 16,
    color: '#666',
  },
});

// Wrap SettingsScreen with internet guard to block access when offline
export default withInternetGuard(SettingsScreen);
