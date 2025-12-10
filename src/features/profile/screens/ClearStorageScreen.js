import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  clearAllReportItems, 
  clearLostItems, 
  clearFoundItems, 
  clearMatches,
  clearAllItemsAndMatches,
  clearClaimRequests,
  clearNotifications,
  clearEverything
} from '../../../shared/utils/clearStorage';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';

const ClearStorageScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [activeOperation, setActiveOperation] = useState(null);
  
  const { alertConfig, showError, showSuccess, showConfirm, hideAlert } = useProfessionalAlert();
  const styles = createStyles();

  const handleClearOperation = async (operation, title, message, clearFunction) => {
    showConfirm(
      title,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setActiveOperation(operation);
            try {
              const success = await clearFunction();
              if (success) {
                showSuccess('Success', `${title} have been cleared.`);
              } else {
                showError('Error', `Failed to clear ${title.toLowerCase()}. Please try again.`);
              }
            } catch (error) {
              console.error(`Error clearing ${operation}:`, error);
              showError('Error', 'An unexpected error occurred.');
            } finally {
              setLoading(false);
              setActiveOperation(null);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Define clear operations
  const clearOperations = [
    {
      id: 'lost_items',
      title: 'Lost Items',
      icon: 'search-outline',
      color: '#dc3545',
      message: 'Are you sure you want to delete all your lost items? This action cannot be undone.',
      action: () => handleClearOperation('lost_items', 'Lost Items', 'Are you sure you want to delete all your lost items? This action cannot be undone.', clearLostItems)
    },
    {
      id: 'found_items',
      title: 'Found Items',
      icon: 'checkmark-circle-outline',
      color: '#dc3545',
      message: 'Are you sure you want to delete all your found items? This action cannot be undone.',
      action: () => handleClearOperation('found_items', 'Found Items', 'Are you sure you want to delete all your found items? This action cannot be undone.', clearFoundItems)
    },
    {
      id: 'matches',
      title: 'Matches',
      icon: 'git-compare-outline',
      color: '#dc3545',
      message: 'Are you sure you want to delete all your matches? This action cannot be undone.',
      action: () => handleClearOperation('matches', 'Matches', 'Are you sure you want to delete all your matches? This action cannot be undone.', clearMatches)
    },
    {
      id: 'claim_requests',
      title: 'Claim Requests',
      icon: 'clipboard-outline',
      color: '#dc3545',
      message: 'Are you sure you want to delete all your claim requests? This action cannot be undone.',
      action: () => handleClearOperation('claim_requests', 'Claim Requests', 'Are you sure you want to delete all your claim requests? This action cannot be undone.', clearClaimRequests)
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: 'notifications-outline',
      color: '#dc3545',
      message: 'Are you sure you want to delete all your notifications? This action cannot be undone.',
      action: () => handleClearOperation('notifications', 'Notifications', 'Are you sure you want to delete all your notifications? This action cannot be undone.', clearNotifications)
    },
    {
      id: 'all_items',
      title: 'All Items',
      icon: 'trash-outline',
      color: '#dc3545',
      message: 'Are you sure you want to delete all your items (lost and found)? This action cannot be undone.',
      action: () => handleClearOperation('all_items', 'All Items', 'Are you sure you want to delete all your items (lost and found)? This action cannot be undone.', clearAllReportItems)
    },
    {
      id: 'everything',
      title: 'Everything (Items & Matches)',
      icon: 'trash-bin-outline',
      color: '#dc3545',
      message: 'Are you sure you want to delete all your items and matches? This action cannot be undone.',
      action: () => handleClearOperation('everything', 'All Items and Matches', 'Are you sure you want to delete all your items and matches? This action cannot be undone.', clearAllItemsAndMatches)
    },
    {
      id: 'complete_reset',
      title: 'Complete Reset (All Data)',
      icon: 'nuclear-outline',
      color: '#dc3545',
      message: 'Are you sure you want to delete ALL data including items, matches, claim requests, and notifications? This action cannot be undone.',
      action: () => handleClearOperation('complete_reset', 'All Data', 'Are you sure you want to delete ALL data including items, matches, claim requests, and notifications? This action cannot be undone.', clearEverything)
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Management</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.warning}>
            Warning: The following actions will permanently delete data from your app. These actions cannot be undone.
          </Text>
          
          {clearOperations.map((operation) => (
            <TouchableOpacity
              key={operation.id}
              style={[styles.operationButton, loading && styles.buttonDisabled]}
              onPress={operation.action}
              disabled={loading}
            >
              <View style={styles.operationContent}>
                <Ionicons name={operation.icon} size={24} color={operation.color} style={styles.operationIcon} />
                <View style={styles.operationTextContainer}>
                  <Text style={styles.operationTitle}>{operation.title}</Text>
                </View>
              </View>
              {loading && activeOperation === operation.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="chevron-forward-outline" size={20} color="#666" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      
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
    paddingVertical: 12,
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
  },
  content: {
    padding: 20,
  },
  warning: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#f8d7da',
    paddingVertical: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  operationButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  operationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  operationIcon: {
    marginRight: 15,
  },
  operationTextContainer: {
    flex: 1,
  },
  operationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default withInternetGuard(ClearStorageScreen);