import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef, useNavigation } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators, TransitionPresets } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Dimensions, Platform, PanResponder } from 'react-native';

import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLostItems, getFoundItems } from '../shared/storage/storage';
import { useSuspension } from '../contexts/SuspensionContext';
import { getMatchById } from '../config/apiConfig';


// Import screens
import HomeScreen from '../features/home/screens/HomeScreen';
import ReportItemScreen from '../features/items/screens/ReportItemScreen';
import MatchesScreen from '../features/matching/screens/MatchesScreen';
import NotificationsScreen from '../features/notifications/screens/NotificationsScreen';
import ItemDetailsScreen from '../features/items/screens/ItemDetailsScreen';
import EditItemScreen from '../features/items/screens/EditItemScreen';
import MatchDetailsScreen from '../features/matching/screens/MatchDetailsScreen';
import ClaimItemScreen from '../features/items/screens/ClaimItemScreen';
import UserProfileScreen from '../features/profile/screens/UserProfileScreen';
import UserItemHistory from '../features/items/screens/UserItemHistory';
import SettingsScreen from '../features/profile/screens/SettingsScreen';
import HelpSupportScreen from '../features/profile/screens/HelpSupportScreen';
import UserStatsScreen from '../features/profile/screens/UserStatsScreen';
import UserFeedbackScreen from '../features/profile/screens/UserFeedbackScreen';
import UserAchievementsScreen from '../features/profile/screens/UserAchievementsScreen';
import ClearStorageScreen from '../features/profile/screens/ClearStorageScreen';
import ClaimRequestsScreen from '../features/matching/screens/ClaimRequestsScreen';
import ClaimDetailsScreen from '../features/matching/screens/ClaimDetailsScreen';


// Create navigators
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Swipeable tab navigator using PanResponder for reliable gesture handling
const SwipeableTabWrapper = () => {
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const tabs = ['Home', 'Report', 'Matches', 'ClaimRequests'];
  
  // Debounced navigation function to prevent rapid calls
  const navigateToTab = (index) => {
    if (isNavigating || index === currentTabIndex) return;
    
    setIsNavigating(true);
    setCurrentTabIndex(index);
    
    if (navigationRef.isReady()) {
      navigationRef.navigate(tabs[index]);
    }
    
    // Reset navigation lock after a short delay
    setTimeout(() => {
      setIsNavigating(false);
    }, 200);
  };
  
  // Create PanResponder for handling swipe gestures with optimized responsiveness
  const panResponder = PanResponder.create({
    // More responsive gesture detection
    onStartShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 5;
    },
    
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
    },
    
    onPanResponderGrant: (evt, gestureState) => {
      // Gesture started - immediate response
    },
    
    onPanResponderMove: (evt, gestureState) => {
      // Provide immediate visual feedback during movement
      const { dx } = gestureState;
      
      // Early detection for smoother feel
      if (Math.abs(dx) > 30) {
        // Could add visual feedback here like opacity changes
      }
    },
    
    onPanResponderRelease: (evt, gestureState) => {
      // Optimized swipe detection with lower thresholds for quicker response
      const { dx, vx } = gestureState;
      const swipeThreshold = 30; // Reduced from 50 for quicker response
      const velocityThreshold = 0.2; // Reduced from 0.3 for more sensitive detection
      
      // Determine if it's a valid swipe with improved logic
      const isValidSwipe = Math.abs(dx) > swipeThreshold || Math.abs(vx) > velocityThreshold;
      const isHorizontalSwipe = Math.abs(dx) > Math.abs(gestureState.dy) * 0.8;
      
      if (isValidSwipe && isHorizontalSwipe) {
        if (dx > 0 && currentTabIndex > 0) {
          // Swipe right - go to previous tab
          navigateToTab(currentTabIndex - 1);
        } else if (dx < 0 && currentTabIndex < tabs.length - 1) {
          // Swipe left - go to next tab  
          navigateToTab(currentTabIndex + 1);
        }
      }
    },
    
    onPanResponderTerminate: (evt, gestureState) => {
      // Handle termination gracefully
    },
  });
  
  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <TabNavigatorWithSwipe 
        currentIndex={currentTabIndex} 
        onTabChange={setCurrentTabIndex}
      />
    </View>
  );
};

