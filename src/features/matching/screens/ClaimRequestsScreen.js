import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';
import { clearClaimRequests } from '../../../shared/utils/clearStorage';
import { getAllClaims, getClaimsByClaimant, deleteClaim, getUserByEmail, updateClaimStatus, updateItemStatus, API_CONFIG, getApiUrl } from '../../../config/apiConfig';
// Notification import removed - now handled by database triggers (see create_claim_notification_triggers.sql)
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';

const ClaimRequestsScreen = ({ navigation, route }) => {
  const [claimRequests, setClaimRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastClaimStatuses, setLastClaimStatuses] = useState({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedClaims, setSelectedClaims] = useState([]);
  const scrollY = new Animated.Value(0);
  const insets = useSafeAreaInsets();
  
  const { alertConfig, showInfo, showError, showSuccess, showConfirm, hideAlert } = useProfessionalAlert();
  
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
  
  const styles = createStyles();
  


  // Load user data and claim requests when screen mounts or when navigated to with new claim
  useEffect(() => {
    const fetchUserDataAndClaims = async () => {
      await fetchUserData();
      loadClaimRequests();
    };
    
    fetchUserDataAndClaims();
    
    // Check if we're coming from a new claim submission
    if (route.params?.newClaimSubmitted) {
      // Show a confirmation message
      setTimeout(() => {
        showSuccess(
          'Claim Request Visible',
          'Your claim request has been added to the list. You will be notified when its status changes.'
        );
        
        // Clear the parameter to avoid showing the message again on refresh
        navigation.setParams({ newClaimSubmitted: undefined });
      }, 500);
    }
  }, [navigation, route.params]);

  // Add focus listener to reload claims when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      // Reload claims whenever the screen comes into focus
      // Always fetch user data first, then load claims
      console.log('Screen focused, fetching user data and claims');
      await fetchUserData();
      // loadClaimRequests will be called after userData is set
    });

    return unsubscribe;
  }, [navigation]);

  // Set up periodic status checking for notifications
  useEffect(() => {
    let statusCheckInterval;
    
    if (userData && !isAdmin) {
      // Only check for regular users (not admins) every 2 seconds for real-time updates
      statusCheckInterval = setInterval(() => {
        checkForStatusChanges();
      }, 2000); // Check every 2 seconds for real-time notifications
    }
    
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [userData, isAdmin, lastClaimStatuses]);

  // Anti-Blink Auto-Refresh System - refresh claim requests every 1 second
  useEffect(() => {
    let autoRefreshInterval;
    
    if (userData && userData.email) {
      console.log('Setting up anti-blink auto-refresh for claim requests');
      autoRefreshInterval = setInterval(async () => {
        try {
          console.log('Auto-refreshing claim requests...');
          
          // Fetch fresh claim data
          let freshClaims = [];
          
          if (isAdmin) {
            freshClaims = await getAllClaims();
          } else {
            freshClaims = await getClaimsByClaimant(userData.email);
          }
          
          // Transform the fresh data
          const transformedFreshClaims = await Promise.all(freshClaims.map(async (claim) => {
            let userName = 'Unknown User';
            let userDepartment = 'Student';
            
            if (claim.google_user_id) {
              try {
                const userData = await getUserByEmail(claim.google_user_id);
                if (userData) {
                  userName = userData.full_name || userData.name || claim.google_user_id.split('@')[0];
                  userDepartment = userData.department || 'Student';
                } else {
                  userName = claim.google_user_id.split('@')[0];
                }
              } catch (error) {
                userName = claim.google_user_id.split('@')[0];
              }
            }
            
            return {
              id: claim.id,
              matchId: claim.match_id,
              itemTitle: `Item ${claim.item_id}`,
              proofOfOwnershipText: claim.proof_of_ownership,
              proofOfOwnershipImage: claim.image ? (
                typeof claim.image === 'string' && claim.image.startsWith('{') 
                  ? JSON.parse(claim.image) 
                  : claim.image
              ) : null,
              googleUserId: claim.google_user_id,
              userName: userName,
              contactName: userName,
              userDepartment: userDepartment,
              status: claim.status,
              createdAt: claim.created_at,
              updatedAt: claim.updated_at,
              lostItemId: claim.item_id,
              foundItemId: null,
              isLostItemOwner: false,
              isFoundItemOwner: false,
              claimType: claim.claim_type
            };
          }));
          
          // Sort by creation date (newest first)
          transformedFreshClaims.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          // Only update state if data has actually changed (anti-blink mechanism)
          const currentDataString = JSON.stringify(claimRequests);
          const freshDataString = JSON.stringify(transformedFreshClaims);
          
          if (currentDataString !== freshDataString) {
            console.log('Claim requests data changed, updating state');
            setClaimRequests(transformedFreshClaims);
            
            // Update claim statuses for status change detection
            const updatedStatuses = {};
            transformedFreshClaims.forEach(claim => {
              updatedStatuses[claim.id] = claim.status;
            });
            setLastClaimStatuses(updatedStatuses);
          } else {
            console.log('Claim requests data unchanged, skipping state update');
          }
          
          // Auto-resolve approved claims (check every refresh cycle)
          // DISABLED: Claims should stay approved until manually resolved
          // await autoResolveApprovedClaims();
        } catch (error) {
          console.error('Error during auto-refresh of claim requests:', error);
        }
      }, 1000); // Refresh every 1 second
    }
    
    return () => {
      if (autoRefreshInterval) {
        console.log('Cleaning up anti-blink auto-refresh interval');
        clearInterval(autoRefreshInterval);
      }
    };
  }, [userData, isAdmin, claimRequests]);
  
  // Fetch user data from Google Sign-In
  const fetchUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('user_data');
      if (userDataString) {
        const parsedUserData = JSON.parse(userDataString);
        setUserData(parsedUserData);
        
        // Check if user is an admin (for demo purposes, you might want to implement a proper admin check)
        // For now, we're considering users with specific email domains as admins
        const isAdminUser = parsedUserData.email && 
          (parsedUserData.email.includes('admin') || 
           parsedUserData.email.includes('faculty') || 
           parsedUserData.department === 'Admin');
        
        setIsAdmin(isAdminUser);
        
        // Load claims after setting user data
        console.log('User data loaded, now loading claims for:', parsedUserData.email);
        await loadClaimRequestsWithUserData(parsedUserData, isAdminUser);
      } else {
        // If no user data, redirect to login
        showError(
          'Login Required',
          'You must be logged in with your @my.cspc.edu.ph account to view claim requests.',
          [{ 
            text: 'OK', 
            onPress: () => navigation.navigate('Login')
          }]
        );
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Function to check for claim status changes and send notifications
  const checkForStatusChanges = async () => {
    try {
      console.log('=== POLLING STATUS CHANGES ===');
      console.log('Current time:', new Date().toISOString());
      console.log('User data:', userData?.email);
      console.log('Is admin:', isAdmin);
      console.log('Last claim statuses:', lastClaimStatuses);
      
      if (!userData || !userData.email || isAdmin) {
        console.log('Skipping status check - no user data or is admin');
        return; // Skip for admins or if no user data
      }
      
      // Fetch current claims
      console.log('Fetching current claims for user:', userData.email);
      const claims = await getClaimsByClaimant(userData.email);
      console.log('Current claims from API:', claims);
      
      // Check each claim for status changes
      for (const claim of claims) {
        const claimId = claim.id;
        const currentStatus = claim.status;
        const previousStatus = lastClaimStatuses[claimId];
        
        console.log(`Checking claim ${claimId}: previous=${previousStatus}, current=${currentStatus}`);
        
        // If we have a previous status and it's different from current
        if (previousStatus && previousStatus !== currentStatus) {
          console.log(`*** STATUS CHANGE DETECTED for claim ${claimId}: ${previousStatus} -> ${currentStatus} ***`);
          
          // Fetch user data for notification
          let userName = 'Unknown User';
          if (claim.google_user_id) {
            try {
              const userData = await getUserByEmail(claim.google_user_id);
              if (userData) {
                userName = userData.full_name || userData.name || claim.google_user_id.split('@')[0];
              } else {
                userName = claim.google_user_id.split('@')[0];
              }
            } catch (error) {
              userName = claim.google_user_id.split('@')[0];
            }
          }
          
          // Notification is now automatically handled by database trigger
          // See: create_claim_notification_triggers.sql - after_claim_status_update trigger
          console.log(`Claim ${claimId} status changed to ${currentStatus} - notification will be sent by database trigger`);
        }
      }
      
      // Update stored statuses
      const newStatuses = {};
      claims.forEach(claim => {
        newStatuses[claim.id] = claim.status;
      });
      console.log('Updating stored statuses to:', newStatuses);
      setLastClaimStatuses(newStatuses);
      
      console.log('=== END POLLING STATUS CHANGES ===');
    } catch (error) {
      console.error('Error checking for status changes:', error);
    }
  };

  // Function to auto-resolve approved claims and update item statuses
  // DISABLED: This function automatically changes approved claims to resolved
  // Claims should remain approved until manually resolved by admin
  /*
  const autoResolveApprovedClaims = async () => {
    try {
      console.log('=== AUTO RESOLVING APPROVED CLAIMS ===');
      
      // Get all approved claims for this user
      const userClaims = isAdmin ? await getAllClaims() : await getClaimsByClaimant(userData?.email);
      const approvedClaims = userClaims.filter(claim => claim.status === 'approved');
      
      if (approvedClaims.length === 0) {
        console.log('No approved claims found to auto-resolve');
        return;
      }
      
      console.log(`Found ${approvedClaims.length} approved claims to auto-resolve:`, approvedClaims);
      
      for (const claim of approvedClaims) {
        try {
          console.log(`Auto-resolving claim ${claim.id}...`);
          
          // Update claim status to 'resolved'
          await updateClaimStatus(claim.id, 'resolved');
          console.log(`✓ Claim ${claim.id} status updated to resolved`);
          
          // Update item statuses if we have the item IDs
          if (claim.item_id) {
            // Update lost item status to 'claimed'
            await updateItemStatus(claim.item_id, 'claimed');
            console.log(`✓ Lost item ${claim.item_id} status updated to claimed`);
          }
          
          // If there's a match_id, we can get the found item and update it too
          if (claim.match_id) {
            try {
              // Get match details to find the found item using proper API config
              const matchResponse = await fetch(getApiUrl(`/api/matches/${claim.match_id}`), {
                method: 'GET',
                headers: API_CONFIG.HEADERS
              });
              if (matchResponse.ok) {
                const matchData = await matchResponse.json();
                if (matchData.found_item_id) {
                  await updateItemStatus(matchData.found_item_id, 'returned');
                  console.log(`✓ Found item ${matchData.found_item_id} status updated to returned`);
                }
              }
            } catch (matchError) {
              console.error(`Error updating found item for match ${claim.match_id}:`, matchError);
            }
          }
          
          console.log(`✓ Successfully auto-resolved claim ${claim.id}`);
          
        } catch (error) {
          console.error(`Error auto-resolving claim ${claim.id}:`, error);
        }
      }
      
      console.log('=== END AUTO RESOLVING APPROVED CLAIMS ===');
    } catch (error) {
      console.error('Error in auto-resolve approved claims:', error);
    }
  };
  */

  // Function to load claim requests with provided user data
  const loadClaimRequestsWithUserData = async (userDataParam, isAdminParam) => {
    try {
      setLoading(true);
      
      // Check if user is logged in
      if (!userDataParam || !userDataParam.email) {
        console.log('No user data available for loading claim requests');
        setClaimRequests([]);
        return;
      }
      
      // Verify email domain is from CSPC
      if (!userDataParam.email.toLowerCase().endsWith('@my.cspc.edu.ph')) {
        console.log('User email is not from CSPC domain:', userDataParam.email);
        setClaimRequests([]);
        return;
      }
      
      let claims = [];
      
      if (isAdminParam) {
        // Admins can see all claim requests
        console.log('Admin user, fetching all claim requests via API');
        claims = await getAllClaims();
      } else {
        // Regular users can see claims they submitted
        console.log('Regular user, fetching claims by claimant via API');
        claims = await getClaimsByClaimant(userDataParam.email);
      }
      
      // Transform API response to match expected format with user data
      const transformedClaims = await Promise.all(claims.map(async (claim) => {
        let userName = 'Unknown User';
        let userDepartment = 'Student';
        
        // Fetch actual user data from API
        if (claim.google_user_id) {
          try {
            const userData = await getUserByEmail(claim.google_user_id);
            if (userData) {
              userName = userData.full_name || userData.name || claim.google_user_id.split('@')[0];
              userDepartment = userData.department || 'Student';
            } else {
              // Fallback to email extraction if user not found
              userName = claim.google_user_id.split('@')[0];
            }
          } catch (error) {
            console.error('Error fetching user data for claim:', claim.id, error);
            // Fallback to email extraction on error
            userName = claim.google_user_id.split('@')[0];
          }
        }
        
        return {
          id: claim.id,
          matchId: claim.match_id,
          itemTitle: `Item ${claim.item_id}`, // You might want to fetch actual item details
          proofOfOwnershipText: claim.proof_of_ownership,
          proofOfOwnershipImage: claim.image ? (
            // Handle both URL string and JSON string formats
            typeof claim.image === 'string' && claim.image.startsWith('{') 
              ? JSON.parse(claim.image) 
              : claim.image
          ) : null,
          googleUserId: claim.google_user_id,
          userName: userName,
          contactName: userName,
          userDepartment: userDepartment,
          status: claim.status,
          createdAt: claim.created_at,
          updatedAt: claim.updated_at,
          lostItemId: claim.item_id, // Simplified mapping
          foundItemId: null,
          isLostItemOwner: false,
          isFoundItemOwner: false,
          claimType: claim.claim_type
        };
      }));
      
      // Sort by creation date (newest first)
      transformedClaims.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setClaimRequests(transformedClaims);
      
      // Initialize claim statuses for status change detection
      const initialStatuses = {};
      transformedClaims.forEach(claim => {
        initialStatuses[claim.id] = claim.status;
      });
      setLastClaimStatuses(initialStatuses);
      
      console.log('Loaded', transformedClaims.length, 'claim requests');
    } catch (error) {
      console.error('Error loading claim requests:', error);
      showError(
        'Error Loading Claims',
        'Failed to load claim requests. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Function to load claim requests from API (wrapper for existing calls)
  const loadClaimRequests = async () => {
    if (userData && userData.email) {
      await loadClaimRequestsWithUserData(userData, isAdmin);
    }
  };

  // Clear all claim requests


  


  // Clear all claim requests
  const handleClearAllClaimRequests = () => {
    showConfirm(
      'Clear All Claim Requests',
      'Are you sure you want to delete all claim requests? This action cannot be undone.',
      [
        { 
          text: 'Cancel', 
          style: 'cancel' 
        },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const success = await clearClaimRequests();
              if (success) {
                setClaimRequests([]);
                showSuccess('Success', 'All claim requests have been cleared.');
              } else {
                showError('Error', 'Failed to clear claim requests. Please try again.');
              }
            } catch (error) {
              console.error('Error clearing claim requests:', error);
              showError('Error', 'An unexpected error occurred.');
            } finally {
              setLoading(false);
            }
          } 
        }
      ]
    );
  };

  // Format date to readable string
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Hold-to-delete functionality
  const handleLongPress = (claim) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedClaims([claim.id]);
    }
  };

  const handleToggleSelection = (claim) => {
    if (selectionMode) {
      setSelectedClaims(prev => {
        if (prev.includes(claim.id)) {
          const newSelection = prev.filter(id => id !== claim.id);
          if (newSelection.length === 0) {
            setSelectionMode(false);
          }
          return newSelection;
        } else {
          return [...prev, claim.id];
        }
      });
    } else {
      navigation.navigate('ClaimDetails', { claim });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedClaims.length === 0) return;

    showConfirm(
      'Delete Claims',
      `Are you sure you want to delete ${selectedClaims.length} selected claim${selectedClaims.length > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Delete selected claims
              for (const claimId of selectedClaims) {
                await deleteClaim(claimId);
              }
              
              // Update local state
              setClaimRequests(prev => 
                prev.filter(claim => !selectedClaims.includes(claim.id))
              );
              
              setSelectionMode(false);
              setSelectedClaims([]);
              
              showSuccess('Success', `${selectedClaims.length} claim${selectedClaims.length > 1 ? 's' : ''} deleted successfully.`);
            } catch (error) {
              console.error('Error deleting claims:', error);
              showError('Error', 'Failed to delete claims. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCancelSelection = () => {
    setSelectedClaims([]);
    setSelectionMode(false);
  };



  // Render each claim request item with MatchCard design
  const renderClaimRequest = ({ item }) => {
    // Check if this claim belongs to the current user
    const isUserClaim = userData && (
      item.googleUserId === userData.email
    );

    return (
      <TouchableOpacity 
        style={[
          styles.claimCard, 
          selectedClaims.includes(item.id) && styles.selectedCard
        ]}
        onPress={selectionMode ? () => handleToggleSelection(item) : () => navigation.navigate('ClaimDetails', { claim: item })}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
      >
        {/* Selection indicator */}
        {selectionMode && (
          <View style={styles.selectionIndicator}>
            <Ionicons 
              name={selectedClaims.includes(item.id) ? "checkmark-circle" : "ellipse-outline"} 
              size={20} 
              color={selectedClaims.includes(item.id) ? "#28a745" : "#ccc"} 
            />
          </View>
        )}

        {/* Status Score Container */}
        <LinearGradient
          colors={
            item.status === 'approved' ? ['#28a745', '#1e7e34'] :
            item.status === 'rejected' ? ['#dc3545', '#c82333'] :
            item.status === 'resolved' ? ['#17a2b8', '#138496'] :
            ['#007bff', '#0056b3']
          }
          style={styles.statusContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons 
            name={
              item.status === 'approved' ? 'checkmark-circle' :
              item.status === 'rejected' ? 'close-circle' :
              item.status === 'resolved' ? 'shield-checkmark' :
              'time'
            } 
            size={18} 
            color="#fff"
          />
          <Text style={styles.statusLabel}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </LinearGradient>
        
        <View style={styles.content}>
          <View style={styles.cardHeader}>
            <Text style={styles.title} numberOfLines={1}>
              {item.itemTitle || 'Unnamed Item'}
            </Text>
            {isUserClaim && (
              <View style={styles.userBadge}>
                <Ionicons name="person" size={10} color="#007bff" />
                <Text style={styles.userBadgeText}>Your Claim</Text>
              </View>
            )}
          </View>
          
          <View style={styles.claimInfoContainer}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color="#666" style={styles.icon} />
              <Text style={styles.infoText} numberOfLines={1}>
                Submitted: {formatDate(item.createdAt)}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={14} color="#666" style={styles.icon} />
              <Text style={styles.infoText} numberOfLines={1}>
                {item.userName || 'Unknown User'} {item.userDepartment ? `(${item.userDepartment})` : ''}
              </Text>
            </View>
          </View>
          
          {/* Action Container */}
          <View style={styles.actionContainer}>
            <View style={styles.timestampContainer}>
              <Ionicons name="time-outline" size={12} color="#666" />
              <Text style={styles.timestampText}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Proof image or placeholder */}
        {item.proofOfOwnershipImage ? (
          <Image 
            source={{ 
              uri: typeof item.proofOfOwnershipImage === 'string' 
                ? item.proofOfOwnershipImage 
                : (item.proofOfOwnershipImage.imageUrl || item.proofOfOwnershipImage.uri)
            }} 
            style={styles.claimImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.claimImage, styles.placeholderImage]}>
            <Ionicons name="document-text-outline" size={24} color="#ccc" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Empty state component
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Claim Requests</Text>
      <Text style={styles.emptyText}>
        There are no claim requests to display at this time.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.container}>
        <View style={styles.header}>
          <LinearGradient
            colors={['#3266a8', '#2a5490']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.headerGradient, { paddingTop: insets.top + 15 }]}
          >
            <TouchableOpacity 
              style={styles.headerTitleContainer}
              onLongPress={claimRequests.length > 0 ? handleClearAllClaimRequests : null}
              delayLongPress={1000}
            >
              <View style={styles.headerTitleContent}>
                <Ionicons name="hand-right-outline" size={22} color="#fff" style={styles.headerIcon} />
                <Text style={styles.headerTitle}>Claim Requests</Text>
              </View>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading claim requests...</Text>
        </View>
      ) : (
        <FlatList
          data={claimRequests}
          renderItem={renderClaimRequest}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={EmptyState}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadClaimRequests();
          }}

        />
      )}

      {/* Selection toolbar */}
      {selectionMode && (
        <View style={styles.selectionToolbar}>
          <TouchableOpacity 
            style={styles.toolbarButton}
            onPress={handleCancelSelection}
          >
            <Ionicons name="close" size={24} color="#666" />
            <Text style={styles.toolbarButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.selectionCount}>
            {selectedClaims.length} selected
          </Text>
          
          <TouchableOpacity 
            style={[styles.toolbarButton, styles.deleteButton]}
            onPress={handleDeleteSelected}
            disabled={selectedClaims.length === 0}
          >
            <Ionicons name="trash" size={24} color="#dc3545" />
            <Text style={[styles.toolbarButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <ProfessionalAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        type={alertConfig.type}
        onDismiss={hideAlert}
      />
      </View>
    </SafeAreaView>
  );
};

const createStyles = () => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: 'transparent',
    paddingBottom: 10,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },

  listContainer: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  claimCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
    padding: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCard: {
    borderColor: '#28a745',
    borderWidth: 2,
    shadowColor: '#28a745',
    shadowOpacity: 0.3,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  statusContainer: {
    width: 55,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  statusLabel: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  cardHeader: {
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  userBadgeText: {
    fontSize: 10,
    color: '#007bff',
    fontWeight: '600',
    marginLeft: 3,
  },
  claimInfoContainer: {
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
  },
  selectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toolbarButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
  },
  deleteButton: {
    backgroundColor: 'transparent',
  },
  deleteButtonText: {
    color: '#dc3545',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 2,
  },
  icon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
    lineHeight: 18,
  },
  claimImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 12,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContainer: {
    flexDirection: 'row',
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timestampText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default withInternetGuard(ClaimRequestsScreen);
