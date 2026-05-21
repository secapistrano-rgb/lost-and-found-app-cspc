import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  ImageBackground,
  Switch
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';
import { getUser, saveUser } from '../../../shared/storage/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import { handleUserLogout } from '../../auth/screens/LoginScreen';
import { getUserByEmail, updateUser, updateUserStatus } from '../../../config/apiConfig';
import { API_CONFIG, getApiUrl } from '../../../config/apiConfig';
import { checkAndUpdateAchievements } from '../../../shared/utils/achievementSystem';
import { clearUserData } from '../../../shared/storage/userStorage';

const { width, height } = Dimensions.get('window');

// Scale factor calculation optimized for high-resolution screens
const isHighResolution = width >= 1080;
const scaleFactor = isHighResolution ? (width / 600) : (width / 375);

const scaleSize = (size) => Math.round(size * scaleFactor);

const UserProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteButton, setShowDeleteButton] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const [fakeReportCount, setFakeReportCount] = useState(0);
  const [editedUser, setEditedUser] = useState({
    name: '',
    email: '',
    department: '',
    profileImage: null,
    twoFactorEnabled: false
  });
  
  const { alertConfig, showError, showSuccess, showConfirm, hideAlert } = useProfessionalAlert();
  const styles = createStyles(insets);

  useEffect(() => {
    loadUserData();
  }, []);

  // Fetch fake report count
  const fetchFakeReportCount = async (email) => {
    try {
      const response = await fetch(getApiUrl(`/api/users/email/${encodeURIComponent(email)}/fake-reports`));
      if (response.ok) {
        const data = await response.json();
        setFakeReportCount(data.fake_report_count || 0);
      }
    } catch (error) {
      console.error('Error fetching fake report count:', error);
      setFakeReportCount(0);
    }
  };

  const loadUserData = async () => {
    setLoading(true);
    try {
      const userData = await getUser();
      if (userData) {
        // Defensive migration: ensure department and address are always strings
        let migratedUser = {
          ...userData,
          department: userData.department !== undefined && userData.department !== null ? String(userData.department) : '',
        };
        
        // If twoFactorEnabled is not set, try to get it from database
        if (migratedUser.twoFactorEnabled === undefined && migratedUser.email) {
          try {
            const existingUser = await getUserByEmail(migratedUser.email);
            if (existingUser && existingUser.two_factor_enabled !== undefined) {
              migratedUser.twoFactorEnabled = existingUser.two_factor_enabled === 'Enabled' || 
                                           existingUser.two_factor_enabled === 'enabled' || 
                                           existingUser.two_factor_enabled === true || 
                                           existingUser.two_factor_enabled === 1;
              // Save the updated user data with 2FA status
              await saveUser(migratedUser);
            }
          } catch (error) {
            console.error('Error fetching 2FA status from database:', error);
            // Default to false if there's an error
            migratedUser.twoFactorEnabled = false;
          }
        }
        
        setUser(migratedUser);
        setEditedUser(migratedUser);
        // Optionally, save migrated user if there was a change
        if (userData.department !== migratedUser.department) {
          await saveUser(migratedUser);
        }
        // Fetch fake report count
        if (migratedUser.email) {
          fetchFakeReportCount(migratedUser.email);
        }
      } else {
        // Default user if none exists
        const defaultUser = {
          name: 'Guest User',
          email: '',
          department: '',
          profileImage: null,
          twoFactorEnabled: false,
          createdAt: new Date().toISOString()
        };
        setUser(defaultUser);
        setEditedUser(defaultUser);
        await saveUser(defaultUser);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      showError('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      // Validate email format
      if (editedUser.email && !validateEmail(editedUser.email)) {
        showError('Invalid Email', 'Please enter a valid email address');
        setLoading(false);
        return;
      }

      // Debug log: show type and value before saving
      console.log('Saving profile. Department:', typeof editedUser.department, editedUser.department);

      // Forcefully sanitize to string
      const sanitizedUser = {
        ...editedUser,
        department: editedUser.department !== undefined && editedUser.department !== null ? String(editedUser.department) : '',
      };

      // Save updated user data locally
      await saveUser(sanitizedUser);
      
      // Update user in database via API
      try {
        console.log('Attempting to find user by email:', sanitizedUser.email);
        const existingUser = await getUserByEmail(sanitizedUser.email);
        console.log('Found existing user:', existingUser);
        
        if (existingUser) {
          const updateUrl = getApiUrl(API_CONFIG.ENDPOINTS.USER_BY_ID(existingUser.id));
          console.log('Updating user at URL:', updateUrl);
          
          const updateData = {
            full_name: sanitizedUser.name,
            email: sanitizedUser.email,
            department: sanitizedUser.department,
            profile_image: sanitizedUser.profileImage
          };
          console.log('Update data:', updateData);
          
          const response = await fetch(updateUrl, {
            method: 'PUT',
            headers: API_CONFIG.HEADERS,
            body: JSON.stringify(updateData)
          });
          
          console.log('Update response status:', response.status);
          
          if (response.ok) {
            const responseData = await response.json();
            console.log('User updated in database successfully:', responseData);
          } else {
            const errorData = await response.text();
            console.log('Failed to update user in database:', response.status, errorData);
          }
        } else {
          console.log('No existing user found for email:', sanitizedUser.email);
        }
      } catch (apiError) {
        console.error('API Error (non-blocking):', apiError);
        console.error('API Error details:', apiError.message, apiError.stack);
        // Don't block profile update if API fails
      }
      
      setUser(sanitizedUser);
      setIsEditing(false);
      
      // Track achievement for updating profile
      try {
        // Check if profile is complete (has name, department, and profile image)
        const isProfileComplete = !!(sanitizedUser.name && 
                                    sanitizedUser.name.trim() !== '' && 
                                    sanitizedUser.name !== 'Guest User' &&
                                    sanitizedUser.department && 
                                    sanitizedUser.department.trim() !== '' &&
                                    sanitizedUser.profileImage);
        
        await checkAndUpdateAchievements(
          sanitizedUser.email,
          'update_profile',
          { 
            isComplete: isProfileComplete,
            profileFields: {
              name: sanitizedUser.name,
              department: sanitizedUser.department,
              hasProfileImage: !!sanitizedUser.profileImage
            }
          }
        );
      } catch (achievementError) {
        console.error('Error tracking profile update achievement:', achievementError);
        // Continue even if achievement tracking fails
      }
      
      showSuccess('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      showError('Error', 'Failed to save profile changes');
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };



  // Profile picture selection handlers
  const handleCameraIconPress = () => {
    showConfirm(
      'Select Photo',
      'Choose an option to update your profile picture',
      [
        {
          text: 'Take Photo',
          onPress: () => handleTakePhoto(),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => handlePickFromGallery(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => hideAlert(),
        },
      ]
    );
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        showError('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setEditedUser(prev => ({ ...prev, profileImage: imageUri }));
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showError('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        showError('Permission Required', 'Gallery permission is required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setEditedUser(prev => ({ ...prev, profileImage: imageUri }));
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
      showError('Error', 'Failed to select photo from gallery. Please try again.');
    }
  };

  const handleToggle2FA = async (value) => {
    try {
      setLoading(true);
      
      // Update local state
      const updatedUser = { ...user, twoFactorEnabled: value };
      setUser(updatedUser);
      setEditedUser(updatedUser);
      
      // Save to local storage
      await saveUser(updatedUser);
      
      // Update in database via API
      try {
        if (user && user.email) {
          const existingUser = await getUserByEmail(user.email);
          if (existingUser) {
            const updateUrl = getApiUrl(API_CONFIG.ENDPOINTS.USER_BY_ID(existingUser.id));
            
            const updateData = {
              full_name: updatedUser.name,
              email: updatedUser.email,
              department: updatedUser.department,
              profile_image: updatedUser.profileImage,
              two_factor_enabled: value ? 'Enabled' : 'Disabled'
            };
            
            const response = await fetch(updateUrl, {
              method: 'PUT',
              headers: API_CONFIG.HEADERS,
              body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
              console.log('2FA status updated in database successfully');
              showSuccess('Success', `Two-Factor Authentication ${value ? 'enabled' : 'disabled'} successfully`);
            } else {
              console.log('Failed to update 2FA status in database:', response.status);
              showError('Error', 'Failed to update 2FA status in database');
            }
          }
        }
      } catch (apiError) {
        console.error('API Error updating 2FA status:', apiError);
        showError('Error', 'Failed to update 2FA status. Please try again.');
      }
    } catch (error) {
      console.error('Error toggling 2FA:', error);
      showError('Error', 'Failed to update 2FA setting');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Update user status to Offline before logout
      try {
        if (user && user.email) {
          const existingUser = await getUserByEmail(user.email);
          if (existingUser) {
            await updateUserStatus(existingUser.id, 'Offline');
            console.log('User status updated to Offline before logout');
          }
        }
      } catch (apiError) {
        console.error('API Error during logout status update (non-blocking):', apiError);
        // Don't block logout if API fails
      }
      
      // Handle user logout
      await handleUserLogout();
      
      // Only clear auth state, keep user data
      const currentUser = await AsyncStorage.getItem('user_data');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        // Keep only the essential user data (without sensitive info)
        const userDataToKeep = {
          name: user.name,
          email: user.email,
          department: user.department || '',
          profileImage: user.profileImage || null,
          createdAt: user.createdAt || new Date().toISOString()
        };
        // Save back the user data without auth info
        await AsyncStorage.setItem('user_data', JSON.stringify(userDataToKeep));
      }
      
      // Sign out from Firebase and Google
      try {
        await auth().signOut();
        await GoogleSignin.signOut();
      } catch (signOutError) {
        console.log('Firebase/Google sign out error:', signOutError);
        // Continue with navigation even if Firebase signout fails
      }
      
      // Navigate to login
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      showError('Logout Failed', 'Unable to log out. Please try again.');
    }
  };
  
  const handleDeleteAccount = async () => {
    // Reset states
    setShowDeleteButton(false);
    setDeleteCountdown(5);
    
    // Show initial warning without delete button
    showConfirm(
      'Warning Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.\n\nPlease wait 5 seconds to confirm...',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            console.log('Account deletion cancelled');
            setShowDeleteButton(false);
            setDeleteCountdown(5);
          }
        }
      ]
    );

    // Start countdown timer
    const countdownInterval = setInterval(() => {
      setDeleteCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setShowDeleteButton(true);
          
          // Show updated alert with delete button
          showConfirm(
            'Warning Delete Account',
            'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  console.log('Account deletion cancelled');
                  setShowDeleteButton(false);
                  setDeleteCountdown(5);
                }
              },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await performDeleteAccount();
                }
              }
            ]
          );
          return 5;
        }
        
        // Update the alert message with countdown
        showConfirm(
          'Warning Delete Account',
          `Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.\n\nPlease wait ${prev - 1} seconds to confirm...`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                clearInterval(countdownInterval);
                console.log('Account deletion cancelled');
                setShowDeleteButton(false);
                setDeleteCountdown(5);
              }
            }
          ]
        );
        
        return prev - 1;
      });
    }, 1000);
  };

  const performDeleteAccount = async () => {
    try {
      setLoading(true);
      
      // Update user status to Offline before deletion
      try {
        if (user && user.email) {
          const existingUser = await getUserByEmail(user.email);
          if (existingUser) {
            await updateUserStatus(existingUser.id, 'Offline');
            console.log('User status updated to Offline before deletion');
          }
        }
      } catch (apiError) {
        console.error('API Error during deletion status update (non-blocking):', apiError);
        // Continue with deletion even if status update fails
      }
      
      // Delete ALL user data from database (items, matches, claims, notifications, etc.)
      // This endpoint also deletes the user account itself
      try {
        console.log('Deleting all user data and account from database...');
        const { deleteUserData } = require('../../../config/apiConfig');
        await deleteUserData(user.email);
        console.log('All user data and account deleted from database successfully');
      } catch (deleteDataError) {
        console.error('Error deleting all user data:', deleteDataError);
        // If this fails, we cannot proceed safely - throw error
        throw new Error('Failed to delete user data from database: ' + deleteDataError.message);
      }
      
      // Get current Firebase user
      const currentFirebaseUser = auth().currentUser;
      
      if (currentFirebaseUser) {
        // Delete the user from Firebase
        await currentFirebaseUser.delete();
        console.log('User deleted from Firebase');
      } else {
        console.log('No Firebase user found to delete');
      }
      
      // Handle user logout (clears push token and sets status to Offline)
      try {
        await handleUserLogout(user.email);
        console.log('User logout handled - push token cleared, status set to Offline');
      } catch (logoutError) {
        console.error('Error during logout handling:', logoutError);
        // Continue with deletion even if logout handling fails
      }
      
      // Sign out from Google
      try {
        await GoogleSignin.signOut();
        console.log('Signed out from Google');
      } catch (signOutError) {
        console.log('Google sign out error:', signOutError);
      }
      
      // Clear user achievements and statistics
      try {
        if (user && user.email) {
          await clearUserData(user.email);
          console.log('User achievements and statistics cleared');
        }
      } catch (clearDataError) {
        console.error('Error clearing user achievements and statistics:', clearDataError);
        // Continue with deletion even if clearing user data fails
      }
      
      // Clear ALL local storage (cache, user session, and all app data)
      await AsyncStorage.clear();
      console.log('All local storage cleared (cache, session, and app data)');
      
      // Navigate back to login screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Delete account error:', error);
      setLoading(false);
      showError(
        'Delete Failed', 
        'Unable to delete your account. Please try again or contact support.'
      );
    }
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar backgroundColor="#007bff" barStyle="light-content" />
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#007bff" barStyle="light-content" />
      
      <ImageBackground 
        source={require('../../../../assets/background.jpg')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.backgroundOverlay} />
        
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
            if (isEditing) {
              showConfirm(
                'Discard Changes',
                'Are you sure you want to discard your changes?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Discard', 
                    style: 'destructive',
                    onPress: () => {
                      setEditedUser(user);
                      setIsEditing(false);
                    }
                  }
                ]
              );
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            if (isEditing) {
              handleSaveProfile();
            } else {
              setIsEditing(true);
            }
          }}
        >
          <Ionicons name={isEditing ? "checkmark" : "create-outline"} size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            {isEditing ? (
              <View style={styles.profileImageContainer}>
                {editedUser.profileImage ? (
                  <Image source={{ uri: editedUser.profileImage }} style={styles.profileImage} />
                ) : (
                  <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                    <Ionicons name="person" size={60} color="rgba(255,255,255,0.8)" />
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.changePhotoButton}
                  onPress={handleCameraIconPress}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {user.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={styles.profileImage} />
                ) : (
                  <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                    <Ionicons name="person" size={60} color="rgba(255,255,255,0.8)" />
                  </View>
                )}
              </View>
            )}
          </View>
          
          <Text style={styles.profileName}>{editedUser.name || 'CSPC User'}</Text>
          {editedUser.department && <Text style={styles.profileDepartment}>{editedUser.department}</Text>}
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoSection}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="person-circle-outline" size={22} color="#007bff" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Personal Information</Text>
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Name</Text>
              {isEditing ? (
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={18} color="#007bff" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editedUser.name}
                    onChangeText={(text) => setEditedUser(prev => ({ ...prev, name: text }))}
                    placeholder="Enter your name"
                  />
                </View>
              ) : (
                <View style={styles.valueContainer}>
                  <Ionicons name="person-outline" size={18} color="#007bff" style={styles.valueIcon} />
                  <Text style={styles.fieldValue}>{user.name || 'Not specified'}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Email</Text>
              {isEditing ? (
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={18} color="#007bff" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editedUser.email}
                    onChangeText={(text) => setEditedUser(prev => ({ ...prev, email: text }))}
                    placeholder="Enter your email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              ) : (
                <View style={styles.valueContainer}>
                  <Ionicons name="mail-outline" size={18} color="#007bff" style={styles.valueIcon} />
                  <Text style={styles.fieldValue}>{user.email || 'Not specified'}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Department of Studies</Text>
              {isEditing ? (
                <View style={styles.inputWrapper}>
                  <Ionicons name="school-outline" size={18} color="#007bff" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editedUser.department}
                    onChangeText={(text) => setEditedUser(prev => ({ ...prev, department: text }))}
                    placeholder="Enter your department"
                  />
                </View>
              ) : (
                <View style={styles.valueContainer}>
                  <Ionicons name="school-outline" size={18} color="#007bff" style={styles.valueIcon} />
                  <Text style={styles.fieldValue}>{user.department || 'Not specified'}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#007bff" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Account Information</Text>
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Member Since</Text>
              <View style={styles.valueContainer}>
                <Ionicons name="calendar-outline" size={18} color="#007bff" style={styles.valueIcon} />
                <Text style={styles.fieldValue}>
                  {user.createdAt 
                    ? new Date(user.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    : 'Unknown'
                  }
                </Text>
              </View>
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Fake Reports</Text>
              <View style={styles.valueContainer}>
                <Ionicons name="flag-outline" size={18} color={fakeReportCount > 0 ? "#dc3545" : "#007bff"} style={styles.valueIcon} />
                <Text style={[styles.fieldValue, fakeReportCount > 0 && styles.warningText]}>
                  {fakeReportCount}
                  {fakeReportCount > 0 && ' warning(s)'}
                </Text>
              </View>
              {fakeReportCount > 0 && (
                <Text style={styles.warningSubtext}>
                  Your items have been reported as fake. Please ensure all reports are accurate.
                </Text>
              )}
            </View>
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Two-Factor Authentication</Text>
              <View style={styles.toggleContainer}>
                <View style={styles.toggleInfo}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#007bff" style={styles.valueIcon} />
                  <Text style={styles.fieldValue}>
                    {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
                <Switch
                  value={user.twoFactorEnabled || false}
                  onValueChange={handleToggle2FA}
                  trackColor={{ false: '#e0e0e0', true: '#007bff' }}
                  thumbColor={user.twoFactorEnabled ? '#fff' : '#f4f3f4'}
                  ios_backgroundColor="#e0e0e0"
                  style={styles.switch}
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      {/* Account Actions */}
      <View style={styles.accountActionsContainer}>
        {/* Delete Account Button */}
        <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
        </TouchableOpacity>
        
        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
      </ImageBackground>
      
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
} ;

const createStyles = (insets) => StyleSheet.create({
  accountActionsContainer: {
    padding: 20,
    paddingBottom: Math.max(20, insets.bottom),
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    gap: 12,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff3b30',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
    width: '80%',
    justifyContent: 'center',
  },
  deleteAccountButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff3b30',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
    width: '80%',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(240, 242, 245, 0.7)',
    backdropFilter: 'blur(5px)',
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
    paddingVertical: 14,
    paddingTop:32,
    backgroundColor: '#3266a8',
    elevation: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  actionButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeader: {
    backgroundColor: 'rgba(50, 102, 168, 0.9)',
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  profileDepartment: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 1.5, // Fixed padding for account actions container + breathing room
  },
  profileImageContainer: {
    alignItems: 'center',
    marginTop: 10,
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  profileImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: '#3266a8',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
  },
  infoContainer: {
    paddingHorizontal: 16,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 12,
  },
  sectionIcon: {
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switch: {
    marginLeft: 10,
  },
  valueIcon: {
    marginRight: 12,
  },
  fieldValue: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
  },
  warningText: {
    color: '#dc3545',
    fontWeight: '600',
  },
  warningSubtext: {
    fontSize: 12,
    color: '#dc3545',
    fontStyle: 'italic',
    marginTop: 4,
    marginLeft: 30,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#2c3e50',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

export default withInternetGuard(UserProfileScreen);
