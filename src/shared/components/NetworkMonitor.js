import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useNetworkStatus from '../hooks/useNetworkStatus';

/**
 * Network Monitor Component
 * Displays an alert when internet connection is lost
 * @param {Object} props - Component props
 * @param {boolean} props.showInline - Show inline banner instead of alert
 * @param {Function} props.onConnectionChange - Callback when connection changes
 */
const NetworkMonitor = ({ showInline = false, onConnectionChange }) => {
  const { hasInternet, isConnected, isInternetReachable } = useNetworkStatus();
  const [showModal, setShowModal] = useState(false);
  const hasShownInitialCheck = useRef(false);

  useEffect(() => {
    // Call callback if provided
    if (onConnectionChange) {
      onConnectionChange(hasInternet);
    }

    // Don't show alert on initial mount
    if (!hasShownInitialCheck.current) {
      hasShownInitialCheck.current = true;
      return;
    }

    // Show modal when connection is lost
    if (!hasInternet && !showInline) {
      setShowModal(true);
    } else if (hasInternet) {
      // Hide modal when connection is restored
      setShowModal(false);
    }
  }, [hasInternet, showInline, onConnectionChange]);

  // Show inline banner if requested
  if (showInline && !hasInternet) {
    return (
      <View style={styles.banner}>
        <Ionicons name="cloud-offline" size={20} color="#fff" />
        <Text style={styles.bannerText}>
          No Internet Connection
        </Text>
      </View>
    );
  }

  // Show modal alert
  return (
    <Modal
      visible={showModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-offline-outline" size={48} color="#e74c3c" />
          </View>
          
          <Text style={styles.modalTitle}>No Internet Connection</Text>
          <Text style={styles.modalMessage}>
            Internet connection is required to use this app. Please check your connection and try again.
          </Text>
          
          <TouchableOpacity
            style={styles.okButton}
            onPress={() => setShowModal(false)}
          >
            <Text style={styles.okButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#e74c3c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    gap: 10
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center'
  },
  modalMessage: {
    fontSize: 15,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  okButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 48,
    borderRadius: 25,
    minWidth: 120
  },
  okButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  }
});

export default NetworkMonitor;
