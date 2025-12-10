import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  ImageBackground,
  KeyboardAvoidingView,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendVerificationCode, verifyCode, getVerificationStatus } from '../../../shared/services/emailVerificationService';
import { sendEmailAlertNotification } from '../../../shared/services/notificationService';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';

const { width: screenWidth } = Dimensions.get('window');

const TwoFactorVerificationScreen = ({ navigation, route }) => {
  const { userEmail, userData, isFirstLogin } = route.params;

  
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  // Professional Alert
  const { alertConfig, showAlert, hideAlert, showError, showSuccess } = useProfessionalAlert();
  
  // Refs for input management
  const inputRefs = useRef([]);
  const [codeInputs, setCodeInputs] = useState(['', '', '', '', '', '']);

  useEffect(() => {
    // Initial animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();

    // Send initial verification code
    sendInitialCode();

    // Cleanup countdown on unmount
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  const countdownInterval = useRef(null);

  const startCountdown = () => {
    setCountdown(60);
    countdownInterval.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendInitialCode = async () => {
    setIsLoading(true);
    try {
      const result = await sendVerificationCode(userEmail);
      if (result.success) {
        showSuccess(
          'Verification Code Sent',
          `A 6-digit verification code has been sent to ${userEmail}. Please check your email and enter the code below.`
        );
        startCountdown();
        
        // Send email alert notification
        await sendEmailAlertNotification(
          'Verification Code Sent',
          `Tap to open Gmail and get your verification code for ${userEmail.split('@')[0]}`,
          userEmail
        );
      } else {
        showError('Error', result.message);
      }
    } catch (error) {
      console.error('Error sending initial code:', error);
      showError('Error', 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0 || isResending) return;
    
    setIsResending(true);
    try {
      const result = await sendVerificationCode(userEmail);
      if (result.success) {
        showSuccess('Code Resent', 'A new verification code has been sent to your email.');
        startCountdown();
        // Clear current inputs
        setCodeInputs(['', '', '', '', '', '']);
        setVerificationCode('');
        // Focus first input
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
        
        // Send email alert notification
        await sendEmailAlertNotification(
          'New Verification Code Sent',
          `Tap to open Gmail and get your new verification code for ${userEmail.split('@')[0]}`,
          userEmail
        );
      } else {
        showError('Error', result.message);
      }
    } catch (error) {
      console.error('Error resending code:', error);
      showError('Error', 'Failed to resend verification code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCodeInputChange = (text, index) => {
    // Only allow numeric input
    const numericText = text.replace(/[^0-9]/g, '');
    
    const newCodeInputs = [...codeInputs];
    newCodeInputs[index] = numericText;
    setCodeInputs(newCodeInputs);
    
    // Update the full verification code
    const fullCode = newCodeInputs.join('');
    setVerificationCode(fullCode);
    
    // Auto-focus next input
    if (numericText && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-verify when all 6 digits are entered
    if (fullCode.length === 6) {
      handleVerifyCode(fullCode);
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !codeInputs[index] && index > 0) {
      // Focus previous input on backspace
      inputRefs.current[index - 1]?.focus();
    }
  };

  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleVerifyCode = async (codeToVerify = verificationCode) => {
    if (codeToVerify.length !== 6) {
      showError('Invalid Code', 'Please enter a 6-digit verification code.');
      shakeAnimation();
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyCode(userEmail, codeToVerify);
      
      if (result.success) {
        showSuccess(
          'Verification Successful',
          'Your email has been verified successfully!',
          [{
            text: 'Continue',
            onPress: () => {
              // Navigate to main app with first login flag (passed from LoginScreen)
              navigation.reset({
                index: 0,
                routes: [{ 
                  name: 'Main', 
                  params: { 
                    screen: 'Home',
                    params: { isFirstLogin: isFirstLogin || false }
                  }
                }],
              });
            }
          }]
        );
      } else {
        setAttempts(prev => prev + 1);
        showError('Verification Failed', result.message);
        shakeAnimation();
        
        // Clear inputs on failed attempt
        setCodeInputs(['', '', '', '', '', '']);
        setVerificationCode('');
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      showError('Error', 'An error occurred during verification. Please try again.');
      shakeAnimation();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    Alert.alert(
      'Cancel Verification',
      'Are you sure you want to go back? You will need to sign in again.',
      [
        { text: 'Stay', style: 'cancel' },
        { 
          text: 'Go Back', 
          style: 'destructive',
          onPress: () => navigation.goBack()
        }
      ]
    );
  };

  const maskedEmail = userEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  return (
    <ImageBackground
      source={require('../../../../assets/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View 
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [
                    { translateY: slideAnim },
                    { translateX: shakeAnim }
                  ]
                }
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={handleGoBack}
                >
                  <Ionicons name="arrow-back" size={24} color="#3266a8" />
                </TouchableOpacity>
                
                <View style={styles.iconContainer}>
                  <Ionicons name="shield-checkmark" size={60} color="#3266a8" />
                </View>
                
                <Text style={styles.title}>Two-Factor Authentication</Text>
                <Text style={styles.subtitle}>
                  We've sent a 6-digit verification code to
                </Text>
                <Text style={styles.emailText}>{maskedEmail}</Text>
              </View>

              {/* Code Input */}
              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Enter Verification Code</Text>
                <View style={styles.codeInputContainer}>
                  {codeInputs.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={ref => inputRefs.current[index] = ref}
                      style={[
                        styles.codeInput,
                        digit ? styles.codeInputFilled : null
                      ]}
                      value={digit}
                      onChangeText={(text) => handleCodeInputChange(text, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="numeric"
                      maxLength={1}
                      textAlign="center"
                      selectTextOnFocus
                      autoFocus={index === 0}
                    />
                  ))}
                </View>
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  (verificationCode.length !== 6 || isLoading) && styles.verifyButtonDisabled
                ]}
                onPress={() => handleVerifyCode()}
                disabled={verificationCode.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.verifyButtonText}>Verify Code</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Resend Code */}
              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>Didn't receive the code?</Text>
                <TouchableOpacity
                  style={[
                    styles.resendButton,
                    (countdown > 0 || isResending) && styles.resendButtonDisabled
                  ]}
                  onPress={handleResendCode}
                  disabled={countdown > 0 || isResending}
                >
                  {isResending ? (
                    <ActivityIndicator size="small" color="#3266a8" />
                  ) : (
                    <Text style={[
                      styles.resendButtonText,
                      (countdown > 0) && styles.resendButtonTextDisabled
                    ]}>
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Help Text */}
              <View style={styles.helpContainer}>
                <Ionicons name="information-circle" size={16} color="#666" />
                <Text style={styles.helpText}>
                  The verification code will expire in 10 minutes. Check your spam folder if you don't see the email.
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
        
        <ProfessionalAlert
          visible={alertConfig.visible}
          type={alertConfig.type}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          onDismiss={hideAlert}
        />
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    position: 'absolute',
    top: -10,
    left: -10,
    padding: 10,
    zIndex: 1,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3266a8',
    textAlign: 'center',
  },
  codeContainer: {
    marginBottom: 30,
  },
  codeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  codeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  codeInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#2c3e50',
    backgroundColor: '#fff',
  },
  codeInputFilled: {
    borderColor: '#3266a8',
    backgroundColor: '#f0f4ff',
  },
  verifyButton: {
    backgroundColor: '#3266a8',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3266a8',
  },
  resendButtonTextDisabled: {
    color: '#ccc',
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3266a8',
  },
  helpText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginLeft: 8,
  },
});

export default withInternetGuard(TwoFactorVerificationScreen);