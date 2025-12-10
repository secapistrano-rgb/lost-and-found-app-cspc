import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  Platform,
  SafeAreaView,
  TextInput,
  Animated,
  ImageBackground,
  useColorScheme,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import "expo-dev-client";
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getApp } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import * as Notifications from 'expo-notifications';
import { initializeNotifications, scheduleNotification } from '../../../shared/services/notificationService';
import { createUser, updateUserLogin, getUserByEmail, updateUserStatus, getUserDetailsWithSuspension } from '../../../config/apiConfig';
import { checkAndUpdateAchievements } from '../../../shared/utils/achievementSystem';
import { useSuspension } from '../../../contexts/SuspensionContext';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';
import { requireInternet } from '../../../shared/utils/internetRequired';



// Function to handle user logout
const handleUserLogout = async (email) => {
  try {
    console.log('Logging out user:', email);
    
    // Update user status to Offline in database
    try {
      if (email) {
        const existingUser = await getUserByEmail(email);
        if (existingUser) {
          await updateUserStatus(existingUser.id, 'Offline');
          console.log('User status updated to Offline');
        }
      }
    } catch (apiError) {
      console.error('API Error during logout (non-blocking):', apiError);
      // Don't block logout if API fails
    }
    
    // Clear local storage
    await AsyncStorage.multiRemove([
      'user_data',
      'has_logged_in_before',
      'login_history'
    ]);
    
    console.log('User logged out successfully');
    return { success: true, message: 'Logout successful' };
  } catch (error) {
    console.error('Error during logout:', error);
    return { success: false, message: 'Logout failed' };
  }
};

// Configure notification settings
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Helper function to extract department from email
const extractDepartmentFromEmail = (email) => {
  if (!email) return '';
  
  // Check if it's a CSPC email
  if (email.toLowerCase().endsWith('@my.cspc.edu.ph')) {
    // Extract username part (before @)
    const username = email.split('@')[0].toLowerCase();
    
    // Check for department patterns in the username
    if (username.includes('it') || username.includes('cs')) {
      return 'Information Technology';
    } else if (username.includes('business') || username.includes('bsba')) {
      return 'Business Administration';
    } else if (username.includes('educ') || username.includes('ed')) {
      return 'Education';
    } else if (username.includes('tourism') || username.includes('hrm')) {
      return 'Hospitality Management';
    } else if (username.includes('crim')) {
      return 'Criminology';
    } else if (username.includes('psych')) {
      return 'Psychology';
    }
    
    // Default department for CSPC students
    return 'CSPC Student';
  }
  
  return '';
};

