import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  SafeAreaView,
  Alert,
  StatusBar,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ItemCard from '../components/ItemCard';
import { getLostItems, getFoundItems } from '../../../shared/storage/storage';
import { initializeUserData } from '../../../shared/storage/userStorage';
import { getItemsByReporter } from '../../../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';


const { width } = Dimensions.get('window');

const UserItemHistory = ({ navigation }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  
  const styles = createStyles();
  
  // Load user data and items on initial mount
  useEffect(() => {
    const initializeData = async () => {
      await loadUserData();
      await loadItems();
    };
    
    initializeData();
  }, []);
  
  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadItems(true); // Force refresh when screen is focused
      }
    }, [user])
  );
  
  // Add a callback function to refresh items when returning from ReportItemScreen
  const handleRefreshFromReport = () => {
    console.log('Refreshing items after report submission');
    loadItems(true); // Force refresh to get latest data
  };
  
  const loadUserData = async () => {
    try {
      // Get user data directly from AsyncStorage
      const userDataString = await AsyncStorage.getItem('user_data');
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        setUser(userData);
        
        // Initialize user-specific data storage if needed
        if (userData.email) {
          await initializeUserData(userData.email);
        }
      } else {
        console.log('No user data found in AsyncStorage');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };
  
  const loadItems = async (forceRefresh = false) => {
    // Only show loading indicator if we don't have any items yet or force refresh
    const showLoading = items.length === 0 || forceRefresh;
    if (showLoading) {
      setLoading(true);
    }
    
    try {
      if (user && user.email) {
        console.log(`Loading items for user: ${user.email}`);
        
        // Fetch items from API using the user's email
        const userItems = await getItemsByReporter(user.email);
        
        console.log(`Found ${userItems.length} items for user ${user.email}`);
        
        // Add type property if it doesn't exist and sort by creation date (newest first)
        const formattedItems = userItems
          .map(item => ({ 
            ...item, 
            type: item.type || (item.item_type === 'lost' ? 'lost' : 'found'),
            createdAt: item.createdAt || item.date_reported || item.created_at
          }))
          .sort((a, b) => new Date(b.createdAt || b.date_reported || b.created_at) - new Date(a.createdAt || a.date_reported || a.created_at));
        
        // Store the user's items in AsyncStorage for persistence
        await AsyncStorage.setItem('user_items_' + user.email, JSON.stringify(formattedItems));
        
        // Always update state with fresh data to ensure real-time updates
        setItems(formattedItems);
      } else {
        // If no user is logged in, show no items
        setItems([]);
      }
    } catch (error) {
      console.error('Error loading items from API:', error);
      
      // If there's an error, try to load from cached items first
      if (user && user.email) {
        try {
          const cachedItems = await AsyncStorage.getItem('user_items_' + user.email);
          if (cachedItems) {
            const parsedItems = JSON.parse(cachedItems);
            setItems(parsedItems);
            console.log('Loaded cached items due to API error:', parsedItems.length);
          } else {
            // If no cached items, fall back to local storage as last resort
            console.log('No cached items, falling back to local storage');
            const lostItems = await getLostItems() || [];
            const foundItems = await getFoundItems() || [];
            
            // Add type property to distinguish between lost and found items
            const formattedLostItems = lostItems.map(item => ({ ...item, type: 'lost' }));
            const formattedFoundItems = foundItems.map(item => ({ ...item, type: 'found' }));
            
            // Combine and sort by creation date (newest first)
            const allItems = [...formattedLostItems, ...formattedFoundItems]
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Filter items by the current user's email
            const userItems = allItems.filter(item => {
              // Check reporterId field
              const matchesReporterId = item.reporterId === user.email;
              
              // Check reporter.email field
              const matchesReporterEmail = item.reporter && 
                item.reporter.email && 
                item.reporter.email.toLowerCase() === user.email.toLowerCase();
              
              return matchesReporterId || matchesReporterEmail;
            });
            
            setItems(userItems);
            console.log('Loaded items from local storage fallback:', userItems.length);
          }
        } catch (cacheError) {
          console.error('Error loading cached items:', cacheError);
          setItems([]);
        }
      }
    } finally {
      setLoading(false);
    }
  };
  
  const filterItems = () => {
    // First filter by the active tab (all, lost, found)
    let filteredItems = items;
    
    if (activeTab !== 'all') {
      filteredItems = items.filter(item => item.type === activeTab);
    }
    
    // Always include items with status 'found' or 'active'
    // This ensures items marked as found remain in the history
    return filteredItems;
  };
  
  const handleItemPress = (item) => {
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
      <View style={styles.emptyIconContainer}>
        {activeTab === 'all' && <Ionicons name="folder-open-outline" size={64} color="#3266a8" />}
        {activeTab === 'lost' && <Ionicons name="search-outline" size={64} color="#e74c3c" />}
        {activeTab === 'found' && <Ionicons name="checkmark-circle-outline" size={64} color="#27ae60" />}
      </View>
      <Text style={styles.emptyText}>No {activeTab !== 'all' ? activeTab : ''} items found</Text>
      <Text style={styles.emptySubtext}>
        {activeTab === 'all' 
          ? 'You haven\'t reported any items yet'
          : `You haven't reported any ${activeTab} items yet`}
      </Text>
      <TouchableOpacity style={styles.emptyActionButton} onPress={() => navigation.navigate('ReportItem', { onGoBack: handleRefreshFromReport })}>
        <Ionicons name="add-circle-outline" size={18} color="#fff" style={{marginRight: 8}} />
        <Text style={styles.emptyActionButtonText}>Report an Item</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Report Items</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Ionicons 
            name="list-outline" 
            size={18} 
            color={activeTab === 'all' ? '#3266a8' : '#666'} 
            style={styles.tabIcon} 
          />
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'lost' && styles.activeTab]}
          onPress={() => setActiveTab('lost')}
        >
          <Ionicons 
            name="search-outline" 
            size={18} 
            color={activeTab === 'lost' ? '#e74c3c' : '#666'} 
            style={styles.tabIcon} 
          />
          <Text style={[styles.tabText, activeTab === 'lost' && styles.lostTabText]}>
            Lost
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'found' && styles.activeTab]}
          onPress={() => setActiveTab('found')}
        >
          <Ionicons 
            name="checkmark-circle-outline" 
            size={18} 
            color={activeTab === 'found' ? '#27ae60' : '#666'} 
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
          <Text style={styles.loadingText}>Loading your items...</Text>
        </View>
      ) : (
        <FlatList
          data={filterItems()}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyList}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadItems}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    padding: 8,
    paddingTop: 31,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 0.5,
    paddingTop: 23,
  },
  placeholder: {
    width: 40,
    paddingVertical: 22,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    justifyContent: 'space-around',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: width / 4,
  },
  activeTab: {
    backgroundColor: '#3266a8' + '0D',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3266a8',
    fontWeight: 'bold',
  },
  lostTabText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  foundTabText: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
    paddingBottom: 60,
  },
  itemSeparator: {
    height: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3266a8' + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyActionButton: {
    flexDirection: 'row',
    backgroundColor: '#3266a8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  emptyActionButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
});

export default UserItemHistory;