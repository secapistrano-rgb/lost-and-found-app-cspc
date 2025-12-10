import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';

/**
 * Offline Screen - Blocks app usage when no internet connection
 * Displays a full-screen overlay with retry option
 */
const OfflineScreen = ({ onRetry }) => {
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    setChecking(true);
    const state = await NetInfo.fetch();
    const hasInternet = state.isConnected && state.isInternetReachable !== false;
    
    if (hasInternet && onRetry) {
      onRetry();
    }
    
    setTimeout(() => setChecking(false), 1000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="cloud-offline" size={100} color="#e74c3c" />
        
        <Text style={styles.title}>No Internet Connection</Text>
        
        <Text style={styles.message}>
          This app requires an active internet connection to work.
        </Text>
        
        <Text style={styles.description}>
          Please check your connection and try again. You need to be connected to:
        </Text>
        
        <View style={styles.requirementsList}>
          <View style={styles.requirementItem}>
            <Ionicons name="checkmark-circle" size={20} color="#3498db" />
            <Text style={styles.requirementText}>Wi-Fi or Mobile Data</Text>
          </View>
          <View style={styles.requirementItem}>
            <Ionicons name="checkmark-circle" size={20} color="#3498db" />
            <Text style={styles.requirementText}>Active Internet Connection</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.retryButton}
          onPress={handleRetry}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="refresh" size={24} color="#fff" />
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Ionicons name="information-circle" size={16} color="#95a5a6" />
          <Text style={styles.footerText}>
            Internet is required for login, creating items, and all app features
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginBottom: 20,
  },
  requirementsList: {
    alignSelf: 'stretch',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  requirementText: {
    fontSize: 14,
    color: '#2c3e50',
    marginLeft: 10,
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    marginBottom: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#95a5a6',
    marginLeft: 8,
    textAlign: 'center',
    flex: 1,
  },
});

export default OfflineScreen;