const LoginScreen = ({ navigation }) => {
  const fadeAnim = useState(new Animated.Value(0))[0];
  const colorScheme = useColorScheme();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalType, setModalType] = useState('success'); // 'success' | 'error'
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [suspendedUserEmail, setSuspendedUserEmail] = useState('');
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const { updateUserEmail } = useSuspension();
  


  useEffect(() => {
    // Initialize GoogleSignin with proper configuration
    GoogleSignin.configure({
      webClientId: "539830824567-g87vvrqdg81d58ap7fb7bfpjiaarscms.apps.googleusercontent.com",
      offlineAccess: false, // Set to false to simplify the flow
      forceCodeForRefreshToken: false, // Set to false to simplify the flow
      accountName: '', // Don't pre-select any account
      hostedDomain: 'my.cspc.edu.ph', // Limit to specific domain
      prompt: 'select_account', // Always prompt for account selection
      scopes: ['email', 'profile'] // Request these scopes explicitly
    });
    
    // Check if user is already signed in
    const checkSignIn = async () => {
      try {
        const isSignedIn = await GoogleSignin.isSignedIn();
        console.log('User is already signed in:', isSignedIn);
        if (isSignedIn) {
          // Get user info if already signed in
          const userInfo = await GoogleSignin.getCurrentUser();
          console.log('Current user info:', userInfo);
        }
      } catch (error) {
        console.log('Error checking sign-in status:', error);
      }
    };
    
    checkSignIn();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const onGoogleButtonPress = async () => {
    // Check internet connection first
    const hasInternet = await requireInternet('sign in with Google');
    if (!hasInternet) {
      return;
    }

    try {
      console.log('Checking Google Play services...');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Sign out first to ensure account selection prompt
      try {
        await GoogleSignin.signOut();
        console.log('Signed out of previous Google account');
        // Also sign out from Firebase
        await auth().signOut();
      } catch (signOutError) {
        console.log('Sign out error (can be ignored if not signed in):', signOutError);
      }

      console.log('Signing in with Google...');
      await GoogleSignin.signIn();
      console.log('Google sign-in successful');
      
      // Variable to store user credential
      let userCredential;
      
      // Always get tokens manually - more reliable approach
      console.log('Retrieving tokens manually...');
      const tokens = await GoogleSignin.getTokens();
      
      if (tokens && tokens.idToken) {
        // Create the Firebase credential from the manually retrieved ID token
        console.log('Creating Firebase credential...');
        const googleCredential = auth.GoogleAuthProvider.credential(tokens.idToken);
        
        // Sign in with Firebase to get the user info
        console.log('Signing in with Firebase...');
        userCredential = await auth().signInWithCredential(googleCredential);
        console.log('Firebase authentication successful');
      } else {
        // If we still can't get a token, throw a generic error without mentioning ID token
        throw new Error('Authentication failed. Please try again.');
      }
      
      // Verify we have a valid userCredential
      if (!userCredential || !userCredential.user) {
        throw new Error('Failed to get user credentials from Firebase');
      }
      
      // Get the email from the Firebase user
      console.log(JSON.stringify(userCredential.user, null, 2))
      const userEmail = userCredential.user.email;
      console.log('User email from Firebase:', userEmail);
      
      // Check if the email is from the allowed domain
      if (!userEmail || !userEmail.toLowerCase().endsWith('@my.cspc.edu.ph')) {
        console.log('Invalid email domain:', userEmail);
        
        // Sign out from Google and Firebase
        await GoogleSignin.signOut();
        await auth().signOut();
        console.log('Signed out due to invalid email domain');
        
        // Show error message
        showAnimatedModal(
          'error',
          'Unauthorized Email',
          'Please sign in with your @my.cspc.edu.ph email account.',
          null
        );
        
        return; // Exit the function without proceeding
      }
      
      console.log('Email domain check passed - valid CSPC email:', userEmail);
      console.log('Firebase sign-in successful');
      
      // Save user data to AsyncStorage - will be updated with database data later
      let newUserData = {
        name: userCredential.user.displayName || 'CSPC User',
        email: userCredential.user.email || '',
        profileImage: userCredential.user.photoURL || null,
        department: extractDepartmentFromEmail(userCredential.user.email) || '',
        address: '',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      // Log user sign-in
      console.log('User Login Details:', {
        name: userCredential.user.displayName,
        email: userCredential.user.email,
        photoURL: userCredential.user.photoURL,
        loginTime: new Date().toISOString(),
        deviceInfo: Platform.OS
      });

      // Create or update user in database via API
      try {
        console.log('Checking if user exists in database...');
          let existingUser = await getUserDetailsWithSuspension(userCredential.user.email);
          console.log('Database user data (main flow):', JSON.stringify(existingUser, null, 2));
          console.log('Suspension fields check:', {
            status: existingUser?.status,
            suspended_until: existingUser?.suspended_until,
            suspension_reason: existingUser?.suspension_reason,
            suspended_by: existingUser?.suspended_by
          });
        
        if (existingUser) {
          console.log('User exists, checking account status...');
          
          // Check if user account is suspended or banned
          if (existingUser.status === 'Temporary Suspended' || existingUser.status === 'Permanently Suspended') {
            console.log('User account is suspended:', existingUser.status);
            
            // Check if it's a temporary suspension
            const now = new Date();
            const suspendedUntil = existingUser.suspended_until ? new Date(existingUser.suspended_until) : null;
            
            let suspensionMessage = 'Your account has been suspended.';
            
            if (existingUser.status === 'Temporary Suspended') {
              // Temporary suspension
              if (suspendedUntil && suspendedUntil > now) {
                const timeRemaining = Math.ceil((suspendedUntil - now) / (1000 * 60 * 60 * 24)); // days
                const suspendedDate = suspendedUntil.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
                
                suspensionMessage = `Your account is temporarily suspended until ${suspendedDate}.\n\n${timeRemaining} day(s) remaining.`;
                
                if (existingUser.suspension_reason && existingUser.suspension_reason.trim()) {
                  suspensionMessage += `\n\nReason: ${existingUser.suspension_reason.trim()}`;
                }
                
                suspensionMessage += '\n\nPlease contact support for assistance.';
              } else if (suspendedUntil && suspendedUntil <= now) {
                // Suspension has expired, but status hasn't been updated
                console.log('Suspension has expired, allowing login');
              } else {
                suspensionMessage = 'Your account is temporarily suspended.';
                
                if (existingUser.suspension_reason && existingUser.suspension_reason.trim()) {
                  suspensionMessage += `\n\nReason: ${existingUser.suspension_reason.trim()}`;
                }
                
                suspensionMessage += '\n\nPlease contact support for assistance.';
              }
            } else if (existingUser.status === 'Permanently Suspended') {
              // Permanent suspension
              suspensionMessage = 'Your account has been permanently suspended.';
              
              if (existingUser.suspension_reason && existingUser.suspension_reason.trim()) {
                suspensionMessage += `\n\nReason: ${existingUser.suspension_reason.trim()}`;
              }
              
              suspensionMessage += '\n\nPlease contact support for assistance.';
            }
            
            if (!suspendedUntil || suspendedUntil > now) {
              // Sign out from Google and Firebase
              await GoogleSignin.signOut();
              await auth().signOut();
              console.log('Signed out due to suspended account');
              
              // Show suspension message with manual dismiss
              showSuspensionModal(suspensionMessage, existingUser.email);
              
              return; // Exit the function without proceeding
            }
          }
          
          console.log('Account status check passed, updating login timestamp and status...');
          await updateUserLogin(existingUser.id);
          await updateUserStatus(existingUser.id, 'Online');
          console.log('User login timestamp and status updated successfully');
          
          // Update newUserData with database data to preserve profile changes
          newUserData = {
            name: existingUser.full_name || userCredential.user.displayName || 'CSPC User',
            email: existingUser.email || userCredential.user.email || '',
            profileImage: existingUser.profile_image || userCredential.user.photoURL || null,
            department: existingUser.department || extractDepartmentFromEmail(userCredential.user.email) || '',
            address: existingUser.address || '',
            createdAt: existingUser.created_at || new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            twoFactorEnabled: existingUser.two_factor_enabled === 'Enabled' || existingUser.two_factor_enabled === 'enabled' || existingUser.two_factor_enabled === true || existingUser.two_factor_enabled === 1
          };
          console.log('Updated user data with database values:', newUserData);
        } else {
          console.log('User does not exist, creating new user...');
          const createUserData = {
            google_id: userCredential.user.uid,
            email: userCredential.user.email,
            full_name: userCredential.user.displayName,
            profile_image: userCredential.user.photoURL,
            department: extractDepartmentFromEmail(userCredential.user.email) || null,
            status: 'Online'
          };
          
          const createResult = await createUser(createUserData);
          console.log('User created successfully:', createResult);
        }
        
        // Save the final user data to AsyncStorage
        console.log('Saving final user data to AsyncStorage:', newUserData);
        await AsyncStorage.setItem("user_data", JSON.stringify(newUserData));
        
        // Update suspension context with user email
      updateUserEmail(newUserData.email);
      } catch (apiError) {
        console.error('API Error (non-blocking):', apiError);
        // Don't block login if API fails, save Firebase data as fallback
        console.log('Saving Firebase user data as fallback:', newUserData);
        await AsyncStorage.setItem("user_data", JSON.stringify(newUserData));
      }

      // Save login history to AsyncStorage
      try {
        const loginHistory = await AsyncStorage.getItem('login_history') || '[]';
        const history = JSON.parse(loginHistory);
        history.push({
          timestamp: new Date().toISOString(),
          email: userCredential.user.email,
          deviceType: Platform.OS,
          success: true
        });
        // Keep only last 10 login attempts
        if (history.length > 10) {
          history.shift();
        }
        await AsyncStorage.setItem('login_history', JSON.stringify(history));
      } catch (error) {
        console.error('Error saving login history:', error);
      }

      // Mark that the user has logged in before
      await AsyncStorage.setItem('has_logged_in_before', 'true');

      // Track achievement for daily login
      try {
        await checkAndUpdateAchievements(
          userCredential.user.email,
          'daily_login',
          { loginTime: new Date().toISOString() }
        );
      } catch (achievementError) {
        console.error('Error tracking daily login achievement:', achievementError);
        // Continue even if achievement tracking fails
      }

      // Trigger a notification
      console.log('Scheduling notification...');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Login Successful 🎉",
          body: `Welcome back, ${userCredential.user.displayName || 'User'}!`,
        },
        trigger: null, // Send immediately
      });
      console.log('Notification scheduled successfully.');

      // Account status checking removed - users can access the app normally

      // Check if user has 2FA enabled before navigation
      let shouldUse2FA = false;
      try {
        const existingUser = await getUserByEmail(userCredential.user.email);
        if (existingUser && existingUser.two_factor_enabled) {
          // Check if 2FA is enabled (can be 'Enabled', 'enabled', true, or 1)
          const twoFactorStatus = existingUser.two_factor_enabled;
          shouldUse2FA = twoFactorStatus === 'Enabled' || 
                        twoFactorStatus === 'enabled' || 
                        twoFactorStatus === true || 
                        twoFactorStatus === 1;
        }
        console.log('2FA status for user:', shouldUse2FA);
      } catch (error) {
        console.error('Error checking 2FA status:', error);
        // Default to no 2FA if there's an error
        shouldUse2FA = false;
      }

      // Show animation, then navigate based on 2FA setting
      showAnimatedModal(
        'success',
        'Success',
        'Successfully Logged In with Google',
        async () => {
          // Check if this is truly a first login (tutorial not completed for THIS user)
          let isFirstLogin = false;
          try {
            const userEmail = userCredential.user.email;
            const tutorialKey = `tutorial_completed_${userEmail}`;
            const tutorialCompleted = await AsyncStorage.getItem(tutorialKey);
            isFirstLogin = tutorialCompleted !== 'true';
            console.log(`Tutorial completed status for ${userEmail}:`, tutorialCompleted, '- isFirstLogin:', isFirstLogin);
          } catch (error) {
            console.error('Error checking tutorial status:', error);
            // Default to first login if we can't read the status
            isFirstLogin = true;
          }
          
          if (shouldUse2FA) {
            // Navigate to 2FA verification if enabled
            navigation.navigate('TwoFactorVerification', {
              userEmail: userCredential.user.email,
              userData: newUserData,
              isFirstLogin: isFirstLogin
            });
          } else {
            // Navigate directly to main app if 2FA is disabled
            navigation.reset({
              index: 0,
              routes: [{ 
                name: 'Main', 
                params: { 
                  screen: 'Home',
                  params: { isFirstLogin: isFirstLogin }
                }
              }],
            });
          }
        }
      );
    } catch (error) {
      console.error('Google Sign-In error:', error);
      
      // Try to get current user if sign-in failed but user is already signed in
      try {
        const userData = await GoogleSignin.getCurrentUser();
        if (userData && userData.user && userData.user.email && 
            userData.user.email.toLowerCase().endsWith('@my.cspc.edu.ph')) {
          console.log('Using existing Google Sign-In session');
          
          // Prepare initial user data from Firebase
          let newUserData = {
            name: userData.user.name || 'CSPC User',
            email: userData.user.email || '',
            profileImage: userData.user.photo || null,
            department: extractDepartmentFromEmail(userData.user.email) || '',
            address: '',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          };

          // Try to get database data to preserve profile changes
          try {
            console.log('Checking if user exists in database (retry flow)...');
            let existingUser = await getUserDetailsWithSuspension(userData.user.email);
            console.log('Database user data (retry flow):', JSON.stringify(existingUser, null, 2));
            console.log('Suspension fields check (retry):', {
            status: existingUser?.status,
            suspended_until: existingUser?.suspended_until,
            suspension_reason: existingUser?.suspension_reason,
            suspended_by: existingUser?.suspended_by
          });
            
            if (existingUser) {
              console.log('User exists, checking account status (retry flow)...');
              
              // Check if user account is suspended or banned
              if (existingUser.status === 'Temporary Suspended' || existingUser.status === 'Permanently Suspended') {
                console.log('User account is suspended (retry flow):', existingUser.status);
                
                // Check if it's a temporary suspension
                const now = new Date();
                const suspendedUntil = existingUser.suspended_until ? new Date(existingUser.suspended_until) : null;
                
                let suspensionMessage = 'Your account has been suspended.';
                
                if (existingUser.status === 'Temporary Suspended') {
                  // Temporary suspension
                  if (suspendedUntil && suspendedUntil > now) {
                    const timeRemaining = Math.ceil((suspendedUntil - now) / (1000 * 60 * 60 * 24)); // days
                    suspensionMessage = `Your account is temporarily suspended until ${suspendedUntil.toLocaleDateString()}. ${timeRemaining} day(s) remaining.`;
                  } else if (suspendedUntil && suspendedUntil <= now) {
                    // Suspension has expired, but status hasn't been updated
                    console.log('Suspension has expired, allowing login (retry flow)');
                  } else {
                    suspensionMessage = 'Your account is temporarily suspended.';
                  }
                } else if (existingUser.status === 'Permanently Suspended') {
                  // Permanent suspension
                  suspensionMessage = 'Your account has been permanently suspended.';
                }
                
                if (!suspendedUntil || suspendedUntil > now) {
                  // Sign out from Google
                  await GoogleSignin.signOut();
                  console.log('Signed out due to suspended account (retry flow)');
                  
                  // Show suspension message
                  showAnimatedModal(
                    'error',
                    'Account Suspended',
                    suspensionMessage + (existingUser.suspension_reason ? ` Reason: ${existingUser.suspension_reason}` : '') + ' Please contact support for assistance.',
                    null
                  );
                  
                  return; // Exit the function without proceeding
                }
              }
              
              console.log('Account status check passed, updating login timestamp and status (retry flow)...');
              await updateUserLogin(existingUser.id);
              await updateUserStatus(existingUser.id, 'Online');
              
              // Update with database data to preserve profile changes
              newUserData = {
                name: existingUser.full_name || userData.user.name || 'CSPC User',
                email: existingUser.email || userData.user.email || '',
                profileImage: existingUser.profile_image || userData.user.photo || null,
                department: existingUser.department || extractDepartmentFromEmail(userData.user.email) || '',
                address: existingUser.address || '',
                createdAt: existingUser.created_at || new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                twoFactorEnabled: existingUser.two_factor_enabled === 'Enabled' || existingUser.two_factor_enabled === 'enabled' || existingUser.two_factor_enabled === true || existingUser.two_factor_enabled === 1
              };
              console.log('Updated user data with database values (retry flow):', newUserData);
            }
          } catch (apiError) {
            console.error('API Error in retry flow (non-blocking):', apiError);
          }

          console.log('Saving final user data (retry flow):', newUserData);
          await AsyncStorage.setItem("user_data", JSON.stringify(newUserData));
          
          // Update suspension context with user email
          updateUserEmail(newUserData.email);

          // Log user sign-in
          console.log('User Login Details:', {
            name: userData.user.name,
            email: userData.user.email,
            photoURL: userData.user.photo,
            loginTime: new Date().toISOString(),
            deviceInfo: Platform.OS
          });

          // Save login history to AsyncStorage
          try {
            const loginHistory = await AsyncStorage.getItem('login_history') || '[]';
            const history = JSON.parse(loginHistory);
            history.push({
              timestamp: new Date().toISOString(),
              email: userData.user.email,
              deviceType: Platform.OS,
              success: true
            });
            // Keep only last 10 login attempts
            if (history.length > 10) {
              history.shift();
            }
            await AsyncStorage.setItem('login_history', JSON.stringify(history));
          } catch (error) {
            console.error('Error saving login history:', error);
          }

          // Mark that the user has logged in before
          await AsyncStorage.setItem('has_logged_in_before', 'true');

          // Track achievement for daily login (retry flow)
          try {
            await checkAndUpdateAchievements(
              userData.user.email,
              'daily_login',
              { loginTime: new Date().toISOString() }
            );
          } catch (achievementError) {
            console.error('Error tracking daily login achievement (retry):', achievementError);
            // Continue even if achievement tracking fails
          }

          // Initialize notifications and show welcome message
          console.log('Initializing notifications...');
          const notificationsInitialized = await initializeNotifications();
          
          if (notificationsInitialized) {
            console.log('Scheduling welcome notification...');
            await scheduleNotification({
              title: 'Login Successful 🎉',
              body: `Welcome back, ${userData.user.name || 'User'}!`,
              data: { type: 'login_success' },
              channelId: 'default'
            });
          } else {
            console.warn('Could not initialize notifications');
          }
          
          // Navigate to 2FA verification
          navigation.navigate('TwoFactorVerification', {
            userEmail: userData.user.email,
            userData: newUserData
          });
          
          return;
        }
      } catch (getCurrentUserError) {
        console.log('Error getting current user:', getCurrentUserError);
      }
      
      // Show error message
      showAnimatedModal(
        'error',
        'Authentication Error',
        'There was a problem signing in. Please try again with your @my.cspc.edu.ph account.',
        null
      );
      
      // Try to sign out to clean up any partial authentication state
      try {
        await GoogleSignin.signOut();
        await auth().signOut();
      } catch (e) {
        console.log('Error during cleanup:', e);
      }
    }
  };



  // Handle success/error modal animation and display
  const showSuspensionModal = (message, userEmail = '') => {
    // Clear any existing timeout
    if (global.animationTimeout) {
      clearTimeout(global.animationTimeout);
    }
    
    // Set modal content for suspension (no auto-dismiss)
    setModalType('error');
    setModalTitle('Account Suspended');
    setModalMessage(message);
    setSuspendedUserEmail(userEmail);
    setShowSuccessModal(true);
    
    // Animate modal appearing
    scaleAnim.setValue(0);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
    
    // No auto-dismiss timeout for suspension modal
  };

  const showAnimatedModal = (type, title, message, onFinish) => {
    // Clear any existing timeout
    if (global.animationTimeout) {
      clearTimeout(global.animationTimeout);
    }
    
    // Set modal content
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setShowSuccessModal(true);
    
    // Animate modal appearing
    scaleAnim.setValue(0);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
    
    // Set timeout for modal disappearing
    global.animationTimeout = setTimeout(() => {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowSuccessModal(false);
        if (onFinish) onFinish();
      });
    }, 2000); // Show for 2 seconds
  };

  // Get screen dimensions for responsive layout
  const { width, height } = Dimensions.get('window');
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Image source={require('../../../../assets/background.jpg')} style={[styles.background, { width, height }]} resizeMode="cover" />
          <View style={styles.overlay} />
          <View style={[styles.contentContainer, { minHeight: height * 0.9 }]}>  
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../../assets/logo-app.jpg')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <View style={[styles.card, { padding: width < 400 ? 18 : 28, borderRadius: width < 400 ? 16 : 22 }]}>
              <Text style={styles.title}>CSPC Lost & Found App</Text>
              <Text style={styles.subtitle}>Recover what's gone, restore what's here.</Text>
              
              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={22} color="#3266a8" style={{ marginRight: 10 }} />
                <Text style={styles.infoText}>
                  This app is exclusively for CSPC students only. Please sign in with your {'\n'}
                  <Text style={{ fontWeight: 'bold' }}>my.cspc.edu.ph</Text> Google account.
                </Text>
              </View>
              
              <TouchableOpacity 
                style={styles.googleButton} 
                onPress={onGoogleButtonPress} 
                activeOpacity={0.85}
              >
                <Ionicons name="logo-google" size={22} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => navigation.navigate('HelpSignIn')}>
                <Text style={styles.helpText}>Need help signing in?</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.termsText}>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Animated Modal for Success/Error */}
      {showSuccessModal && (
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.successModal, 
              { transform: [{ scale: scaleAnim }], opacity: scaleAnim }
            ]}
          >
            <Ionicons
              name={modalType === 'success' ? "checkmark-circle" : "close-circle"}
              size={60}
              color={modalType === 'success' ? '#28a745' : '#dc3545'}
              style={styles.modalIcon}
            />
            <Text style={[
              styles.successTitle,
              modalType === 'error' && { color: '#dc3545' }
            ]}>
              {modalTitle}
            </Text>
            <Text style={[styles.successMessage, modalTitle === 'Account Suspended' && { fontSize: 14, lineHeight: 20 }]}>{modalMessage}</Text>
            {modalType === 'error' && modalTitle === 'Account Suspended' && (
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.appealButton}
                  onPress={() => {
                    const subject = 'Appeal for Account Unsuspension';
                    const body = 'Dear Support Team,\n\nI would like to appeal the suspension of my account.\n\nAccount Email: ' + 
                                (suspendedUserEmail || '') + 
                                '\n\nReason for Appeal:\n[Please describe your reason here]\n\nThank you for your consideration.';
                    Linking.openURL(`mailto:lostfoundcspc@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                  }}
                >
                  <Ionicons name="mail-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.appealButtonText}>Appeal</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={() => {
                    // Clear timeout and hide modal immediately
                    if (global.animationTimeout) {
                      clearTimeout(global.animationTimeout);
                    }
                    Animated.timing(scaleAnim, {
                      toValue: 0,
                      duration: 300,
                      useNativeDriver: true,
                    }).start(() => {
                      setShowSuccessModal(false);
                      // Stay on login screen
                    });
                  }}
                >
                  <Text style={styles.modalButtonText}>OK</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
};

// Get dimensions for responsive styling
const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#23406e',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: height,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    width,
    height,
    zIndex: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(35, 64, 110, 0.5)',
    zIndex: 1,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    paddingHorizontal: width < 400 ? 12 : 18,
    width: '100%',
    minHeight: height * 0.9,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: width < 400 ? 20 : 30,
    marginTop: width < 400 ? 10 : 20,
  },
  logo: {
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2, // Makes it perfectly circular
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
    backgroundColor: '#fff', // Add background to ensure circle is visible
    borderWidth: 3,
    borderColor: '#fff',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255,255,255,0.95)',
    // Use dynamic borderRadius and padding based on screen width
    // These will be applied at render time using inline styles instead
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#23406e',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#3a537c',
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f4f7fb',
    borderRadius: 14,
    padding: 18,
    marginBottom: 30,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e8f0fe',
  },
  infoText: {
    color: '#23406e',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3266a8',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 18,
    width: '100%',
    justifyContent: 'center',
    shadowColor: '#3266a8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  helpText: {
    color: '#3266a8',
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginBottom: 14,
    fontSize: 15,
    fontWeight: '500',
  },
  termsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  successModal: {
    width: 320,
    maxWidth: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    alignItems: 'center',
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  modalIcon: {
    marginBottom: 5,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
    color: '#4CAF50',
  },
  successMessage: {
    fontSize: 16,
    marginTop: 8,
    color: '#333',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
    justifyContent: 'center',
  },
  appealButton: {
    flexDirection: 'row',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  appealButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

// Wrap LoginScreen with internet guard to block access when offline
export default withInternetGuard(LoginScreen);
export { handleUserLogout };
