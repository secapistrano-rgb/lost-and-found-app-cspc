import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Matches API has been removed
import { useNotifications } from '../../../contexts/NotificationContext';
import { deleteNotification } from '../../../shared/services/notificationService';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import { formatPhilippineDate } from '../../../shared/utils/dateUtils';

const NotificationsScreen = ({ navigation }) => {
  // Use notification context for real-time updates
  const { 
    notifications, 
    isLoading: loading, 
    loadNotifications, 
    markAsRead, 
    clearAll 
  } = useNotifications();
  
  const { alertConfig, showError, showConfirm, hideAlert } = useProfessionalAlert();

  useEffect(() => {
    // Load notifications when screen focuses
    const unsubscribe = navigation.addListener('focus', () => {
      loadNotifications();
    });
    
    return unsubscribe;
  }, [navigation, loadNotifications]);

  // Add aggressive auto-refresh when on notifications screen (every 2 seconds)
  useEffect(() => {
    // Initial load
    loadNotifications();
    
    // Set up interval for faster updates on this screen
    const intervalId = setInterval(() => {
      loadNotifications();
    }, 2000); // Refresh every 2 seconds when on notifications screen
    
    return () => {
      clearInterval(intervalId);
    };
  }, [loadNotifications]);
  
  const handleNotificationPress = async (notification) => {
    // Skip if already read
    if (notification.read) {
      navigateToNotificationContent(notification);
      return;
    }
    
    // Mark notification as read using context
    await markAsRead(notification.id);
    
    // Signal to HomeScreen that a notification was read
    navigation.setParams({ notificationRead: true });
    
    // Navigate based on notification type
    navigateToNotificationContent(notification);
  };
  
  // Navigate to the content referenced by the notification
  const navigateToNotificationContent = async (notification) => {
    if (notification.type === 'match' && notification.data?.matchId) {
      // Get the match details from storage
      const { getMatchWithDetails } = require('../../../shared/storage/storage');
      const match = await getMatchWithDetails(notification.data.matchId);
      
      if (match) {
        navigation.navigate('MatchDetails', { match });
      } else {
        // Match might have been deleted
        showError('Match Not Found', 'This match may have been removed.');
      }
    } else if (notification.type === 'claimRequest' && notification.data?.claimId) {
      // Navigate to claim requests screen
      navigation.navigate('ClaimRequests');
    } else if (notification.type === 'claim' && notification.data?.itemId) {
      // Navigate to the item details
      const itemId = notification.data.itemId;
      navigation.navigate('ItemDetails', { itemId, itemType: 'found' });
    } else if (notification.type === 'feedbackResponse' && notification.data?.feedbackId) {
      // Navigate to user feedback screen to view the response
      navigation.navigate('UserFeedback', { highlightFeedbackId: notification.data.feedbackId });
    } else if ((notification.type === 'supportStatus' || notification.type === 'supportResponse') && notification.data?.ticketId) {
      // Navigate to help & support screen with ticket details
      navigation.navigate('HelpSupport', { highlightTicketId: notification.data.ticketId });
    } else if (notification.type === 'finderClaim' && notification.data?.itemId) {
      // Navigate to item details to see the claimed item
      navigation.navigate('ItemDetails', { 
        itemId: notification.data.itemId, 
        itemType: 'found' 
      });
    }
  };
  
  const formatDate = (dateString) => {
    // Use Philippine time formatter
    return formatPhilippineDate(dateString);
  };
  
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.notificationItem, item.read && styles.readNotification]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.iconContainer}>
        {item.type === 'match' ? (
          <Ionicons name="git-compare" size={24} color="#3498db" />
        ) : item.type === 'claimRequest' ? (
          <Ionicons name="clipboard" size={24} color="#9b59b6" />
        ) : item.type === 'claim' ? (
          <Ionicons name="hand-left" size={24} color="#e67e22" />
        ) : item.type === 'feedbackResponse' ? (
          <Ionicons name="chatbubble-ellipses" size={24} color="#27ae60" />
        ) : item.type === 'supportStatus' ? (
          <Ionicons name="help-circle" size={24} color="#f39c12" />
        ) : item.type === 'supportResponse' ? (
          <Ionicons name="chatbubbles" size={24} color="#16a085" />
        ) : item.type === 'finderClaim' ? (
          <Ionicons name="trophy" size={24} color="#f1c40f" />
        ) : (
          <Ionicons name="notifications" size={24} color="#3498db" />
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>
      
      {!item.read && <View style={styles.unreadIndicator} />}
    </TouchableOpacity>
  );
  
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>No notifications</Text>
      <Text style={styles.emptySubtext}>
        When there are updates about your lost or found items, they will appear here
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => {
              showConfirm(
                'Clear All Notifications',
                'Are you sure you want to clear all notifications?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Clear All', 
                    style: 'destructive',
                    onPress: async () => {
                      await clearAll();
                      navigation.setParams({ notificationsCleared: true });
                    } 
                  },
                ]
              );
            }}
          >
            <Ionicons name="trash-outline" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyList}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadNotifications}
        />
      )}
      
      <ProfessionalAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        type={alertConfig.type}
        onDismiss={hideAlert}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 29,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    position: 'relative',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 1,
  },
  clearButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 100,
  },
  readNotification: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e1f5fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3498db',
    marginLeft: 8,
    alignSelf: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#888',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
});

export default NotificationsScreen;
