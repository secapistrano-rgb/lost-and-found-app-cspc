import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import emailService from './emailService';

// Storage keys
const VERIFICATION_CODES_KEY = 'verification_codes';
const VERIFICATION_ATTEMPTS_KEY = 'verification_attempts';
const BLOCKED_USERS_KEY = 'blocked_users';

// Configuration
const CONFIG = {
  CODE_LENGTH: 6,
  CODE_EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS_PER_HOUR: 5,
  MAX_VERIFICATION_ATTEMPTS: 5,
  BLOCK_DURATION_MINUTES: 10,
};

/**
 * Generate a random verification code
 * @returns {string} 6-digit verification code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Get current timestamp
 * @returns {number} Current timestamp in milliseconds
 */
const getCurrentTimestamp = () => {
  return Date.now();
};

/**
 * Check if user is blocked from requesting codes
 * @param {string} email - User's email address
 * @returns {Promise<{isBlocked: boolean, remainingTime?: number}>}
 */
export const checkUserBlocked = async (email) => {
  try {
    const blockedUsersData = await AsyncStorage.getItem(BLOCKED_USERS_KEY);
    const blockedUsers = blockedUsersData ? JSON.parse(blockedUsersData) : {};
    
    const userBlock = blockedUsers[email];
    if (!userBlock) {
      return { isBlocked: false };
    }
    
    const currentTime = getCurrentTimestamp();
    const blockExpiry = userBlock.blockedUntil;
    
    if (currentTime < blockExpiry) {
      const remainingTime = Math.ceil((blockExpiry - currentTime) / (1000 * 60)); // minutes
      return { isBlocked: true, remainingTime };
    } else {
      // Block has expired, remove it
      delete blockedUsers[email];
      await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(blockedUsers));
      return { isBlocked: false };
    }
  } catch (error) {
    console.error('Error checking user block status:', error);
    return { isBlocked: false };
  }
};

/**
 * Check rate limiting for verification code requests
 * @param {string} email - User's email address
 * @returns {Promise<{allowed: boolean, remainingAttempts?: number}>}
 */
export const checkRateLimit = async (email) => {
  try {
    const attemptsData = await AsyncStorage.getItem(VERIFICATION_ATTEMPTS_KEY);
    const attempts = attemptsData ? JSON.parse(attemptsData) : {};
    
    const userAttempts = attempts[email] || [];
    const currentTime = getCurrentTimestamp();
    const oneHourAgo = currentTime - (60 * 60 * 1000);
    
    // Filter attempts from the last hour
    const recentAttempts = userAttempts.filter(timestamp => timestamp > oneHourAgo);
    
    if (recentAttempts.length >= CONFIG.MAX_ATTEMPTS_PER_HOUR) {
      return { 
        allowed: false, 
        remainingAttempts: 0 
      };
    }
    
    return { 
      allowed: true, 
      remainingAttempts: CONFIG.MAX_ATTEMPTS_PER_HOUR - recentAttempts.length 
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true, remainingAttempts: CONFIG.MAX_ATTEMPTS_PER_HOUR };
  }
};

/**
 * Record a verification code request attempt
 * @param {string} email - User's email address
 */
