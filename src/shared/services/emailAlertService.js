import emailService from './emailService';
import { isEmailAlertsEnabled } from '../utils/settingsUtils';
import { EMAIL_CONFIG } from '../../config/emailConfig';

/**
 * Email Alert Service for sending notification emails
 * This service checks user settings before sending email alerts
 * Note: This is separate from verification emails which should always be sent
 */

class EmailAlertService {
  constructor() {
    this.emailService = emailService;
    this.isInitialized = false;
  }

  /**
   * Initialize the email alert service
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initializeEmailAlerts() {
    try {
      console.log('Initializing email alert service...');
      
      // Validate EmailJS configuration
      const emailjs = require('@emailjs/react-native');
      
      // Initialize EmailJS
      emailjs.init({
        publicKey: EMAIL_CONFIG.PUBLIC_KEY,
        blockNonBrowser: false
      });
      
      this.isInitialized = true;
      console.log('Email alert service initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing email alert service:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Force reinitialize email alerts (resets the isInitialized flag)
   * @returns {Promise<boolean>} Whether reinitialization was successful
   */
  async forceReinitializeEmailAlerts() {
    try {
      console.log('Force reinitializing email alert service...');
      
      // Reset the initialization flag
      this.isInitialized = false;
      
      // Reinitialize the email alert service
      const result = await this.initializeEmailAlerts();
      
      if (result) {
        console.log('Email alert service successfully reinitialized');
      } else {
        console.warn('Failed to reinitialize email alert service');
      }
      
      return result;
    } catch (error) {
      console.error('Error force reinitializing email alerts:', error);
      return false;
    }
  }

  /**
   * Send match notification email
   * @param {string} email - Recipient email address
   * @param {Object} match - Match data
   * @param {string} userName - User's name
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async sendMatchNotificationEmail(email, match, userName = 'User') {
    try {
      // Check if email alerts are enabled
      const emailAlertsEnabled = await isEmailAlertsEnabled();
      
      if (!emailAlertsEnabled) {
        console.log('Email alerts disabled, skipping match notification email for:', email);
        return {
          success: true,
          message: 'Email alerts disabled - notification not sent'
        };
      }

      const { lostItem, foundItem, score } = match;
      const scorePercent = Math.round(score * 100);
      
      // Determine email content based on match context
      let subject, body;
      if (lostItem.reporterId === email) {
        subject = `Suggested Match Found for Your Lost Item (${scorePercent}%)`;
        body = this.generateLostItemMatchEmail(userName, lostItem, foundItem, scorePercent);
      } else if (foundItem.reporterId === email) {
        subject = `Suggested Match Found for Your Found Item (${scorePercent}%)`;
        body = this.generateFoundItemMatchEmail(userName, lostItem, foundItem, scorePercent);
      } else {
        subject = `Suggested Match Found (${scorePercent}%)`;
        body = this.generateGeneralMatchEmail(userName, lostItem, foundItem, scorePercent);
      }

      // Send email using EmailJS
      return await this.sendEmailAlert(email, subject, body, userName);
      
    } catch (error) {
      console.error('Error sending match notification email:', error);
      return {
        success: false,
        message: 'Failed to send email notification'
      };
    }
  }

  /**
   * Send item status update email
   * @param {string} email - Recipient email address
   * @param {string} itemTitle - Item title
   * @param {string} status - New status
   * @param {string} userName - User's name
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async sendItemStatusUpdateEmail(email, itemTitle, status, userName = 'User') {
    try {
      // Check if email alerts are enabled
      const emailAlertsEnabled = await isEmailAlertsEnabled();
      
      if (!emailAlertsEnabled) {
        console.log('Email alerts disabled, skipping status update email for:', email);
        return {
          success: true,
          message: 'Email alerts disabled - notification not sent'
        };
      }

      const subject = `Item Status Update - ${itemTitle}`;
      const body = this.generateStatusUpdateEmail(userName, itemTitle, status);

      return await this.sendEmailAlert(email, subject, body, userName);
      
    } catch (error) {
      console.error('Error sending status update email:', error);
      return {
        success: false,
        message: 'Failed to send email notification'
      };
    }
  }

  /**
   * Send generic email alert
   * @param {string} email - Recipient email
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @param {string} userName - User's name
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async sendEmailAlert(email, subject, body, userName) {
    try {
      // Use EmailJS to send the email
      const emailjs = require('@emailjs/react-native');
      
      // Initialize EmailJS
      emailjs.init({
        publicKey: EMAIL_CONFIG.PUBLIC_KEY,
        blockNonBrowser: false
      });

      const templateParams = {
        to_email: email,
        to_name: userName,
        subject: subject,
        message: body,
        from_name: EMAIL_CONFIG.FROM_NAME,
        app_name: EMAIL_CONFIG.APP_NAME,
        reply_to: email
      };

      const response = await emailjs.send(
        EMAIL_CONFIG.SERVICE_ID,
        EMAIL_CONFIG.TEMPLATE_ID,
        templateParams,
        {
          publicKey: EMAIL_CONFIG.PUBLIC_KEY
        }
      );

      console.log('Email alert sent successfully:', response);
      return {
        success: true,
        message: 'Email notification sent successfully'
      };
      
    } catch (error) {
      console.error('EmailJS error in alert service:', error);
      return {
        success: false,
        message: 'Failed to send email notification'
      };
    }
  }

  /**
   * Generate email content for lost item match
   */
  generateLostItemMatchEmail(userName, lostItem, foundItem, scorePercent) {
    return `
Hello ${userName},

Great news! We found a potential match for your lost item.

📱 Lost Item: ${lostItem.title || 'Your item'}
📍 Match Confidence: ${scorePercent}%

🔍 Found Item Details:
• Title: ${foundItem.title || 'N/A'}
• Description: ${foundItem.description || 'N/A'}
• Location Found: ${foundItem.location || 'N/A'}
• Date Found: ${foundItem.dateReported ? new Date(foundItem.dateReported).toLocaleDateString() : 'N/A'}

To view more details and contact the finder, please open the CSPC Lost & Found app and check your matches.

Best regards,
CSPC Lost & Found Team
Supreme Student Council

---
This is an automated notification. You can disable email alerts in the app settings.
    `;
  }

