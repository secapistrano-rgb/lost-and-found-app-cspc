import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getItems, 
  getMatches, 
  getClaims, 
  getItemStatistics, 
  getMatchStats, 
  getClaimStats, 
  getItemCategories 
} from '../../../config/apiConfig';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';

const { width } = Dimensions.get('window');

const UserStatsScreen = ({ navigation }) => {
  const styles = createStyles();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalLost: 0,
    totalFound: 0,
    totalMatches: 0,
    totalClaims: 0,
    successRate: 0,
    claimApprovalRate: 0,
    categoryCounts: {},
    monthlyActivity: [],
    statusDistribution: [],
    claimStatusDistribution: [],
  });

  // Ref for monthly activity chart scrolling
  const scrollViewRef = React.useRef(null);

  useEffect(() => {
    // Load user data first, then load stats
    const initializeData = async () => {
      await loadUserData();
      // Only load stats if we have a user
      if (user && user.email) {
        loadStats();
      } else {
        // If no user, make sure we're not in a loading state
        setLoading(false);
      }
    };
    
    initializeData();
  }, []); // Only run once on mount
  
  // Set up a separate effect for user changes
  useEffect(() => {
    if (user && user.email) {
      loadStats();
    } else {
      // If no user, make sure we're not in a loading state
      setLoading(false);
    }
  }, [user]); // Run when user changes
  
    // Refresh stats when the screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user && user.email) {
        loadStats();
      }
    });
    
    return unsubscribe;
  }, [navigation, user]);

  // Auto-scroll to first month with data in monthly activity chart
  useEffect(() => {
    if (stats.monthlyActivity && stats.monthlyActivity.data) {
      const counts = stats.monthlyActivity.data;
      const firstDataIndex = counts.findIndex(count => count > 0);
      
      if (scrollViewRef.current && firstDataIndex > 0) {
        // Scroll to position after a short delay
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ 
            x: firstDataIndex * 58, // 50px column + 8px margin
            animated: true 
          });
        }, 300);
      }
    }
  }, [stats.monthlyActivity]);
  
  const loadUserData = async () => {
    try {
      // Get user data directly from AsyncStorage
      const userDataString = await AsyncStorage.getItem('user_data');
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        setUser(userData);
      } else {
        console.log('No user data found in AsyncStorage');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };
  
  // This function handles pull-to-refresh functionality
  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const loadStats = async () => {
    // Set a timeout to ensure loading state doesn't get stuck
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      console.log('Stats loading timed out');
    }, 5000); // 5 second timeout
    
    setLoading(true);
    try {
      // Check if user is logged in
      if (!user || !user.email) {
        console.log('No user logged in, cannot load stats');
        setLoading(false);
        clearTimeout(loadingTimeout);
        return;
      }
      
      // Get all items from API
      const allLostItemsResponse = await getItems({ type: 'lost' });
      const allFoundItemsResponse = await getItems({ type: 'found' });
      const allLostItems = allLostItemsResponse.Items || allLostItemsResponse.items || allLostItemsResponse || [];
      const allFoundItems = allFoundItemsResponse.Items || allFoundItemsResponse.items || allFoundItemsResponse || [];
      
      // Get matches from API
      const allMatchesResponse = await getMatches();
      const allMatches = allMatchesResponse.matches || allMatchesResponse || [];
      
      // Get claims from API
      const allClaimsResponse = await getClaims();
      const allClaims = allClaimsResponse.claims || allClaimsResponse || [];
      
      // Filter items by the current user's email
      const filterByUserEmail = (item) => {
        // Check reporterId field
        const matchesReporterId = item.reporterId === user.email || item.reporter_id === user.email;
        
        // Check reporter.email field
        const matchesReporterEmail = item.reporter && 
          item.reporter.email && 
          item.reporter.email.toLowerCase() === user.email.toLowerCase();
        
        // Check reporter_email field
        const matchesReporterEmailField = item.reporter_email && 
          item.reporter_email.toLowerCase() === user.email.toLowerCase();
        
        return matchesReporterId || matchesReporterEmail || matchesReporterEmailField;
      };
      
      // Filter items to only include those reported by the current user
      const lostItems = allLostItems.filter(filterByUserEmail);
      const foundItems = allFoundItems.filter(filterByUserEmail);
      
      // Filter matches to only include those involving the current user's items
      const userItemIds = [...lostItems, ...foundItems].map(item => item.id);
      const matches = allMatches.filter(match => 
        userItemIds.includes(match.lost_item_id) || userItemIds.includes(match.found_item_id) ||
        userItemIds.includes(match.lostItemId) || userItemIds.includes(match.foundItemId)
      );
      
      // Filter claim requests to only include those made by or for the current user
      const claimRequests = allClaims.filter(claim => 
        claim.claimant_email === user.email || claim.claimerEmail === user.email || 
        userItemIds.includes(claim.item_id) || userItemIds.includes(claim.itemId)
      );

      // Get comprehensive statistics from API
      const [itemStats, matchStats, claimStats] = await Promise.all([
        getItemStatistics().catch(err => {
          console.warn('Failed to get item statistics:', err);
          return null;
        }),
        getMatchStats(user.email).catch(err => {
          console.warn('Failed to get match statistics:', err);
          return null;
        }),
        getClaimStats().catch(err => {
          console.warn('Failed to get claim statistics:', err);
          return null;
        })
      ]);

      // Calculate basic stats (fallback to local calculation if API fails)
      const totalLost = itemStats?.user_stats?.lost_items || lostItems.length;
      const totalFound = itemStats?.user_stats?.found_items || foundItems.length;
      const totalMatches = matchStats?.user_stats?.total_matches || matches.length;
      const totalClaims = claimStats?.user_stats?.total_claims || claimRequests.length;
      
      // Calculate success rate (use API data if available, otherwise calculate locally)
      const successRate = matchStats?.user_stats?.success_rate || 
        (totalLost > 0 ? (totalMatches / totalLost) * 100 : 0);

      // Calculate claim approval rate (use API data if available, otherwise calculate locally)
      const approvedClaims = claimRequests.filter(claim => 
        claim.status === 'approved' || claim.status === 'resolved'
      ).length;
      const claimApprovalRate = claimStats?.user_stats?.approval_rate || 
        (totalClaims > 0 ? (approvedClaims / totalClaims) * 100 : 0);

      // Combine lost and found items for calculations
      const allUserItems = [...(lostItems || []), ...(foundItems || [])];
      console.log('📊 USER STATS - Total user items:', allUserItems.length);
      console.log('📊 USER STATS - Lost items:', lostItems?.length || 0, 'Found items:', foundItems?.length || 0);
      
      // Log first item to see its structure
      if (allUserItems.length > 0) {
        console.log('📊 USER STATS - Sample item structure:', {
          id: allUserItems[0].id,
          title: allUserItems[0].title,
          created_at: allUserItems[0].created_at,
          date_reported: allUserItems[0].date_reported,
          date_lost_found: allUserItems[0].date_lost_found,
          availableKeys: Object.keys(allUserItems[0])
        });
      }
      
      // Get category distribution (use API data if available, otherwise calculate locally)
      const categoryCounts = itemStats?.category_distribution || 
        calculateCategoryCounts(allUserItems);
      
      // Calculate monthly activity (use API data if available, otherwise calculate locally)
      console.log('📊 USER STATS - itemStats?.monthly_activity:', itemStats?.monthly_activity);
      const monthlyActivity = itemStats?.monthly_activity || 
        calculateMonthlyActivity(allUserItems);
      console.log('📊 USER STATS - Final monthlyActivity:', monthlyActivity);
      
      // Calculate status distribution (with safe array handling)
      const statusDistribution = calculateStatusDistribution(allUserItems);
      
      // Calculate claim status distribution (with safe array handling)
      const claimStatusDistribution = calculateClaimStatusDistribution(claimRequests || []);

      setStats({
        totalLost,
        totalFound,
        totalMatches,
        totalClaims,
        successRate,
        claimApprovalRate,
        categoryCounts,
        monthlyActivity,
        statusDistribution,
        claimStatusDistribution,
      });
      
      // Clear the timeout since we've successfully loaded stats
      clearTimeout(loadingTimeout);
    } catch (error) {
      console.error('Error loading stats:', error);
      
      // Provide specific error messages based on error type
      let errorMessage = 'Failed to load statistics. Please try again.';
      
      if (error.message?.includes('Network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.status === 403) {
        errorMessage = 'Access denied. You may not have permission to view these statistics.';
      } else if (error.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      setError(errorMessage);
      
      // Show default stats on error
      setStats({
        totalLost: 0,
        totalFound: 0,
        totalMatches: 0,
        totalClaims: 0,
        successRate: 0,
        claimApprovalRate: 0,
        categoryCounts: {},
        monthlyActivity: { labels: [], data: [] },
        statusDistribution: [],
        claimStatusDistribution: [],
      });
    } finally {
      setLoading(false);
      clearTimeout(loadingTimeout); // Ensure timeout is cleared in all cases
    }
  };

  const calculateCategoryCounts = (items) => {
    const counts = {};
    
    if (!Array.isArray(items)) {
      console.warn('calculateCategoryCounts: items is not an array:', items);
      return counts;
    }
    
    items.forEach(item => {
      try {
        let categories = item.categories;
        
        // Parse detected_categories if it's a string
        if (!categories && item.detected_categories) {
          if (typeof item.detected_categories === 'string') {
            try {
              categories = JSON.parse(item.detected_categories);
            } catch (e) {
              console.warn('Error parsing detected_categories:', e);
              categories = null;
            }
          } else if (Array.isArray(item.detected_categories)) {
            categories = item.detected_categories;
          }
        }
        
        // Use the primary category if available
        if (categories && Array.isArray(categories) && categories.length > 0) {
          const category = categories[0];
          counts[category] = (counts[category] || 0) + 1;
        } else if (item.category) {
          // Fallback to single category field
          counts[item.category] = (counts[item.category] || 0) + 1;
        } else {
          counts['Other'] = (counts['Other'] || 0) + 1;
        }
      } catch (error) {
        console.warn('Error processing item for categories:', item, error);
        counts['Other'] = (counts['Other'] || 0) + 1;
      }
    });
    
    return counts;
  };

  const calculateMonthlyActivity = (items) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts = Array(12).fill(0);
    
    if (!Array.isArray(items)) {
      console.warn('calculateMonthlyActivity: items is not an array:', items);
      return { labels: months, data: counts };
    }
    
    console.log('📊 Calculating monthly activity for', items.length, 'items');
    let itemsWithDate = 0;
    
    items.forEach(item => {
      try {
        // Try multiple possible date field names
        const dateValue = item.created_at || item.createdAt || item.date || item.date_reported || item.date_lost_found || item.dateLostFound;
        
        if (item && dateValue) {
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            const month = date.getMonth();
            if (month >= 0 && month < 12) {
              counts[month]++;
              itemsWithDate++;
            }
          } else {
            console.warn('Invalid date for item:', item.id, dateValue);
          }
        } else {
          // Log first few items without dates to debug
          if (itemsWithDate === 0) {
            console.log('Sample item without date:', {
              id: item.id,
              created_at: item.created_at,
              date_reported: item.date_reported,
              date_lost_found: item.date_lost_found,
              allKeys: Object.keys(item)
            });
          }
        }
      } catch (error) {
        console.warn('Error processing item for monthly activity:', item, error);
      }
    });
    
    console.log('✅ Monthly activity calculated:', itemsWithDate, 'items with dates, counts:', counts);
    
    return {
      labels: months,
      data: counts,
    };
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': '#007bff',
      'resolved': '#28a745',
      'expired': '#dc3545',
      'claimed': '#ffc107',
      'other': '#666',
    };
    return colors[status] || '#666';
  };
  
  const getClaimStatusColor = (status) => {
    const colors = {
      'pending': '#007bff',
      'approved': '#28a745',
      'rejected': '#dc3545',
      'resolved': '#17a2b8',
    };
    return colors[status] || '#666';
  };
  
  const calculateStatusDistribution = (items) => {
    const statusCounts = {
      'active': 0,
      'resolved': 0,
      'expired': 0,
      'claimed': 0,
      'other': 0,
    };
    
    items.forEach(item => {
      if (item.status && statusCounts[item.status] !== undefined) {
        statusCounts[item.status]++;
      } else {
        statusCounts['other']++;
      }
    });
    
    // Convert to format needed for display
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      color: getStatusColor(status),
    })).filter(item => item.count > 0); // Only include statuses with counts > 0
  };

  const calculateClaimStatusDistribution = (claimRequests) => {
    console.log('📊 Calculating claim status distribution for', claimRequests?.length || 0, 'claims');
    
    if (!claimRequests || !Array.isArray(claimRequests)) {
      console.warn('❌ Claim requests is not an array or is null');
      return [];
    }
    
    const statusCounts = {
      'pending': 0,
      'approved': 0,
      'rejected': 0,
      'resolved': 0,
    };
    
    claimRequests.forEach(claim => {
      if (claim && claim.status) {
        if (statusCounts[claim.status] !== undefined) {
          statusCounts[claim.status]++;
        } else {
          console.log('Unknown claim status:', claim.status);
        }
      } else {
        console.log('Claim without status:', claim);
      }
    });
    
    console.log('✅ Claim status counts:', statusCounts);
    
    // Convert to format needed for display
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      color: getClaimStatusColor(status),
    })).filter(item => item.count > 0); // Only include statuses with counts > 0
  };

  const getRandomColor = (seed) => {
    // Generate a consistent color based on the category name
    const categoryColors = [
    '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
      '#f39c12', '#666', '#dc3545', '#28a745', '#007bff'
  ];
    
    // Use the sum of character codes as a simple hash
    const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return categoryColors[hash % categoryColors.length];
  };

  const renderCategoryDistribution = () => {
    const categories = Object.keys(stats.categoryCounts);
    
    if (categories.length === 0) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Item Categories</Text>
          <Text style={styles.noDataText}>No category data available</Text>
        </View>
      );
    }

    // Find the maximum count for scaling
    const maxCount = Math.max(...Object.values(stats.categoryCounts));

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Item Categories</Text>
        {categories.map(category => (
          <View key={category} style={styles.categoryItem}>
            <View style={[styles.categoryColor, { backgroundColor: getRandomColor(category) }]} />
            <View style={styles.categoryNameContainer}>
              <Text style={styles.categoryName}>{category}</Text>
              <Text style={styles.categoryCount}>{stats.categoryCounts[category]}</Text>
            </View>
            <View style={styles.barContainer}>
              <View 
                style={[
                  styles.bar, 
                  { 
                    width: `${(stats.categoryCounts[category] / maxCount) * 100}%`,
                    backgroundColor: getRandomColor(category)
                  }
                ]} 
              />
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderSummaryCards = () => {
    return (
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Ionicons name="search" size={24} color="#007bff" />
          <Text style={styles.summaryValue}>{stats.totalLost}</Text>
          <Text style={styles.summaryLabel}>Lost Items</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Ionicons name="checkmark-circle" size={24} color="#28a745" />
          <Text style={styles.summaryValue}>{stats.totalFound}</Text>
          <Text style={styles.summaryLabel}>Found Items</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Ionicons name="git-compare" size={24} color="#ffc107" />
          <Text style={styles.summaryValue}>{stats.totalMatches}</Text>
          <Text style={styles.summaryLabel}>Matches</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Ionicons name="clipboard" size={24} color="#007bff" />
          <Text style={styles.summaryValue}>{stats.totalClaims}</Text>
          <Text style={styles.summaryLabel}>Claims</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Ionicons name="trending-up" size={24} color="#17a2b8" />
          <Text style={styles.summaryValue}>{stats.successRate.toFixed(1)}%</Text>
          <Text style={styles.summaryLabel}>Success Rate</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Ionicons name="checkmark-done" size={24} color="#17a2b8" />
          <Text style={styles.summaryValue}>{stats.claimApprovalRate.toFixed(1)}%</Text>
          <Text style={styles.summaryLabel}>Approval Rate</Text>
        </View>
      </View>
    );
  };

  const renderMonthlyActivity = () => {
    const { monthlyActivity } = stats;
    console.log('🎨 RENDER - monthlyActivity object:', monthlyActivity);
    
    const months = monthlyActivity.labels || [];
    const counts = monthlyActivity.data || [];
    
    console.log('🎨 RENDER - months:', months);
    console.log('🎨 RENDER - counts:', counts);
    console.log('🎨 RENDER - Has data?', counts.some(val => val > 0));
    
    if (!counts.some(val => val > 0)) {
      console.log('❌ RENDER - No monthly activity data to display');
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Monthly Activity</Text>
          <Text style={styles.noDataText}>No activity data available</Text>
        </View>
      );
    }
    
    console.log('✅ RENDER - Displaying monthly activity chart');

    // Find the maximum count for scaling
    const maxCount = Math.max(...counts);
    console.log('📊 CHART - maxCount:', maxCount);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Monthly Activity</Text>
        <Text style={styles.chartSubtitle}>← Swipe to see all months →</Text>
        <ScrollView 
          ref={scrollViewRef}
          horizontal 
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={{ paddingRight: 20 }}
        >
          <View style={styles.monthlyActivityChart}>
            {months.map((month, index) => {
              const barHeight = counts[index] > 0 ? Math.max(20, (counts[index] / maxCount) * 100) : 0;
              console.log(`📊 CHART - ${month}: count=${counts[index]}, height=${barHeight}`);
              
              return (
                <View key={month} style={styles.monthColumn}>
                  <View 
                    style={[
                      styles.monthBar, 
                      { 
                        height: barHeight,
                        backgroundColor: counts[index] > 0 ? '#007bff' : '#e0e0e0',
                        minHeight: counts[index] > 0 ? 20 : 0,
                      }
                    ]} 
                  />
                  <Text style={styles.monthLabel}>{month}</Text>
                  <Text style={[
                    styles.monthCount,
                    counts[index] > 0 && styles.monthCountActive
                  ]}>{counts[index]}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderClaimStatusDistribution = () => {
    if (!stats.claimStatusDistribution || stats.claimStatusDistribution.length === 0) {
      return (
        <Text style={styles.noDataText}>No claim request data available</Text>
      );
    }

    const total = stats.claimStatusDistribution.reduce((sum, item) => sum + item.count, 0);

    return (
      <View>
        {stats.claimStatusDistribution.map((item, index) => {
          const percentage = (item.count / total) * 100;
          return (
            <View key={index} style={styles.statusItem}>
              <View style={styles.statusNameContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.statusColor, { backgroundColor: item.color }]} />
                  <Text style={styles.statusName}>{item.name}</Text>
                </View>
                <Text style={styles.statusCount}>{item.count} ({percentage.toFixed(1)}%)</Text>
              </View>
              <View style={styles.barContainer}>
                <View 
                  style={[styles.bar, { width: `${percentage}%`, backgroundColor: item.color }]} 
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderStatusDistribution = () => {
    if (!stats.statusDistribution || stats.statusDistribution.length === 0) {
      return (
        <Text style={styles.noDataText}>No status data available</Text>
      );
    }

    const total = stats.statusDistribution.reduce((sum, item) => sum + item.count, 0);

    return (
      <View>
        {stats.statusDistribution.map((item, index) => {
          const percentage = (item.count / total) * 100;
          return (
            <View key={index} style={styles.statusItem}>
              <View style={styles.statusNameContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.statusColor, { backgroundColor: item.color }]} />
                  <Text style={styles.statusName}>{item.name}</Text>
                </View>
                <Text style={styles.statusCount}>{item.count} ({percentage.toFixed(1)}%)</Text>
              </View>
              <View style={styles.barContainer}>
                <View 
                  style={[styles.bar, { width: `${percentage}%`, backgroundColor: item.color }]} 
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // This useEffect is already declared at the top of the component
  // Keeping this commented out to avoid duplication
  // useEffect(() => {
  //   loadStats();
  // }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.title}>Your Statistics</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#007bff']}
            tintColor={'#007bff'}
            />
          }
        >
          {renderSummaryCards()}
          
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Category Distribution</Text>
            {renderCategoryDistribution()}
          </View>
          
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Monthly Activity</Text>
            {renderMonthlyActivity()}
          </View>
          
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Item Status Distribution</Text>
            {renderStatusDistribution()}
          </View>
          
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Claim Request Status</Text>
            {renderClaimStatusDistribution()}
          </View>
          
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>What do these statistics mean?</Text>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Lost Items:</Text> Total number of items you've reported as lost.
            </Text>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Found Items:</Text> Total number of items you've reported as found.
            </Text>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Matches:</Text> Number of potential matches between lost and found items.
            </Text>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Success Rate:</Text> Percentage of your lost items that have been matched.
            </Text>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>Approval Rate:</Text> Percentage of your claim requests that have been approved.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop:32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: '1%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 30,
  },
  infoContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  // Category styles
  categoryItem: {
    marginBottom: 12,
  },
  categoryColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  categoryNameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 14,
    color: '#2c3e50',
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  barContainer: {
    height: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 6,
  },
  // Monthly activity styles
  monthlyActivityChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 180,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  monthColumn: {
    width: 50,
    alignItems: 'center',
    marginRight: 8,
  },
  monthBar: {
    width: 30,
    borderRadius: 4,
    marginBottom: 8,
    minHeight: 2,
  },
  monthLabel: {
    fontSize: 12,
    color: '#666',
  },
  monthCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  monthCountActive: {
    color: '#007bff',
    fontSize: 14,
  },
  // Status styles
  statusItem: {
    marginBottom: 12,
  },
  statusColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  statusNameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusName: {
    fontSize: 14,
    color: '#2c3e50',
  },
  statusCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
});

// Wrap UserStatsScreen with internet guard to block access when offline
export default withInternetGuard(UserStatsScreen);
