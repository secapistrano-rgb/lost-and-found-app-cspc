import { clearAllVerificationData } from '../shared/services/emailVerificationService';

/**
 * Development utilities for testing and debugging
 */

/**
 * Clear all verification rate limiting data
 * Call this function in your app to reset verification limits
 */
export const clearVerificationLimits = async () => {
  try {
    await clearAllVerificationData();
    console.log('✅ Verification rate limits cleared successfully!');
    alert('Verification rate limits cleared! You can now request verification codes again.');
  } catch (error) {
    console.error('❌ Failed to clear verification limits:', error);
    alert('Failed to clear verification limits. Check console for details.');
  }
};

/**
 * Add this to any screen temporarily to clear verification limits:
 * 
 * import { clearVerificationLimits } from '../utils/devUtils';
 * 
 * // Add a button:
 * <Button title="Clear Verification Limits" onPress={clearVerificationLimits} />
 * 
 * // Or call directly in useEffect:
 * useEffect(() => {
 *   clearVerificationLimits();
 * }, []);
 */

export default {
  clearVerificationLimits
};