const recordAttempt = async (email) => {
  try {
    const attemptsData = await AsyncStorage.getItem(VERIFICATION_ATTEMPTS_KEY);
    const attempts = attemptsData ? JSON.parse(attemptsData) : {};
    
    const userAttempts = attempts[email] || [];
    userAttempts.push(getCurrentTimestamp());
    
    attempts[email] = userAttempts;
    await AsyncStorage.setItem(VERIFICATION_ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch (error) {
    console.error('Error recording attempt:', error);
  }
};

// Email sending is now handled by the emailService

/**
 * Generate and send verification code
 * @param {string} email - User's email address
 * @returns {Promise<{success: boolean, message: string, code?: string}>}
 */
export const sendVerificationCode = async (email) => {
  try {
    // Validate email
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Invalid email address' };
    }
    
    // Check if user is blocked
    const blockStatus = await checkUserBlocked(email);
    if (blockStatus.isBlocked) {
      return { 
        success: false, 
        message: `Too many failed attempts. Please try again in ${blockStatus.remainingTime} minutes.` 
      };
    }
    
    // Check rate limiting
    const rateLimit = await checkRateLimit(email);
    if (!rateLimit.allowed) {
      return { 
        success: false, 
        message: 'Too many verification requests. Please try again later.' 
      };
    }
    
    // Generate verification code
    const code = generateVerificationCode();
    const expiryTime = getCurrentTimestamp() + (CONFIG.CODE_EXPIRY_MINUTES * 60 * 1000);
    
    // Store verification code
    const codesData = await AsyncStorage.getItem(VERIFICATION_CODES_KEY);
    const codes = codesData ? JSON.parse(codesData) : {};
    
    codes[email] = {
      code,
      expiryTime,
      attempts: 0,
      createdAt: getCurrentTimestamp()
    };
    
    await AsyncStorage.setItem(VERIFICATION_CODES_KEY, JSON.stringify(codes));
    
    // Record the attempt
    await recordAttempt(email);
    
    // Send verification code via email
    console.log('Sending verification code via email to:', email);
    const emailResult = await emailService.sendVerificationCode(email, code, 'User');
    
    if (emailResult.success) {
      return { 
        success: true, 
        message: 'Verification code sent to your email address'
      };
    } else {
      // If email fails, still allow the process but inform user
      console.error('Email sending failed:', emailResult.message);
      return { 
        success: false, 
        message: emailResult.message || 'Failed to send verification email. Please check your email configuration.'
      };
    }
    
  } catch (error) {
    console.error('Error generating verification code:', error);
    return { success: false, message: 'An error occurred. Please try again.' };
  }
};

/**
 * Verify the provided code
 * @param {string} email - User's email address
 * @param {string} inputCode - Code entered by user
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const verifyCode = async (email, inputCode) => {
  try {
    // Validate inputs
    if (!email || !inputCode) {
      return { success: false, message: 'Email and verification code are required' };
    }
    
    // Get stored codes
    const codesData = await AsyncStorage.getItem(VERIFICATION_CODES_KEY);
    const codes = codesData ? JSON.parse(codesData) : {};
    
    const storedCodeData = codes[email];
    if (!storedCodeData) {
      return { success: false, message: 'No verification code found. Please request a new one.' };
    }
    
    // Check if code has expired
    const currentTime = getCurrentTimestamp();
    if (currentTime > storedCodeData.expiryTime) {
      // Remove expired code
      delete codes[email];
      await AsyncStorage.setItem(VERIFICATION_CODES_KEY, JSON.stringify(codes));
      return { success: false, message: 'Verification code has expired. Please request a new one.' };
    }
    
    // Check attempt limit
    if (storedCodeData.attempts >= CONFIG.MAX_VERIFICATION_ATTEMPTS) {
      // Block user and remove code
      await blockUser(email);
      delete codes[email];
      await AsyncStorage.setItem(VERIFICATION_CODES_KEY, JSON.stringify(codes));
      return { 
        success: false, 
        message: `Too many failed attempts. You are blocked for ${CONFIG.BLOCK_DURATION_MINUTES} minutes.` 
      };
    }
    
    // Verify code
    if (inputCode.trim() === storedCodeData.code) {
      // Success - remove the code
      delete codes[email];
      await AsyncStorage.setItem(VERIFICATION_CODES_KEY, JSON.stringify(codes));
      return { success: true, message: 'Verification successful' };
    } else {
      // Increment attempts
      storedCodeData.attempts += 1;
      codes[email] = storedCodeData;
      await AsyncStorage.setItem(VERIFICATION_CODES_KEY, JSON.stringify(codes));
      
      const remainingAttempts = CONFIG.MAX_VERIFICATION_ATTEMPTS - storedCodeData.attempts;
      return { 
        success: false, 
        message: `Invalid verification code. ${remainingAttempts} attempts remaining.` 
      };
    }
    
  } catch (error) {
    console.error('Error verifying code:', error);
    return { success: false, message: 'An error occurred during verification. Please try again.' };
  }
};

/**
 * Block user from requesting codes
 * @param {string} email - User's email address
 */
const blockUser = async (email) => {
  try {
    const blockedUsersData = await AsyncStorage.getItem(BLOCKED_USERS_KEY);
    const blockedUsers = blockedUsersData ? JSON.parse(blockedUsersData) : {};
    
    const blockUntil = getCurrentTimestamp() + (CONFIG.BLOCK_DURATION_MINUTES * 60 * 1000);
    
    blockedUsers[email] = {
      blockedAt: getCurrentTimestamp(),
      blockedUntil: blockUntil
    };
    
    await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(blockedUsers));
  } catch (error) {
    console.error('Error blocking user:', error);
  }
};