// Tab navigator with swipe support and enhanced animations
const TabNavigatorWithSwipe = ({ currentIndex, onTabChange }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarHideOnKeyboard: true,
        lazy: false,
        // Add smooth animation config
        animationEnabled: true,
        animationTypeForReplace: 'push',

        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Report') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Matches') {
            iconName = focused ? 'git-compare' : 'git-compare-outline';
          } else if (route.name === 'ClaimRequests') {
            iconName = focused ? 'clipboard' : 'clipboard-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3266a8',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e0e0e0',
          paddingBottom: Math.max(insets.bottom, 15),
          paddingTop: 0.5,
          height: 70 + Math.max(insets.bottom - 15, 0),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 5,
          fontWeight: '500',
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
        lazy: false,
      })}
      screenListeners={({ navigation, route }) => ({
        tabPress: (e) => {
          // Update current index when tab is pressed
          const tabRoutes = ['Home', 'Report', 'Matches', 'ClaimRequests'];
          const pressedIndex = tabRoutes.indexOf(route.name);
          if (pressedIndex !== -1 && onTabChange) {
            onTabChange(pressedIndex);
          }
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Report" 
        component={ReportItemScreen} 
        options={{ 
          tabBarLabel: 'Report Item',
        }}
      />
      <Tab.Screen 
        name="Matches" 
        component={MatchesScreen}
        options={{
          tabBarLabel: 'Matches',
        }}
      />
      <Tab.Screen 
        name="ClaimRequests" 
        component={ClaimRequestsScreen}
        options={{ 
          tabBarLabel: 'Claims',
        }}
      />
    </Tab.Navigator>
  );
};

// Main stack navigator that includes the tab navigator
import LoginScreen from '../features/auth/screens/LoginScreen';
import HelpSignInScreen from '../features/auth/screens/HelpSignInScreen';
import TwoFactorVerificationScreen from '../features/auth/screens/TwoFactorVerificationScreen';

const navigationRef = createNavigationContainerRef();

const AppNavigator = () => {
  const { setNavigation } = useSuspension();
  
  // Set navigation reference for suspension provider
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 50; // Maximum 5 seconds of retries
    
    const setupNavigation = () => {
      if (setNavigation) {
        if (navigationRef.isReady && navigationRef.isReady()) {
          console.log('Setting navigation reference for suspension context (ready)');
          setNavigation(navigationRef);
        } else if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Navigation not ready, retry ${retryCount}/${maxRetries}`);
          setTimeout(setupNavigation, 100);
        } else {
          // Set navigation reference even if not ready after max retries
          console.log('Setting navigation reference for suspension context (forced after retries)');
          setNavigation(navigationRef);
        }
      }
    };
    
    setupNavigation();
  }, [setNavigation]);
  
  // Also set navigation reference when navigation container is ready
  const onNavigationReady = () => {
    console.log('Navigation container is ready');
    if (setNavigation) {
      setNavigation(navigationRef);
    }
  };

  // Set up notification response listener
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      
      // Only handle navigation if user explicitly tapped a notification
      // The default action identifier indicates a user tap
      if (response.actionIdentifier !== 'expo.modules.notifications.actions.DEFAULT') {
        console.log('Not a user tap, skipping navigation. Action:', response.actionIdentifier);
        return;
      }
      
      const data = response.notification.request.content.data;
      console.log('Notification data:', data);
      
      // Don't navigate if there's no data - this means it's just the app resuming
      if (!data || Object.keys(data).length === 0) {
        console.log('No notification data found, skipping navigation');
        return;
      }
      
      console.log('User tapped notification with data, proceeding with navigation');
      
      if (data && data.type === 'claimRequest') {
        console.log('Navigating to ClaimRequests screen for claim:', data.claimId);
        // Navigate to ClaimRequests screen
        if (navigationRef.isReady()) {
          navigationRef.navigate('Main', { screen: 'ClaimRequests' });
        }
      } else if (data && data.type === 'match') {
        console.log('Navigating to MatchDetails screen for match:', data.matchId);
        // Fetch match details and navigate to MatchDetails screen
        if (navigationRef.isReady() && data.matchId) {
          // First navigate to Matches tab to ensure proper navigation stack
          navigationRef.navigate('Main', { screen: 'Matches' });
          
          // Then fetch the match details and navigate to MatchDetails
          getMatchById(data.matchId)
            .then(match => {
              if (match) {
                console.log('Match fetched successfully, navigating to MatchDetails');
                navigationRef.navigate('MatchDetails', { match });
              } else {
                console.warn('Match not found, staying on Matches screen');
              }
            })
            .catch(error => {
              console.error('Error fetching match details:', error);
              // Stay on Matches screen if there's an error
            });
        }
      } else if (data && data.type === 'feedback_response') {
        console.log('Navigating to UserFeedback screen for feedback response:', data.feedbackId);
        // Navigate to User Feedback screen with highlighted feedback
        if (navigationRef.isReady()) {
          navigationRef.navigate('UserFeedback', { highlightFeedbackId: data.feedbackId });
        }
      } else if (data && data.type === 'feedback') {
        console.log('Navigating to UserFeedback screen for feedback:', data.feedbackId);
        // Navigate to User Feedback screen with highlighted feedback
        if (navigationRef.isReady()) {
          navigationRef.navigate('UserFeedback', { highlightFeedbackId: data.feedbackId });
        }
      } else if (data && (data.type === 'support_ticket' || data.type === 'supportStatus' || data.type === 'supportResponse')) {
        console.log('Navigating to HelpSupport screen for support:', data.ticketId);
        // Navigate to Help & Support screen with highlighted ticket
        if (navigationRef.isReady()) {
          navigationRef.navigate('HelpSupport', { highlightTicketId: data.ticketId });
        }
      } else if (data && data.type === 'email_alert' && data.action === 'open_gmail') {
        console.log('Opening Gmail for email alert notification');
        // Open Gmail app with inbox
        const gmailUrl = 'googlegmail://co';
        const fallbackUrl = 'https://mail.google.com';
        
        Linking.canOpenURL(gmailUrl)
          .then(supported => {
            if (supported) {
              console.log('Opening Gmail app');
              return Linking.openURL(gmailUrl);
            } else {
              console.log('Gmail app not available, opening web Gmail');
              return Linking.openURL(fallbackUrl);
            }
          })
          .catch(error => {
            console.error('Error opening Gmail:', error);
            // Fallback to web Gmail
            Linking.openURL(fallbackUrl);
          });
      } else if (data && data.type) {
        // Only navigate to Notifications screen if there's a valid notification type we don't recognize
        console.log('Unknown notification type:', data.type, '- navigating to Notifications screen');
        if (navigationRef.isReady()) {
          navigationRef.navigate('Notifications');
        }
      } else {
        // No valid notification type, don't navigate
        console.log('No valid notification type found, staying on current screen');
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Handle deep link to specific item
  const handleDeepLinkToItem = async (itemId) => {
    try {
      // Search for the item in both lost and found items
      const lostItems = await getLostItems() || [];
      const foundItems = await getFoundItems() || [];
      
      // Ensure items have correct type property
      const lostItemsWithType = lostItems.map(item => ({ ...item, type: 'lost' }));
      const foundItemsWithType = foundItems.map(item => ({ ...item, type: 'found' }));
      const allItems = [...lostItemsWithType, ...foundItemsWithType];
      
      const item = allItems.find(item => item.id === itemId);
      
      if (item) {
        // Item found, navigation will be handled by the linking config
        console.log('Deep link item found:', item.title);
      } else {
        console.log('Deep link item not found:', itemId);
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
    }
  };

  // Deep linking configuration
  const linking = {
    prefixes: [Linking.createURL('/'), 'lostandfound://', 'https://lostfound.cspc.edu.ph'],
    config: {
      screens: {
        Main: {
          screens: {
            Home: 'home',
          },
        },
        ItemDetails: {
          path: '/item/:itemId',
          parse: {
            itemId: (itemId) => itemId,
          },
        },
      },
    },
    async getInitialURL() {
      // Check if app was opened from a deep link
      const url = await Linking.getInitialURL();
      if (url != null) {
        return url;
      }
      return null;
    },
    subscribe(listener) {
      const onReceiveURL = ({ url }) => listener(url);
      
      // Listen to incoming links from deep linking
      const subscription = Linking.addEventListener('url', onReceiveURL);
      
      return () => {
        subscription?.remove();
      };
    },
  };

  return (
    <NavigationContainer 
      ref={navigationRef}
      linking={linking}
      onReady={onNavigationReady}
      onStateChange={(state) => {
        // Handle deep link navigation
        if (state) {
          const route = state.routes[state.index];
          if (route.name === 'ItemDetails' && route.params?.itemId) {
            handleDeepLinkToItem(route.params.itemId);
          }
        }
      }}
      documentTitle={{
        formatter: (options, route) => route?.name ?? 'CSPC Lost & Found'
      }}
    >
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          ...TransitionPresets.SlideFromRightIOS,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          animationEnabled: true,
          transitionSpec: {
            open: {
              animation: 'spring',
              config: {
                stiffness: 800,
                damping: 35,
                mass: 1,
                overshootClamping: false,
                restDisplacementThreshold: 0.01,
                restSpeedThreshold: 0.01,
              },
            },
            close: {
              animation: 'spring',
              config: {
                stiffness: 1000,
                damping: 500,
                mass: 3,
                overshootClamping: true,
                restDisplacementThreshold: 0.01,
                restSpeedThreshold: 0.01,
              },
            },
          },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="HelpSignIn" component={HelpSignInScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TwoFactorVerification" component={TwoFactorVerificationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={SwipeableTabWrapper} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen 
          name="ItemDetails" 
          component={ItemDetailsScreen}
          options={{
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
            transitionSpec: {
              open: {
                animation: 'spring',
                config: {
                  stiffness: 800,
                  damping: 40,
                  mass: 1,
                },
              },
              close: {
                animation: 'spring',
                config: {
                  stiffness: 800,
                  damping: 40,
                  mass: 1,
                },
              },
            },
          }}
        />
        <Stack.Screen 
          name="MatchDetails" 
          component={MatchDetailsScreen}
          options={{
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        />
        <Stack.Screen 
          name="MatchScreen" 
          component={MatchesScreen}
          options={{
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        />
        <Stack.Screen 
          name="ClaimItem" 
          component={ClaimItemScreen}
          options={{
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        />
        <Stack.Screen 
          name="EditItem" 
          component={EditItemScreen} 
          options={{ 
            headerShown: false,
            gestureEnabled: true,
            ...TransitionPresets.SlideFromRightIOS
          }} 
        />
        <Stack.Screen 
          name="ReportItem" 
          component={ReportItemScreen} 
          options={{ 
            presentation: 'modal',
            ...TransitionPresets.ModalPresentationIOS,
            cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
            gestureDirection: 'vertical'
          }}
        />
        
        {/* User-related screens */}
        <Stack.Screen 
          name="UserProfile" 
          component={UserProfileScreen}
          options={{
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        />
        <Stack.Screen 
          name="ItemHistory" 
          component={UserItemHistory}
          options={{
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        />
        <Stack.Screen 
          name="HelpSupport" 
          component={HelpSupportScreen}
          options={{
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        />
        <Stack.Screen 
          name="UserStats" 
          component={UserStatsScreen}
          options={{
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        />
        <Stack.Screen 
          name="UserFeedback" 
          component={UserFeedbackScreen}
          options={{
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        />
        <Stack.Screen 
          name="UserAchievements" 
          component={UserAchievementsScreen}
          options={{
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          }}
        />
        <Stack.Screen 
          name="ClearStorage" 
          component={ClearStorageScreen}
          options={{
            headerShown: true,
            title: 'Clear All Reports',
            presentation: 'modal',
            ...TransitionPresets.ModalPresentationIOS,
            cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
            gestureDirection: 'vertical'
          }}
        />
        <Stack.Screen 
          name="ClaimRequests" 
          component={ClaimRequestsScreen}
          options={{
            headerShown: false,
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
            transitionSpec: {
              open: {
                animation: 'spring',
                config: {
                  stiffness: 900,
                  damping: 45,
                  mass: 1,
                },
              },
              close: {
                animation: 'spring',
                config: {
                  stiffness: 900,
                  damping: 45,
                  mass: 1,
                },
              },
            },
          }}
        />
        <Stack.Screen 
          name="ClaimDetails" 
          component={ClaimDetailsScreen}
          options={{
            headerShown: false,
            ...TransitionPresets.SlideFromRightIOS,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
            transitionSpec: {
              open: {
                animation: 'spring',
                config: {
                  stiffness: 900,
                  damping: 45,
                  mass: 1,
                },
              },
              close: {
                animation: 'spring',
                config: {
                  stiffness: 900,
                  damping: 45,
                  mass: 1,
                },
              },
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export { navigationRef };
export default AppNavigator;