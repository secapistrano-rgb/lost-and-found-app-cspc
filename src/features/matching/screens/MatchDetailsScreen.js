import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  ScrollView, 
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  AppState
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getLostItems, getFoundItems, saveMatches, getMatches, updateMatchStatus } from '../../../shared/storage/storage';
import { getClaimsByMatch, updateItemStatus, getMatchById } from '../../../config/apiConfig';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkAndUpdateAchievements } from '../../../shared/utils/achievementSystem';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';

// Import MapView conditionally to prevent crashes
let MapView, Marker;
try {
  const MapComponent = require('react-native-maps');
  MapView = MapComponent.default;
  Marker = MapComponent.Marker;
} catch (error) {
  console.warn('react-native-maps could not be loaded', error);
  MapView = null;
  Marker = null;
}

const MarkAsFoundStatus = {
  PENDING: 'pending',
  RESOLVED: 'resolved'
};

const MatchDetailsScreen = ({ route, navigation }) => {
  const { match } = route.params;
  const { lostItem, foundItem, score } = match;
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchStatus, setMatchStatus] = useState(match.status || MarkAsFoundStatus.PENDING);
  const [refreshing, setRefreshing] = useState(false);
  const [matchData, setMatchData] = useState(match);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasApprovedClaim, setHasApprovedClaim] = useState(false);
  const [hasPendingClaim, setHasPendingClaim] = useState(false);
  
  const { alertConfig, showError, showSuccess, showConfirm, hideAlert } = useProfessionalAlert();
  const insets = useSafeAreaInsets();
  const styles = createStyles(insets);
  
  // Helper function to get the correct image URI from different possible field names
  const getImageUri = (item) => {
    if (!item) return null;
    
    // Check for different possible image field names in order of preference
    return item.imageUri || item.image_url || item.imageUrl || null;
  };
  
  // Check for claim requests for this match
  const checkForClaims = async () => {
    try {
      // Check for approved claims
      const approvedClaims = await getClaimsByMatch(match.id, { status: 'approved' });
      const hasApproved = approvedClaims && approvedClaims.length > 0;
      setHasApprovedClaim(hasApproved);
      
      // Check for pending claims by current user
      const pendingClaims = await getClaimsByMatch(match.id, { status: 'pending' });
      const userEmail = userData?.email;
      const hasPending = pendingClaims && pendingClaims.some(claim => claim.claimantEmail === userEmail);
      setHasPendingClaim(hasPending);
    } catch (error) {
      console.error('Error checking for claims:', error);
      // Fallback to AsyncStorage if API fails
      try {
        const claimsString = await AsyncStorage.getItem('claimRequests');
        if (claimsString) {
          const claims = JSON.parse(claimsString);
          const approvedClaim = claims.find(
            claim => claim.matchId === match.id && claim.status === 'approved'
          );
          setHasApprovedClaim(!!approvedClaim);
          
          const userEmail = userData?.email;
          const pendingClaim = claims.find(
            claim => claim.matchId === match.id && claim.status === 'pending' && claim.claimantEmail === userEmail
          );
          setHasPendingClaim(!!pendingClaim);
        }
      } catch (fallbackError) {
        console.error('Error with fallback claim check:', fallbackError);
      }
    }
  };

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('user_data');
        if (userDataString) {
          const user = JSON.parse(userDataString);
          setUserData(user);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
    checkForClaims();
  }, []);
  
  // Periodic status checking to automatically refresh match status when screen is focused
  useEffect(() => {
    let statusCheckInterval;
    
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        // Start polling when app becomes active
        statusCheckInterval = setInterval(() => {
          // Only check if not currently refreshing and match is not resolved
      if (!refreshing && matchStatus !== MarkAsFoundStatus.RESOLVED) {
        refreshMatchData(false); // Silent refresh - no loading indicator
      }
        }, 2000); // Check every 2 seconds
      } else {
        // Stop polling when app goes to background
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          statusCheckInterval = null;
        }
      }
    };
    
    // Start polling immediately if app is active
    if (AppState.currentState === 'active') {
      statusCheckInterval = setInterval(() => {
        if (!refreshing && matchStatus !== MarkAsFoundStatus.RESOLVED) {
          refreshMatchData(false); // Silent refresh - no loading indicator
        }
      }, 2000); // Check every 2 seconds
    }
    
    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
      subscription?.remove();
    };
  }, [refreshing, matchStatus]);
  
  // Format score as percentage
  const scorePercent = Math.round(score * 100);
  
  // Get match quality category based on score
  const getMatchQuality = (scorePercentage) => {
    if (scorePercentage >= 80) {
      return {
        label: 'Match',
        confidence: 'High Confidence',
        description: 'High confidence that these items are the same',
        color: '#27ae60',
        icon: 'checkmark-circle',
        bgColor: '#d4edda'
      };
    } else if (scorePercentage >= 50) {
      return {
        label: 'Possible Match',
        confidence: 'Medium Confidence',
        description: 'Ambiguous - Needs manual review',
        color: '#f39c12',
        icon: 'alert-circle',
        bgColor: '#fff3cd'
      };
    } else {
      return {
        label: 'Unmatched',
        confidence: 'Low Confidence',
        description: 'Unlikely to be the same item',
        color: '#e74c3c',
        icon: 'close-circle',
        bgColor: '#f8d7da'
      };
    }
  };
  
  const matchQuality = getMatchQuality(scorePercent);
  
  // Check if current user is the owner of the lost item
  const isLostItemOwner = userData && lostItem && lostItem.reporterId === userData.email;
  
  // Format date to a readable string
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Format date with time
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Refresh match data
  const refreshMatchData = async (showLoadingIndicator = true) => {
    try {
      // Only show loading indicator if explicitly requested (e.g., manual pull-to-refresh)
      if (showLoadingIndicator) {
        setRefreshing(true);
      }
      
      // First try to get the latest match data from the API
      try {
        const apiMatch = await getMatchById(match.id);
        if (apiMatch) {
          setMatchData(apiMatch);
          setMatchStatus(apiMatch.status || MarkAsFoundStatus.PENDING);
        }
      } catch (apiError) {
        console.warn('Failed to fetch match from API, falling back to local storage:', apiError);
        
        // Fallback to local storage if API fails
        const allMatches = await getMatches();
        const updatedMatch = allMatches.find(m => m.id === match.id);
        
        if (updatedMatch) {
          setMatchData(updatedMatch);
          setMatchStatus(updatedMatch.status || MarkAsFoundStatus.PENDING);
        }
      }
      
      // Also refresh the claim status
      await checkForClaims();
    } catch (error) {
      console.error('Error refreshing match data:', error);
    } finally {
      if (showLoadingIndicator) {
        setRefreshing(false);
      }
    }
  };
  
  // Handle marking the lost item as found
  const handleMarkAsFound = async () => {
    // Check if there's an approved claim request first
    if (!hasApprovedClaim) {
      showError(
        'Claim Required',
        'You can only mark this item as found after a claim request has been approved and settled.'
      );
      return;
    }

    try {
      setIsProcessing(true);
      
      // Update the lost item status to 'claimed' and found item status to 'returned'
      await updateItemStatus(lostItem.id, 'claimed');
      await updateItemStatus(foundItem.id, 'returned');
      
      // Get all matches
      const allMatches = await getMatches() || [];
      
      // Find the current match and update its status
      const updatedMatches = allMatches.map(m => {
        if (m.id === match.id) {
          return {
            ...m,
            status: MarkAsFoundStatus.RESOLVED,
            resolvedAt: new Date().toISOString()
          };
        }
        return m;
      });
      
      // Save the updated matches
      await saveMatches(updatedMatches);
      
      // Track achievement for matching items
      try {
        if (userData && userData.email) {
          await checkAndUpdateAchievements(
            userData.email,
            'match_items',
            { 
              matchId: match.id,
              lostItemId: lostItem.id,
              foundItemId: foundItem.id,
              matchScore: score
            }
          );
        }
      } catch (achievementError) {
        console.error('Error tracking match achievement:', achievementError);
        // Continue even if achievement tracking fails
      }
      
      // Update local state
      setMatchStatus(MarkAsFoundStatus.RESOLVED);
      
      // Navigate back to home screen with resolved flag
      showSuccess(
        'Item Marked as Claimed',
        'The lost item has been marked as claimed and the found item as returned. Both items will be removed from active listings.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              navigation.navigate('Main', { 
                screen: 'Home',
                params: { 
                  itemResolved: true,
                  resolvedItemId: lostItem.id,
                  matchId: match.id
                }
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error marking item as found:', error);
      showError('Error', 'Failed to mark the items as claimed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Match Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Match Details</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        scrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshMatchData}
            colors={['#007bff']}
            tintColor="#007bff"
          />
        }
      >
        <View style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>Match Score</Text>
          
          {/* Score Circle */}
          <View style={[styles.scoreCircle, { backgroundColor: matchQuality.bgColor, borderColor: matchQuality.color }]}>
            <Ionicons name={matchQuality.icon} size={28} color={matchQuality.color} />
            <Text style={[styles.scoreValue, { color: matchQuality.color }]}>{scorePercent}%</Text>
          </View>
          
          {/* Match Quality Label */}
          <Text style={[styles.matchQualityLabel, { color: matchQuality.color }]}>
            {matchQuality.label}
          </Text>
          
          {/* Confidence Badge */}
          <View style={[styles.confidenceBadge, { backgroundColor: matchQuality.bgColor, borderColor: matchQuality.color }]}>
            <Text style={[styles.confidenceText, { color: matchQuality.color }]}>
              {matchQuality.confidence}
            </Text>
          </View>
          
          {/* Description */}
          <Text style={[styles.matchQualityDescription, { color: matchQuality.color }]}>
            {matchQuality.description}
          </Text>
          
          {/* Score Range Reference */}
          <View style={styles.scoreRangeInfo}>
            <View style={styles.rangeItem}>
              <View style={[styles.rangeDot, { backgroundColor: '#27ae60' }]} />
              <Text style={styles.rangeText}>80-100%: High Confidence Match</Text>
            </View>
            <View style={styles.rangeItem}>
              <View style={[styles.rangeDot, { backgroundColor: '#f39c12' }]} />
              <Text style={styles.rangeText}>50-79%: Possible Match - Review Needed</Text>
            </View>
          </View>
          
          {/* Disclaimer */}
          <Text style={styles.scoreDescription}>
            This score is based on potential similarity matches in image, description, categories, objects, location, and date proximity. Please take note, this is a probabilistic score and not a certainty. Check it first before requesting claims.
          </Text>
          
          {/* Match date and time */}
          <View style={styles.matchDateContainer}>
            <Ionicons name="time-outline" size={16} color="#666" style={styles.icon} />
            <Text style={styles.matchDateText}>
              Match found on {formatDateTime(match.createdAt || new Date())}
            </Text>
          </View>
        </View>
        
        <View style={styles.comparisonContainer}>
          <View style={styles.itemColumn}>
            <View style={[styles.itemHeader, styles.lostHeader]}>
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.itemHeaderText}>Lost Item</Text>
            </View>
            
            {getImageUri(lostItem) ? (
              <Image 
                source={{ uri: getImageUri(lostItem) }} 
                style={styles.itemImage}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.itemImage, styles.placeholderImage]}>
                <Ionicons name="image-outline" size={32} color="#ccc" />
              </View>
            )}
            
            <View style={styles.itemDetails}>
              <Text style={styles.itemTitle}>
                {lostItem.title || `Lost ${lostItem.categories?.[0] || 'Item'}`}
              </Text>
              
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color="#666" style={styles.icon} />
                <Text style={styles.infoText}>
                  {formatDate(lostItem.date || lostItem.createdAt || new Date())}
                </Text>
              </View>
              
              {lostItem.location && (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color="#666" style={styles.icon} />
                  <Text style={styles.infoText}>{lostItem.location}</Text>
                </View>
              )}
              
              <Text style={styles.descriptionLabel}>Description:</Text>
              <Text style={styles.description}>
                {lostItem.description || 'No description provided'}
              </Text>
              
              {lostItem.categories && lostItem.categories.length > 0 && (
                <View style={styles.categoriesContainer}>
                  {lostItem.categories.map((category, index) => (
                    <View key={index} style={styles.category}>
                      <Text style={styles.categoryText}>{category}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.itemColumn}>
            <View style={[styles.itemHeader, styles.foundHeader]}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.itemHeaderText}>Found Item</Text>
            </View>
            
            {getImageUri(foundItem) ? (
              <Image 
                source={{ uri: getImageUri(foundItem) }} 
                style={styles.itemImage}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.itemImage, styles.placeholderImage]}>
                <Ionicons name="image-outline" size={32} color="#ccc" />
              </View>
            )}
            
            <View style={styles.itemDetails}>
              <Text style={styles.itemTitle}>
                {foundItem.title || `Found ${foundItem.categories?.[0] || 'Item'}`}
              </Text>
              
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color="#666" style={styles.icon} />
                <Text style={styles.infoText}>
                  {formatDate(foundItem.date || foundItem.createdAt || new Date())}
                </Text>
              </View>
              
              {foundItem.location && (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color="#666" style={styles.icon} />
                  <Text style={styles.infoText}>{foundItem.location}</Text>
                </View>
              )}
              
              <Text style={styles.descriptionLabel}>Description:</Text>
              <Text style={styles.description}>
                {foundItem.description || 'No description provided'}
              </Text>
              
              {foundItem.categories && foundItem.categories.length > 0 && (
                <View style={styles.categoriesContainer}>
                  {foundItem.categories.map((category, index) => (
                    <View key={index} style={styles.category}>
                      <Text style={styles.categoryText}>{category}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
        
        {/* Map section to show locations of both items */}
        {(lostItem.latitude && lostItem.longitude) || (foundItem.latitude && foundItem.longitude) ? (
          <View style={styles.mapSection}>
            <Text style={styles.mapTitle}>Location Information</Text>
            <Text style={styles.mapSubtitle}>
              View locations where items were lost/found
            </Text>
            
            {MapView ? (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: lostItem.latitude || foundItem.latitude || 13.5491,
                    longitude: lostItem.longitude || foundItem.longitude || 123.0054,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                >
                  {lostItem.latitude && lostItem.longitude && (
                    <Marker
                      coordinate={{
                        latitude: lostItem.latitude,
                        longitude: lostItem.longitude,
                      }}
                      title="Lost Item Location"
                      description={lostItem.location || 'Item was lost here'}
                      pinColor="red"
                    />
                  )}
                  {foundItem.latitude && foundItem.longitude && (
                    <Marker
                      coordinate={{
                        latitude: foundItem.latitude,
                        longitude: foundItem.longitude,
                      }}
                      title="Found Item Location"
                      description={foundItem.location || 'Item was found here'}
                      pinColor="green"
                    />
                  )}
                </MapView>
              </View>
            ) : (
              <View style={[styles.mapContainer, styles.mapFallback]}>
                <Ionicons name="map-outline" size={48} color="#ccc" />
                <Text style={styles.mapFallbackText}>Map not available</Text>
              </View>
            )}
            
            {lostItem.latitude && lostItem.longitude && (
              <TouchableOpacity 
                style={styles.directionsButton}
                onPress={() => {
                  const url = Platform.select({
                    ios: `maps:${lostItem.latitude},${lostItem.longitude}`,
                    android: `geo:${lostItem.latitude},${lostItem.longitude}`,
                  });
                  Linking.openURL(url);
                }}
              >
                <Ionicons name="navigate-outline" size={16} color="#fff" style={{marginRight: 8}} />
                <Text style={styles.directionsButtonText}>Get Directions to Lost Location</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

      </ScrollView>
      
      <ProfessionalAlert
         visible={alertConfig.visible}
         type={alertConfig.type}
         title={alertConfig.title}
         message={alertConfig.message}
         buttons={alertConfig.buttons}
         onDismiss={hideAlert}
       />
      
      <View style={styles.actionContainer}>
        <View style={styles.actionButtonsRow}>
          {matchStatus === MarkAsFoundStatus.PENDING ? (
            hasApprovedClaim ? (
              <TouchableOpacity 
                style={[styles.actionButton, styles.markFoundButton]}
                disabled={isProcessing}
                onPress={handleMarkAsFound}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#fff" style={{marginRight: 8}} />
                    <Text style={styles.actionButtonText}>Mark as Claimed</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={[styles.actionButton, styles.disabledClaimButton]}>
                <Ionicons name="lock-closed-outline" size={22} color="#ccc" style={{marginRight: 8}} />
                <Text style={styles.disabledActionButtonText}>Claim Must Be Approved First</Text>
              </View>
            )
          ) : (
            <View style={styles.resolvedContainer}>
              <Ionicons name="checkmark-circle" size={22} color="#28a745" style={{marginRight: 8}} />
              <Text style={styles.resolvedText}>Item Returned</Text>
            </View>
          )}
          
          {isLostItemOwner ? (
            matchStatus === MarkAsFoundStatus.RESOLVED ? (
              <View style={[styles.actionButton, styles.disabledClaimButton]}>
                <Ionicons name="checkmark-circle" size={22} color="#28a745" style={{marginRight: 8}} />
                <Text style={styles.disabledActionButtonText}>Item Already Returned</Text>
              </View>
            ) : hasPendingClaim ? (
              <View style={[styles.actionButton, styles.disabledClaimButton]}>
                <Ionicons name="time-outline" size={22} color="#ffc107" style={{marginRight: 8}} />
                <Text style={styles.disabledActionButtonText}>Claim Request Pending</Text>
              </View>
            ) : hasApprovedClaim ? (
              <View style={[styles.actionButton, styles.disabledClaimButton]}>
                <Ionicons name="checkmark-done" size={22} color="#28a745" style={{marginRight: 8}} />
                <Text style={styles.disabledActionButtonText}>Claim Already Approved</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={[styles.actionButton, styles.claimButton]}
                onPress={() => navigation.navigate('ClaimItem', { 
                  matchId: match.id,
                  itemTitle: lostItem.title || 'item',
                  foundItem: foundItem,
                  lostItem: lostItem
                })}
              >
                <Ionicons name="hand-left-outline" size={22} color="#fff" style={{marginRight: 8}} />
                <Text style={styles.actionButtonText}>Request to Claim</Text>
              </TouchableOpacity>
            )
          ) : (
            <View style={[styles.actionButton, styles.disabledClaimButton]}>
              <Ionicons name="lock-closed-outline" size={22} color="#ccc" style={{marginRight: 8}} />
              <Text style={styles.disabledActionButtonText}>Only Lost Item Owner Can Claim</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (insets = { bottom: 0 }) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop:31,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: Math.max(140 + insets.bottom, 140), // Dynamic bottom padding for system navigation
  },
  scoreCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 4,
  },
  matchQualityLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  confidenceBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchQualityDescription: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  scoreRangeInfo: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  rangeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  rangeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  rangeText: {
    fontSize: 11,
    color: '#495057',
    flex: 1,
    fontWeight: '500',
  },
  scoreDescription: {
    fontSize: 11,
    color: '#666',
    textAlign: 'justify',
    marginTop: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  matchDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  matchDateText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  comparisonContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  itemColumn: {
    flex: 1,
  },
  divider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  lostHeader: {
    backgroundColor: '#dc3545',
  },
  foundHeader: {
    backgroundColor: '#28a745',
  },
  itemHeaderText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  itemImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#f0f0f0',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    padding: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  icon: {
    marginRight: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 8,
    marginBottom: 4,
  },
  description: {
    fontSize: 11,
    color: '#666',
    marginBottom: 8,
    textAlign: 'justify',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 8,
  },
  category: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  categoryText: {
    fontSize: 10,
    color: '#666',
  },
  actionContainer: {
    position: 'absolute',
    bottom: insets.bottom,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingTop: 2,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  markFoundButton: {
    backgroundColor: '#007bff',
    marginRight: 1.5,
    marginLeft: 10,
  },
  claimButton: {
    backgroundColor: '#28a745',
    marginLeft: 10,
  },
  disabledClaimButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginLeft: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  disabledActionButtonText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  resolvedContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4edda',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c3e6cb',
    marginRight: 1.5,
    marginLeft: 10,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resolvedText: {
    fontSize: 16,
    color: '#28a745',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  mapSection: {
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  mapSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  mapContainer: {
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapFallback: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapFallbackText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  directionsButton: {
    backgroundColor: '#007bff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  directionsButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});

// Wrap MatchDetailsScreen with internet guard to block access when offline
export default withInternetGuard(MatchDetailsScreen);