  /**
   * Generate email content for found item match
   */
  generateFoundItemMatchEmail(userName, lostItem, foundItem, scorePercent) {
    return `
Hello ${userName},

We found someone who may be looking for the item you found!

📱 Found Item: ${foundItem.title || 'Your found item'}
📍 Match Confidence: ${scorePercent}%

🔍 Lost Item Details:
• Title: ${lostItem.title || 'N/A'}
• Description: ${lostItem.description || 'N/A'}
• Location Lost: ${lostItem.location || 'N/A'}
• Date Lost: ${lostItem.dateReported ? new Date(lostItem.dateReported).toLocaleDateString() : 'N/A'}

To view more details and contact the owner, please open the CSPC Lost & Found app and check your matches.

Best regards,
CSPC Lost & Found Team
Supreme Student Council

---
This is an automated notification. You can disable email alerts in the app settings.
    `;
  }

  /**
   * Generate email content for general match
   */
  generateGeneralMatchEmail(userName, lostItem, foundItem, scorePercent) {
    return `
Hello ${userName},

We found a potential match in the CSPC Lost & Found system.

📍 Match Confidence: ${scorePercent}%

🔍 Item Details:
• Lost Item: ${lostItem.title || 'N/A'}
• Found Item: ${foundItem.title || 'N/A'}
• Match Score: ${scorePercent}%

To view more details, please open the CSPC Lost & Found app and check your matches.

Best regards,
CSPC Lost & Found Team
Supreme Student Council

---
This is an automated notification. You can disable email alerts in the app settings.
    `;
  }

  /**
   * Generate email content for status updates
   */
  generateStatusUpdateEmail(userName, itemTitle, status) {
    return `
Hello ${userName},

Your item status has been updated in the CSPC Lost & Found system.

📱 Item: ${itemTitle}
📍 New Status: ${status}

To view more details, please open the CSPC Lost & Found app.

Best regards,
CSPC Lost & Found Team
Supreme Student Council

---
This is an automated notification. You can disable email alerts in the app settings.
    `;
  }

  /**
   * Check if email alerts are enabled for a user
   * @returns {Promise<boolean>}
   */
  async areEmailAlertsEnabled() {
    return await isEmailAlertsEnabled();
  }
}

// Export singleton instance
const emailAlertService = new EmailAlertService();
export default emailAlertService;

// Export individual methods for convenience
export const {
  sendMatchNotificationEmail,
  sendItemStatusUpdateEmail,
  areEmailAlertsEnabled,
  initializeEmailAlerts,
  forceReinitializeEmailAlerts
} = emailAlertService;