/**
 * Clean up expired codes and blocks
 * @returns {Promise<void>}
 */
export const cleanupExpiredData = async () => {
  try {
    const currentTime = getCurrentTimestamp();
    
    // Clean up expired verification codes
    const codesData = await AsyncStorage.getItem(VERIFICATION_CODES_KEY);
    if (codesData) {
      const codes = JSON.parse(codesData);
      const validCodes = {};
      
      Object.keys(codes).forEach(email => {
        if (codes[email].expiryTime > currentTime) {
          validCodes[email] = codes[email];
        }
      });
      
      await AsyncStorage.setItem(VERIFICATION_CODES_KEY, JSON.stringify(validCodes));
    }
    
    // Clean up expired blocks
    const blockedUsersData = await AsyncStorage.getItem(BLOCKED_USERS_KEY);
    if (blockedUsersData) {
      const blockedUsers = JSON.parse(blockedUsersData);
      const activeBlocks = {};
      
      Object.keys(blockedUsers).forEach(email => {
        if (blockedUsers[email].blockedUntil > currentTime) {
          activeBlocks[email] = blockedUsers[email];
        }
      });
      
      await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(activeBlocks));
    }
    
    // Clean up old attempts (keep only last 24 hours)
    const attemptsData = await AsyncStorage.getItem(VERIFICATION_ATTEMPTS_KEY);
    if (attemptsData) {
      const attempts = JSON.parse(attemptsData);
      const oneDayAgo = currentTime - (24 * 60 * 60 * 1000);
      
      Object.keys(attempts).forEach(email => {
        attempts[email] = attempts[email].filter(timestamp => timestamp > oneDayAgo);
        if (attempts[email].length === 0) {
          delete attempts[email];
        }
      });
      
      await AsyncStorage.setItem(VERIFICATION_ATTEMPTS_KEY, JSON.stringify(attempts));
    }
    
  } catch (error) {
    console.error('Error cleaning up expired data:', error);
  }
};

/**
 * Get verification status for debugging
 * @param {string} email - User's email address
 * @returns {Promise<object>} Verification status
 */
export const getVerificationStatus = async (email) => {
  try {
    const codesData = await AsyncStorage.getItem(VERIFICATION_CODES_KEY);
    const codes = codesData ? JSON.parse(codesData) : {};
    
    const blockStatus = await checkUserBlocked(email);
    const rateLimit = await checkRateLimit(email);
    
    return {
      hasActiveCode: !!codes[email],
      codeExpiry: codes[email]?.expiryTime,
      attempts: codes[email]?.attempts || 0,
      isBlocked: blockStatus.isBlocked,
      remainingRequests: rateLimit.remainingAttempts
    };
  } catch (error) {
    console.error('Error getting verification status:', error);
    return {};
  }
};

/**
 * Clear all verification rate limiting data (for development/testing)
 * @returns {Promise<void>}
 */
export const clearAllVerificationData = async () => {
  try {
    await AsyncStorage.multiRemove([
      VERIFICATION_CODES_KEY,
      VERIFICATION_ATTEMPTS_KEY,
      BLOCKED_USERS_KEY
    ]);
    console.log('Successfully cleared all verification rate limiting data');
  } catch (error) {
    console.error('Error clearing verification data:', error);
  }
};

export default {
  sendVerificationCode,
  verifyCode,
  checkUserBlocked,
  checkRateLimit,
  cleanupExpiredData,
  getVerificationStatus,
  clearAllVerificationData
};