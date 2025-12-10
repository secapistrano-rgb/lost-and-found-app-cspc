import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
  SectionList,
  Animated,
  Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MatchCard from '../components/MatchCard';
import { getUser } from '../../../shared/storage/storage';
import { getMatchesByUser, deleteMatches, deleteMatch, runRematchForItems } from '../../../config/apiConfig';
import { runMatchingProcess } from '../services/matchingService';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';


const { width } = Dimensions.get('window');

const MatchesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedMatches, setSelectedMatches] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const scrollY = new Animated.Value(0);
  const autoRefreshInterval = useRef(null);
  const isScreenFocused = useRef(true);
  const previousMatches = useRef([]);
  
  const { alertConfig, showError, showSuccess, showInfo, showAlert, hideAlert } = useProfessionalAlert();
  const styles = createStyles(insets);
  
  // Animation for header
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });
  
  const headerElevation = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 5],
    extrapolate: 'clamp',
  });
  
  useEffect(() => {
    const setup = async () => {
      // Load user data
      const userData = await getUser();
      console.log('MatchesScreen - User data loaded:', userData);
      setUser(userData);
      
      // Load all data and find matches with the loaded user data
      if (userData && userData.email) {
        await loadAllData(userData);
      } else {
        console.log('MatchesScreen - No valid user data, skipping match loading');
        setLoading(false);
      }
    };
    
    setup();
    
    return () => {
       stopAutoRefresh();
     };
  }, []);

  // Focus effect to refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('MatchesScreen - Screen focused, refreshing data');
      isScreenFocused.current = true;
      
      if (user && user.email) {
        // Force a fresh load from the database when screen comes into focus
        loadAllData(user);
      }
      
      // Start auto-refresh when screen is focused
      startAutoRefresh();
      
      return () => {
         // Stop auto-refresh when screen loses focus
         isScreenFocused.current = false;
         stopAutoRefresh();
       };
    }, [user])
  );

  // Start auto-refresh when user is loaded
  useEffect(() => {
    if (user && user.email && isScreenFocused.current) {
      startAutoRefresh();
    }
    return () => {
      stopAutoRefresh();
    };
  }, [user]);

  // Auto-refresh system with anti-blink mechanism
  const startAutoRefresh = () => {
    if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
    }
    
    autoRefreshInterval.current = setInterval(() => {
      if (isScreenFocused.current && user && user.email && !loading && !refreshing && !selectionMode) {
        performSilentRefresh();
      }
    }, 1000); // 1 second interval
  };

  const stopAutoRefresh = () => {
    if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
      autoRefreshInterval.current = null;
    }
  };

  const performSilentRefresh = async () => {
    try {
      setIsAutoRefreshing(true);
      
      // Silent refresh without showing loading indicators
      const { newMatchesCount } = await runMatchingProcess();
      await loadMatches(user, true); // Pass silent flag
      
      // Only show notification for new matches, not for routine refresh
      if (newMatchesCount > 0) {
        showSuccess(
          'New Matches Found',
          `Found ${newMatchesCount} new potential matches between lost and found items.`
        );
      }
    } catch (error) {
      console.error('Error during silent refresh:', error);
      // Don't show error alerts for silent refresh to avoid interrupting user
    } finally {
      setIsAutoRefreshing(false);
    }
  };


  
  const loadAllData = async (userData = user) => {
    setLoading(true);
    try {
      // Run the matching process to find new matches
      const { newMatchesCount, highScoreMatches } = await runMatchingProcess();
      
      // Load matches after the matching process
      await loadMatches(userData);
      
      // Show alert if new matches were found
      if (newMatchesCount > 0) {
        showSuccess(
          'New Matches Found',
          `Found ${newMatchesCount} new potential matches between lost and found items.`
        );
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const loadMatches = async (userData = user, silent = false, returnData = false) => {
    try {
      if (!userData || !userData.email) {
        console.log('MatchesScreen - No user found for loading matches. User:', userData);
        setMatches([]);
        return;
      }

      console.log('MatchesScreen - Loading matches for user:', userData.email);
      // Get matches for the current user from API
      const userMatches = await getMatchesByUser(userData.email) || [];
      console.log('MatchesScreen - API returned matches:', userMatches.length, 'matches');
      console.log('MatchesScreen - Raw matches data:', JSON.stringify(userMatches, null, 2));
      console.log('MatchesScreen - First match data:', userMatches[0]);
      
      // Transform API response to match expected format
      const transformedMatches = userMatches.map(match => ({
        ...match,
        lostItem: {
          id: match.lost_item_id,
          title: match.lost_item_title,
          description: match.lost_item_description,
          category: match.lost_item_category,
          location: match.lost_item_location,
          reporterId: match.lost_item_reporter_email,
          reporterName: match.lost_item_reporter_name,
          dateReported: match.lost_item_date_reported,
          // Use transformed image URL first, then fall back to raw images data
          imageUri: match.lost_item_image_url || (match.lost_item_images ? (Array.isArray(match.lost_item_images) ? match.lost_item_images[0] : match.lost_item_images) : null)
        },
        foundItem: {
          id: match.found_item_id,
          title: match.found_item_title,
          description: match.found_item_description,
          category: match.found_item_category,
          location: match.found_item_location,
          reporterId: match.found_item_reporter_email,
          reporterName: match.found_item_reporter_name,
          dateReported: match.found_item_date_reported,
          // Use transformed image URL first, then fall back to raw images data
          imageUri: match.found_item_image_url || (match.found_item_images ? (Array.isArray(match.found_item_images) ? match.found_item_images[0] : match.found_item_images) : null)
        },
        score: parseFloat(match.score)
      }));
      
      // Group matches by status for better organization
      const groupedMatches = [
        {
          title: 'Pending Matches',
          data: transformedMatches.filter(match => match.status === 'pending')
        },
        {
          title: 'Accepted Matches', 
          data: transformedMatches.filter(match => match.status === 'accepted')
        },
        {
          title: 'Rejected Matches',
          data: transformedMatches.filter(match => match.status === 'rejected')
        },
        {
          title: 'Resolved Matches',
          data: transformedMatches.filter(match => match.status === 'resolved')
        }
      ].filter(section => section.data.length > 0); // Only show sections with data
      
      console.log('MatchesScreen - Grouped matches:', JSON.stringify(groupedMatches, null, 2));
      console.log('MatchesScreen - Setting matches state with', groupedMatches.length, 'sections');
      
      // Log status distribution for debugging
      const statusCounts = transformedMatches.reduce((acc, match) => {
        acc[match.status] = (acc[match.status] || 0) + 1;
        return acc;
      }, {});
      console.log('MatchesScreen - Status distribution:', statusCounts);
      
      setMatches(groupedMatches);
      
      // Return flat matches array for status comparison if requested
      if (returnData) {
        return transformedMatches;
      }
    } catch (error) {
      console.error('Error loading matches:', error);
      if (!silent) {
        showError('Error', 'Failed to load matches. Please try again.');
      }
      setMatches([]);
      
      if (returnData) {
        return [];
      }
    }
  };
  

  

  

  
  const handleRefresh = () => {
    setRefreshing(true);
    // Stop auto refresh during manual refresh to prevent conflicts
    stopAutoRefresh();
    
    if (user && user.email) {
      loadAllData(user).finally(() => {
        // Restart auto refresh after manual refresh completes
        if (isScreenFocused.current) {
          startAutoRefresh();
        }
      });
    } else {
      setRefreshing(false);
      setLoading(false);
      if (isScreenFocused.current) {
        startAutoRefresh();
      }
    }
  };
  
  const handleMatchPress = (match) => {
    navigation.navigate('MatchDetails', { match });
  };
  
  const handleSendMatch = async (match) => {
    // Navigate to match details for further actions
    navigation.navigate('MatchDetails', { match });
  };

  const handleDeleteMatch = async (match) => {
    showAlert(
      'Delete Match',
      'Are you sure you want to delete this match? The system will automatically search for other potential matches.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Delete the match and get deleted match info
              const response = await deleteMatch(match.id);
              
              console.log('Match deleted:', response);
              
              // Trigger re-matching for the involved items
              if (response.deletedMatch) {
                const { lostItemId, foundItemId } = response.deletedMatch;
                
                console.log('Triggering re-match for items:', { lostItemId, foundItemId });
                
                // Run re-matching on the server
                try {
                  const rematchResult = await runRematchForItems([lostItemId], [foundItemId]);
                  console.log('Re-matching completed:', rematchResult);
                } catch (matchError) {
                  console.warn('Could not trigger re-matching:', matchError);
                  // Don't show error to user, just log it
                }
              }
              
              // Refresh the matches list
              await loadMatches(user);
              showSuccess('Match Deleted', 'The match has been deleted and new potential matches are being searched.');
            } catch (error) {
              console.error('Error deleting match:', error);
              showError('Error', 'Failed to delete match. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Respond to match functionality removed

  const handleLongPress = (match) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedMatches([match.id]);
    }
  };

  const handleToggleSelection = (match) => {
    if (selectionMode) {
      setSelectedMatches(prev => {
        if (prev.includes(match.id)) {
          const newSelection = prev.filter(id => id !== match.id);
          if (newSelection.length === 0) {
            setSelectionMode(false);
          }
          return newSelection;
        } else {
          return [...prev, match.id];
        }
      });
    } else {
      handleMatchPress(match);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedMatches.length === 0) return;

    showAlert({
      title: 'Delete Matches',
      message: `Are you sure you want to delete ${selectedMatches.length} selected match${selectedMatches.length > 1 ? 'es' : ''}? The system will automatically search for other potential matches.`,
      type: 'confirm',
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Delete the matches and get deleted matches info
              const response = await deleteMatches(selectedMatches);
              
              console.log('Matches deleted:', response);
              
              // Trigger re-matching for all involved items
              if (response.deletedMatches && response.deletedMatches.length > 0) {
                console.log('Triggering re-match for deleted matches');
                
                // Collect unique item IDs
                const lostItemIds = [...new Set(response.deletedMatches.map(m => m.lostItemId))];
                const foundItemIds = [...new Set(response.deletedMatches.map(m => m.foundItemId))];
                
                console.log(`Re-matching ${lostItemIds.length} lost items with ${foundItemIds.length} found items`);
                
                // Run re-matching on the server
                try {
                  const rematchResult = await runRematchForItems(lostItemIds, foundItemIds);
                  console.log('Re-matching completed:', rematchResult);
                } catch (matchError) {
                  console.warn('Could not trigger re-matching:', matchError);
                  // Don't show error to user, just log it
                }
              }
              
              setSelectedMatches([]);
              setSelectionMode(false);
              await loadMatches(user);
              showSuccess('Matches Deleted', `${selectedMatches.length} match${selectedMatches.length > 1 ? 'es' : ''} deleted successfully. New potential matches are being searched.`);
            } catch (error) {
              console.error('Error deleting matches:', error);
              showError('Error', 'Failed to delete matches. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    });
  };

  const handleCancelSelection = () => {
    setSelectedMatches([]);
    setSelectionMode(false);
  };

  const renderItem = ({ item }) => {
    return (
      <MatchCard 
        match={item} 
        onPress={selectionMode ? handleToggleSelection : handleMatchPress}
        onLongPress={handleLongPress}
        currentUser={user}
        onSendMatch={handleSendMatch}
        isSelected={selectedMatches.includes(item.id)}
        selectionMode={selectionMode}
      />
    );
  };
  
  const renderSectionHeader = ({ section }) => {
    // Determine background gradient colors based on section type
    let gradientColors;
    let iconName;
    
    switch(section.key) {
      case 'pending':
        gradientColors = ['#3266a8', '#2a5490'];
        iconName = 'search';
        break;
      case 'resolved':
        gradientColors = ['#28a745', '#1e7e34'];
        iconName = 'checkmark-circle';
        break;
      case 'rejected':
        gradientColors = ['#e74c3c', '#c0392b'];
        iconName = 'close-circle';
        break;
      default:
        gradientColors = ['#3266a8', '#2a5490'];
        iconName = 'search';
    }
    
    return (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sectionHeader}
      >
        <View style={styles.sectionHeaderContent}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name={iconName} size={18} color="#fff" style={styles.sectionIcon} />
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        </View>
      </LinearGradient>
    );
  };
  
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="git-compare-outline" size={64} color="#666" />
      <Text style={styles.emptyText}>No matches found</Text>
      <Text style={styles.emptySubtext}>
        When we find potential matches between lost and found items, they will appear here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#3266a8" />
      <View style={styles.container}>
        <Animated.View style={[styles.header, { elevation: headerElevation }]}>
          <View style={styles.headerBackground} />
          <LinearGradient
            colors={['#3266a8', '#2a5490']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerTitleContent}>
                <Ionicons name="git-compare-outline" size={22} color="#fff" style={styles.headerIcon} />
                <Text style={styles.headerTitle}>Matches</Text>
              </View>
              <View style={styles.headerIndicators}>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3266a8" />
            <Text style={styles.loadingText}>Loading matches...</Text>
          </View>
        ) : matches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No matches found</Text>
            <Text style={styles.emptySubtext}>
              We'll notify you when we find potential matches between lost and found items.
            </Text>
          </View>
        ) : (
          <Animated.SectionList
            sections={matches}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#3266a8']}
                tintColor="#3266a8"
                progressBackgroundColor="rgba(255, 255, 255, 0.2)"
                progressViewOffset={80}
                title="Pull to refresh"
                titleColor="#3266a8"
              />
            }
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            ListEmptyComponent={matches.length === 0 && !loading ? renderEmptyList : null}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
        
        {/* Selection mode action buttons */}
        {selectionMode && (
          <View style={styles.selectionActionBar}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancelSelection}
            >
              <Ionicons name="close" size={20} color="#666" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <View style={styles.selectionInfo}>
              <Text style={styles.selectionText}>
                {selectedMatches.length} selected
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.deleteButton, selectedMatches.length === 0 && styles.deleteButtonDisabled]}
              onPress={handleDeleteSelected}
              disabled={selectedMatches.length === 0}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <ProfessionalAlert
           visible={alertConfig.visible}
           type={alertConfig.type}
           title={alertConfig.title}
           message={alertConfig.message}
           buttons={alertConfig.buttons}
           onDismiss={hideAlert}
         />
      </View>
    </SafeAreaView>
  );
};

const createStyles = (insets) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#f8f9fa',
    paddingTop: insets?.top || 30,
  },
  headerGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerTitleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },



  sectionHeader: {
    marginTop: 1.5,
    marginBottom: 19,
    marginHorizontal: 10,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionCount: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 60, // Add space for the header
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100, // Add space for the header
  },
  emptyText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  listContent: {
    padding: 10,
    paddingTop: 80 + (insets?.top || 0), // Add space for the header
    paddingBottom: 1.5 + (insets?.bottom || 0), // Minimal bottom spacing
  },
  selectionActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectionInfo: {
    flex: 1,
    alignItems: 'center',
  },
  selectionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e74c3c',
  },
  deleteButtonDisabled: {
    backgroundColor: '#ccc',
  },
  deleteButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  }
});

export default MatchesScreen;
