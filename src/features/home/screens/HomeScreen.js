import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
  ImageBackground,
  Modal,
  ScrollView,
  RefreshControl,
  Image,
  BlurView,
  TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import ItemCard from '../../items/components/ItemCard';
import UserMenu from '../../../components/common/layout/UserMenu';
import { getItems } from '../../../config/apiConfig';
import { runMatchingProcess } from '../../matching/services/matchingService';
import { getUser } from '../../../shared/storage/storage';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';
import { getMatchesByUser } from '../../../config/apiConfig';
import { useNotifications } from '../../../shared/context/NotificationContext';
import WelcomeModal from '../../../components/common/modals/WelcomeModal';



// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Scale factor calculation optimized for 2400 x 1080 resolution
// Base design width is 375 (iPhone standard), but we adjust for high-res screens
const isHighResolution = width >= 1080;
const scaleFactor = isHighResolution ? (width / 600) : (width / 375);

const scaleFont = (size) => Math.round(size * scaleFactor);
const scaleSize = (size) => Math.round(size * scaleFactor);

const HomeScreen = ({ navigation, route }) => {
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Use notification context for real-time updates
  const { unreadCount: unreadNotifications, updateUnreadCount } = useNotifications();
  
  // Track if this is the first app launch
  const isFirstAppLaunch = useRef(true);
  
  const { alertConfig, showError, hideAlert } = useProfessionalAlert();
  
  // Initial setup effect - only runs once when component first mounts
  useEffect(() => {
    // Debug: Log all route params
    console.log('HomeScreen route params:', route.params);
    
    // Check if we're coming from an item deletion or other action
    const isAfterItemAction = route.params?.itemDeleted || 
                              route.params?.itemResolved || 
                              route.params?.notificationsCleared || 
                              route.params?.notificationRead;
    
    // Check if user just logged in
    const isNewLogin = route.params?.isFirstLogin;
    console.log('isNewLogin value:', isNewLogin, 'isAfterItemAction:', isAfterItemAction);
    
    loadItems();
    updateUnreadCount();
    
    // Show welcome only when user logs in for the first time
    if (isNewLogin && !isAfterItemAction) {
      console.log('New login detected, checking tutorial status...');
      // Check if tutorial has been completed before for THIS specific user
      getUser().then(user => {
        if (user && user.email) {
          const tutorialKey = `tutorial_completed_${user.email}`;
          AsyncStorage.getItem(tutorialKey).then(completed => {
            console.log(`Tutorial completed status for ${user.email}:`, completed);
            if (completed !== 'true') {
              console.log('Showing welcome modal for new user');
              setShowWelcome(true);
              isFirstAppLaunch.current = false;
            } else {
              console.log('Tutorial already completed for this user, skipping welcome modal');
            }
          }).catch(error => {
            console.error('Error checking tutorial status:', error);
            // If there's an error reading AsyncStorage, show welcome modal anyway
            console.log('Error reading tutorial status, showing welcome modal as fallback');
            setShowWelcome(true);
            isFirstAppLaunch.current = false;
          });
        }
      }).catch(error => {
        console.error('Error getting user data:', error);
        // Show welcome modal if we can't get user data
        setShowWelcome(true);
        isFirstAppLaunch.current = false;
      });
    } else {
      console.log('Not a new login or after item action, isNewLogin:', isNewLogin, 'isAfterItemAction:', isAfterItemAction);
    }
    
    // This will run when component is unmounted
    return () => {
      // We don't reset isFirstAppLaunch here, so it stays false
    };
  }, [route.params]);
  
  // One-time migration to clear old matches data
  useEffect(() => {
    const migrateMatchesData = async () => {
      try {
        const migrationKey = 'matches_migration_completed';
        const migrationCompleted = await AsyncStorage.getItem(migrationKey);
        
        if (!migrationCompleted) {
          console.log('Matches data migration skipped - API removed');
          await AsyncStorage.setItem(migrationKey, 'true');
          console.log('Migration marked as completed');
        }
      } catch (error) {
        console.error('Error during matches migration:', error);
      }
    };
    
    migrateMatchesData();
  }, []);
  
  useEffect(() => {
    // Refresh items when the screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadItems();
      updateUnreadCount();
      
      // Check if notifications were viewed or cleared
      if (navigation.isFocused() && 
          (route.params?.notificationsCleared || route.params?.notificationRead)) {
        // Refresh the notification count
        updateUnreadCount();
        
        // Reset the params to avoid showing the message again
        setTimeout(() => {
          navigation.setParams({ 
            notificationsCleared: undefined,
            notificationRead: undefined
          });
        }, 100);
      }
      
      // Check if an item was marked as resolved (found)
      if (navigation.isFocused() && route.params?.itemResolved) {
        // Refresh the items list to remove the resolved item
        loadItems();
        
        // Show feedback that item was resolved
        showError(
          'Item Resolved',
          'The lost item has been marked as found and removed from active listings.'
        );
        
        // Reset the params to avoid showing the message again
        setTimeout(() => {
          navigation.setParams({ 
            itemResolved: undefined,
            resolvedItemId: undefined,
            matchId: undefined
          });
        }, 100);
      }
      
      // Check if an item was deleted and show feedback
      if (navigation.isFocused() && route.params?.itemDeleted) {
        // Show toast or notification that item was deleted
        setTimeout(() => {
          // Reset the params to avoid showing the message again
          navigation.setParams({ 
            itemDeleted: undefined, 
            deletedItemId: undefined,
            // Keep the isFirstLogin parameter if it exists
            isFirstLogin: route.params?.isFirstLogin
          });
        }, 100);
      }
    });
    return unsubscribe;
  }, [navigation, route.params]);
  

  
  const completeTutorial = async () => {
    setShowTutorial(false);
    // Save that the tutorial has been completed for THIS specific user
    try {
      const user = await getUser();
      if (user && user.email) {
        const tutorialKey = `tutorial_completed_${user.email}`;
        await AsyncStorage.setItem(tutorialKey, 'true');
        console.log(`Tutorial marked as completed for ${user.email}`);
      }
    } catch (error) {
      console.error('Error saving tutorial status:', error);
    }
  };

  // Debug function to reset tutorial status (for testing)
  const resetTutorialStatus = async () => {
    try {
      const user = await getUser();
      if (user && user.email) {
        const tutorialKey = `tutorial_completed_${user.email}`;
        await AsyncStorage.removeItem(tutorialKey);
        console.log(`Tutorial status reset for ${user.email} - welcome modal will show on next login`);
      }
    } catch (error) {
      console.error('Error resetting tutorial status:', error);
    }
  };

  // Expose reset function globally for debugging
  global.resetTutorialStatus = resetTutorialStatus;

  const handleWelcomeClose = () => {
    setShowWelcome(false);
    
    // Show tutorial immediately after welcome modal
    setTimeout(() => {
      setShowTutorial(true);
      setCurrentTutorialStep(0); // Reset to the first step
    }, 300); // Small delay to ensure smooth transition
  };

  
  const nextTutorialStep = () => {
    if (currentTutorialStep < tutorialSteps.length - 1) {
      setCurrentTutorialStep(currentTutorialStep + 1);
    } else {
      completeTutorial();
    }
  };
  
  const tutorialSteps = [
    {
      title: "Welcome to CSPC Lost & Found!",
      description: "Your campus-wide solution for recovering lost items. Report lost or found items with photos and detailed descriptions to help the CSPC community.",
      icon: "school"
    },
     {
      title: "Complete Your CSPC Profile",
      description: "IMPORTANT: Update your profile with your real department instead of 'CSPC Student' to help connect with the right people on campus.",
      icon: "school"
    },
    {
      title: "Report Items Easily",
      description: "Tap the + button to report lost or found items. Add photos, descriptions, and location details. Our system works across all CSPC campus buildings.",
      icon: "add-circle"
    },
    {
      title: "Smart AI Matching System",
      description: "Our advanced matching algorithm uses image recognition and keyword analysis to automatically connect lost items with found items in real-time.",
      icon: "git-compare"
    },
    {
      title: "Discover Potential Matches",
      description: "Check the Matches tab to see items that might be yours or items you've found that belong to others. Get instant notifications for new matches.",
      icon: "link"
    },
    {
      title: "Claim Your Items",
      description: "Found your lost item? Submit a claim request with proof of ownership. The system will notify the finder and facilitate safe item return.",
      icon: "checkmark-circle"
    },
    {
      title: "Track Claim Status",
      description: "Monitor all your claim requests in the Claims tab. See status updates, communicate with finders, and coordinate pickup arrangements.",
      icon: "clipboard"
    },
    {
      title: "Stay Connected",
      description: "Receive instant notifications for matches, claim updates, and messages. Enable location services for better matching accuracy.",
      icon: "notifications"
    },
    {
      title: "Earn Achievements",
      description: "Help the community and unlock achievements! Earn points for reporting items, successful matches, and being an active community member.",
      icon: "trophy"
    },
    {
      title: "Manage Your Profile",
      description: "View your item history, check statistics, manage settings, and see your achievements. Access help and support when needed.",
      icon: "person"
    }
  ];
  
  const loadItems = async () => {
    if (!refreshing) {
      setLoading(true);
    }
    try {
      // Load all items from API immediately (no blocking operations)
      const allItems = await getItems();
      
      // Ensure allItems is an array
      if (!allItems || !Array.isArray(allItems)) {
        console.warn('getItems() returned invalid data:', allItems);
        setItems([]);
        return;
      }
      
      // Filter out resolved, claimed, returned items AND pending_turnin items (found items waiting to be turned in)
      const activeItems = allItems.filter(item => 
        !['resolved', 'claimed', 'returned', 'pending_turnin'].includes(item.status)
      );
      
      // Sort by creation date (newest first) and show immediately with default match count
      const sortedItems = activeItems
        .map(item => ({ ...item, matchCount: 0 })) // Default match count
        .sort((a, b) => new Date(b.date_reported || b.createdAt) - new Date(a.date_reported || a.createdAt));
        
      // Set items immediately for instant display
      setItems(sortedItems);
      
      // Update match counts in background (non-blocking)
      const updateMatchCounts = async () => {
        try {
          const user = await getUser();
          if (user && user.email) {
            const userMatches = await getMatchesByUser(user.email) || [];
            
            // Update items with actual match counts
            const itemsWithMatches = sortedItems.map((item) => {
              const matchCount = userMatches.filter(match => 
                match.lost_item_id === item.id || match.found_item_id === item.id
              ).length;
              return { ...item, matchCount };
            });
            
            setItems(itemsWithMatches);
          }
        } catch (error) {
          console.error('Error updating match counts:', error);
        }
      };
      
      // Run background operations without blocking UI
      Promise.all([
        updateMatchCounts(),
        runMatchingProcess(true)
      ]).catch(error => {
        console.error('Background operations failed:', error);
      });
      
    } catch (error) {
      console.error('Error loading items:', error);
      // Ensure items is always an array, even on error
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
     }
    };
    
    const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    updateUnreadCount();
  };
  
  const filterItems = () => {
    // Handle null/undefined items array
    if (!items || !Array.isArray(items)) {
      return [];
    }
    
    // Filter out items with 'claimed' or 'returned' status
    const activeItems = items.filter(item => 
      item.status !== 'claimed' && item.status !== 'returned'
    );
    
    if (activeTab === 'all') {
      return activeItems;
    }
    return activeItems.filter(item => item.type === activeTab);
  };

  const searchItems = (query) => {
    if (!query.trim()) {
      return [];
    }
    
    const searchLower = query.toLowerCase();
    
    // Handle null/undefined items array
    if (!items || !Array.isArray(items)) {
      return [];
    }
    
    // Filter out items with 'claimed' or 'returned' status and search
    const activeItems = items.filter(item => 
      item.status !== 'claimed' && item.status !== 'returned'
    );
    
    return activeItems.filter(item => {
      const titleMatch = item.title?.toLowerCase().includes(searchLower);
      const locationMatch = item.location?.toLowerCase().includes(searchLower);
      const typeMatch = item.type?.toLowerCase().includes(searchLower);
      
      // Search in detected categories if they exist
      let categoriesMatch = false;
      if (item.detected_categories) {
        try {
          const categories = typeof item.detected_categories === 'string' 
            ? JSON.parse(item.detected_categories) 
            : item.detected_categories;
          categoriesMatch = Array.isArray(categories) && 
            categories.some(cat => cat.toLowerCase().includes(searchLower));
        } catch (e) {
          console.log('Error parsing categories for search:', e);
        }
      }
      
      return titleMatch || locationMatch || typeMatch || categoriesMatch;
    });
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    const results = searchItems(query);
    setSearchResults(results);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };
  
  const handleItemPress = (item) => {
    // Close search modal first
    clearSearch();
    // Then navigate to item details
    navigation.navigate('ItemDetails', { item });
  };
  
  const renderItem = ({ item }) => (
    <ItemCard 
      item={item} 
      onPress={handleItemPress} 
      type={item.type}
    />
  );
  
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={64} color="#999" />
      <Text style={styles.emptyText}>No items found</Text>
      <Text style={styles.emptySubtext}>
        {activeTab === 'all' 
          ? 'Start by reporting a lost or found item'
          : `No ${activeTab} items have been reported yet`}
      </Text>
    </View>
  );

  const renderTutorialModal = () => {
    const currentStep = tutorialSteps[currentTutorialStep];
    
    return (
      <Modal
        visible={showTutorial}
        transparent={true}
        animationType="fade"
        onRequestClose={() => completeTutorial()}
      >
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.6)', 'rgba(50, 102, 168, 0.3)', 'rgba(0, 0, 0, 0.8)']}
          style={styles.tutorialOverlay}
        >
          <View style={styles.tutorialCard}>
            <View style={styles.tutorialIconContainer}>
              <Ionicons name={currentStep.icon} size={45} color="#3266a8" />
            </View>
            <Text style={styles.tutorialTitle}>{currentStep.title}</Text>
            <Text style={styles.tutorialDescription}>{currentStep.description}</Text>
            
            <View style={styles.tutorialStepIndicators}>
              {tutorialSteps.map((_, index) => (
                <View 
                  key={index} 
                  style={[styles.stepDot, currentTutorialStep === index && styles.activeDot]} 
                />
              ))}
            </View>
            
            <View style={styles.tutorialButtons}>
              <TouchableOpacity 
                style={[styles.tutorialButton, styles.nextButton]} 
                onPress={nextTutorialStep}
              >
                <Text style={styles.nextButtonText}>
                  {currentTutorialStep === tutorialSteps.length - 1 ? 'Got it!' : 'Next'}
                </Text>
                {currentTutorialStep < tutorialSteps.length - 1 && (
                  <Ionicons name="arrow-forward" size={16} color={"#fff"} style={{marginLeft: 4}} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    );
  };

  const renderSearchModal = () => {
    return (
      <Modal
        visible={showSearch}
        transparent={true}
        animationType="slide"
        onRequestClose={clearSearch}
      >
        <View style={styles.searchOverlay}>
          <SafeAreaView style={styles.searchContainer}>
            <View style={styles.searchHeader}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search items, locations, categories..."
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoFocus={true}
                  placeholderTextColor="#999"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={clearSearch} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContent}>
              {searchQuery.length === 0 ? (
                <View style={styles.searchEmptyState}>
                  <Ionicons name="search-outline" size={64} color="#ccc" />
                  <Text style={styles.searchEmptyText}>Start typing to search</Text>
                  <Text style={styles.searchEmptySubtext}>
                    Search by title, location, or category
                  </Text>
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.searchEmptyState}>
                  <Ionicons name="document-outline" size={64} color="#ccc" />
                  <Text style={styles.searchEmptyText}>No results found</Text>
                  <Text style={styles.searchEmptySubtext}>
                    Try different keywords or check your spelling
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  renderItem={renderItem}
                  keyExtractor={item => `search-${item.id}`}
                  contentContainerStyle={styles.searchResultsList}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    );
  };
  


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3266a8" />
      
      <ImageBackground 
        source={require('../../../../assets/background.jpg')} 
        style={styles.backgroundImage}
        imageStyle={{ opacity: 0.3 }}
        resizeMode="cover"
      >
      
        {/* Header with background */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={['#3266a8', '#23406e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.titleContainer}>
                <View style={styles.titleRow}>
                  <Image 
                    source={require('../../../../assets/logo-app.jpg')} 
                    style={styles.logoImage} 
                    resizeMode="contain"
                  />
                  <Text style={styles.title}>CSPC Lost & Found</Text>
                </View>
              </View>
              
              <View style={styles.headerButtons}>
                <TouchableOpacity 
                  style={styles.headerSearchButton}
                  onPress={() => setShowSearch(true)}
                >
                  <Ionicons name="search" size={24} color="#fff" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.notificationButton}
                  onPress={() => navigation.navigate('Notifications')}
                >
                  <Ionicons name="notifications-outline" size={24} color="#fff" />
                  {unreadNotifications > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                <UserMenu navigation={navigation} />
              </View>
            </View>
          </LinearGradient>
        </View>
      
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Ionicons 
            name="list-outline" 
            size={18} 
            color={activeTab === 'all' ? '#ffffff' : '#666'} 
            style={styles.tabIcon} 
          />
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'lost' && styles.activeLostTab]}
          onPress={() => setActiveTab('lost')}
        >
          <Ionicons 
            name="search-outline" 
            size={18} 
            color={activeTab === 'lost' ? '#ffffff' : '#666'} 
            style={styles.tabIcon} 
          />
          <Text style={[styles.tabText, activeTab === 'lost' && styles.lostTabText]}>
            Lost
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'found' && styles.activeFoundTab]}
          onPress={() => setActiveTab('found')}
        >
          <Ionicons 
            name="checkmark-circle-outline" 
            size={18} 
            color={activeTab === 'found' ? '#ffffff' : '#666'} 
            style={styles.tabIcon} 
          />
          <Text style={[styles.tabText, activeTab === 'found' && styles.foundTabText]}>
            Found
          </Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3266a8" />
          <Text style={styles.loadingText}>Loading items...</Text>
        </View>
      ) : (
        <View style={styles.flatListContainer}>
          <FlatList
            data={filterItems()}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmptyList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#3266a8']}
                tintColor={'#3266a8'}
              />
            }
          />
        </View>
      )}
        <View style={styles.fabContainer}>
          <TouchableOpacity 
            style={styles.fabButton}
            onPress={() => navigation.navigate('ReportItem')}
          >
            <LinearGradient
              colors={['#3266a8', '#23406e']}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ImageBackground>
      
      {/* Show WelcomeModal first, then tutorial */}
      <WelcomeModal 
        visible={showWelcome} 
        onClose={handleWelcomeClose} 
      />
      {renderTutorialModal()}
      {renderSearchModal()}
      
      <ProfessionalAlert
         visible={alertConfig.visible}
         title={alertConfig.title}
         message={alertConfig.message}
         type={alertConfig.type}
         buttons={alertConfig.buttons}
         onDismiss={hideAlert}
       />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },

  tutorialOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tutorialCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(50, 102, 168, 0.1)',
  },
  tutorialIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'center',
    shadowColor: '#3266a8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'rgba(50, 102, 168, 0.1)',
  },
  tutorialTitle: {
    fontSize: scaleFont(22),
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: scaleFont(28),
  },
  tutorialDescription: {
    fontSize: scaleFont(16),
    color: '#555',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: scaleFont(24),
    paddingHorizontal: 8,
    fontWeight: '400',
  },
  tutorialStepIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 3,
    transition: 'all 0.3s ease',
  },
  activeDot: {
    backgroundColor: '#3266a8',
    width: 12,
    height: 12,
    borderRadius: 6,
    transform: [{ scale: 1.2 }],
  },
  tutorialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  tutorialButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  skipButton: {
    backgroundColor: '#f8f9fa',
  },
  skipButtonText: {
    color: '#666',
    fontWeight: '500',
    fontSize: scaleFont(14),
  },
  nextButton: {
    backgroundColor: '#3266a8',
    paddingHorizontal: 32,
    minWidth: 120,
    shadowColor: '#3266a8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: scaleFont(16),
    letterSpacing: 0.5,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // Removed full background overlay
  headerContainer: {
    width: '100%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 10,
  },
  header: {
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  titleContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    marginLeft: 48,
    letterSpacing: 0.3,
  },
  logoImage: {
    width: 32,
    height: 32,
    marginRight: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 120,
  },
  headerSearchButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    height: 40,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    height: 40,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    transition: 'all 0.2s ease',
  },
  activeTab: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  activeLostTab: {
    backgroundColor: '#e74c3c',
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  activeFoundTab: {
    backgroundColor: '#27ae60',
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: scaleFont(13),
    letterSpacing: 0.2,
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  lostTabText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  foundTabText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  searchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  searchContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 50,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
  },
  clearButton: {
    padding: 4,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: '#3266a8',
    fontWeight: '600',
    fontSize: 16,
  },
  searchContent: {
    flex: 1,
  },
  searchEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  searchEmptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
    textAlign: 'center',
  },
  searchEmptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  searchResultsList: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 8,
    borderRadius: 8,
  },
  loadingText: {
    color: '#2c3e50',
    marginTop: 8,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 190,
  },
  flatListContainer: {
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  emptyText: {
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 16,
    letterSpacing: 0.2,
  },
  emptySubtext: {
    fontSize: scaleFont(15),
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
    maxWidth: '90%',
    fontWeight: '500',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
  fabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Wrap HomeScreen with internet guard to block access when offline
export default withInternetGuard(HomeScreen);
