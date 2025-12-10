import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  BackHandler
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';


const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ProfessionalAlert = ({ 
  visible, 
  title, 
  message, 
  buttons = [], 
  type = 'info', // 'success', 'error', 'warning', 'info', 'confirm'
  onDismiss 
}) => {
  const styles = createStyles();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) {
        handleDismiss();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [visible]);

  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle', color: '#28a745', backgroundColor: '#f8f9fa' };
      case 'error':
        return { name: 'close-circle', color: '#dc3545', backgroundColor: '#f8f9fa' };
      case 'warning':
        return { name: 'warning', color: '#ffc107', backgroundColor: '#f8f9fa' };
      case 'confirm':
        return { name: 'help-circle', color: '#3266a8', backgroundColor: '#f8f9fa' };
      default:
        return { name: 'information-circle', color: '#17a2b8', backgroundColor: '#f8f9fa' };
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleButtonPress = (button) => {
    if (button.onPress) {
      button.onPress();
    }
    handleDismiss();
  };

  const iconConfig = getIconConfig();

  // Default buttons if none provided
  const alertButtons = buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.overlayTouch} 
          activeOpacity={1} 
          onPress={handleDismiss}
        >
          <Animated.View 
            style={[
              styles.alertContainer,
              {
                transform: [{ scale: scaleAnim }],
                opacity: fadeAnim
              }
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: iconConfig.backgroundColor }]}>
                <Ionicons 
                  name={iconConfig.name} 
                  size={32} 
                  color={iconConfig.color} 
                />
              </View>

              {/* Title */}
              {title && (
                <Text style={styles.title}>{title}</Text>
              )}

              {/* Message */}
              {message && (
                <Text style={styles.message}>{message}</Text>
              )}

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                {alertButtons.map((button, index) => {
                  const isDestructive = button.style === 'destructive';
                  const isCancel = button.style === 'cancel';
                  const isPrimary = button.style === 'default' || (!isDestructive && !isCancel);
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        isDestructive && styles.destructiveButton,
                        isCancel && styles.cancelButton,
                        isPrimary && styles.primaryButton,
                        alertButtons.length === 1 && styles.singleButton,
                        index === 0 && alertButtons.length > 1 && styles.firstButton,
                        index === alertButtons.length - 1 && alertButtons.length > 1 && styles.lastButton
                      ]}
                      onPress={() => handleButtonPress(button)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.buttonText,
                        isDestructive && styles.destructiveButtonText,
                        isCancel && styles.cancelButtonText,
                        isPrimary && styles.primaryButtonText
                      ]}>
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const createStyles = () => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouch: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    maxWidth: screenWidth - 64,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  singleButton: {
    marginHorizontal: 0,
  },
  firstButton: {
    marginLeft: 0,
  },
  lastButton: {
    marginRight: 0,
  },
  primaryButton: {
    backgroundColor: '#3266a8',
  },
  destructiveButton: {
    backgroundColor: '#dc3545',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#fff',
  },
  destructiveButtonText: {
    color: '#fff',
  },
  cancelButtonText: {
    color: '#666',
  },
});

export default ProfessionalAlert;