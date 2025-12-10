import { EMAIL_CONFIG } from '../../config/emailConfig';

/**
 * Email Service for 2FA Verification
 * Uses EmailJS for client-side email sending
 * Configure your EmailJS account at https://www.emailjs.com/
 */

class EmailService {
  constructor() {
    // EmailJS Configuration from config file
    this.emailJSConfig = {
      serviceId: EMAIL_CONFIG.SERVICE_ID,
      templateId: EMAIL_CONFIG.TEMPLATE_ID,
      publicKey: EMAIL_CONFIG.PUBLIC_KEY
    };
  }

  /**
   * Send verification code via email
   * @param {string} email - Recipient email address
   * @param {string} code - 6-digit verification code
   * @param {string} userName - User's name for personalization
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async sendVerificationCode(email, code, userName = 'User') {
    try {
      return await this.sendProductionEmail(email, code, userName);
    } catch (error) {
      console.error('Email service error:', error);
      return {
        success: false,
        message: 'Failed to send verification email. Please try again.'
      };
    }
  }



  /**
   * Generate email content for verification code
   * @param {string} email 
   * @param {string} code 
   * @param {string} userName 
   * @returns {object}
   */
  generateEmailContent(email, code, userName) {
    const subject = 'CSPC Lost & Found - Email Verification Code';
    
    const body = `
Hello ${userName},

You are receiving this email because you attempted to sign in to the CSPC Lost & Found application.

Your verification code is: ${code}

This code will expire in 10 minutes for security reasons.

If you did not request this verification code, please ignore this email or contact support if you have concerns.

For security reasons:
• Do not share this code with anyone
• This code is only valid for 10 minutes
• You have 3 attempts to enter the correct code

Best regards,
CSPC Lost & Found Team
Supreme Student Council
Camarines Sur Polytechnic Colleges

---
This is an automated message. Please do not reply to this email.
If you need assistance, please contact the SSC office.
    `;

    return { subject, body };
  }



  /**
   * Send production email using EmailJS
   * @param {string} email 
   * @param {string} code 
   * @param {string} userName 
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async sendProductionEmail(email, code, userName) {
    try {
      // Validate EmailJS configuration
      console.log('DEBUG - EmailJS Config Values:');
      console.log('Service ID:', this.emailJSConfig.serviceId, '(should not be YOUR_SERVICE_ID)');
      console.log('Template ID:', this.emailJSConfig.templateId, '(should not be YOUR_TEMPLATE_ID)');
      console.log('Public Key:', this.emailJSConfig.publicKey, '(should not be YOUR_PUBLIC_KEY)');
      
      if (!this.isEmailJSConfigured()) {
        console.log('Configuration check failed!');
        throw new Error('EmailJS is not properly configured. Please check your EMAIL_CONFIG settings.');
      }
      
      console.log('Configuration check passed!');

      // Check if EmailJS is available (requires installation: npm install @emailjs/react-native)
      const emailjs = require('@emailjs/react-native');
      
      // Initialize EmailJS with public key (using the correct method)
      emailjs.init({
        publicKey: this.emailJSConfig.publicKey,
        // Enable API calls for non-browser applications
        blockNonBrowser: false
      });
      
      // Calculate expiration time (15 minutes from now)
      const expirationTime = new Date(Date.now() + 10 * 60 * 1000);
      const timeString = expirationTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      // Prepare email template parameters using config
      // Note: EmailJS recipient is configured in the template, not in parameters
      const templateParams = {
        // Standard EmailJS fields for recipient configuration
        to_email: email,           // Recipient email address
        reply_to: email,           // Reply-to address
        from_email: 'noreply@cspc.edu.ph', // Sender email
        from_name: EMAIL_CONFIG.FROM_NAME, // Explicitly set the sender name
        
        // Template content variables
        to_name: userName,
        verification_code: code,
        app_name: EMAIL_CONFIG.APP_NAME,
        time: timeString,
        
        // Also include the config-based variables for backward compatibility
        [EMAIL_CONFIG.TEMPLATE_VARS.TO_NAME]: userName,
        [EMAIL_CONFIG.TEMPLATE_VARS.VERIFICATION_CODE]: code,
        [EMAIL_CONFIG.TEMPLATE_VARS.APP_NAME]: EMAIL_CONFIG.APP_NAME,
        [EMAIL_CONFIG.TEMPLATE_VARS.FROM_NAME]: EMAIL_CONFIG.FROM_NAME,
        [EMAIL_CONFIG.TEMPLATE_VARS.TP_TIME]: timeString,
        [EMAIL_CONFIG.TEMPLATE_VARS.TO_EMAIL]: email
      };
      
      console.log('DEBUG - Template Params:', templateParams);
      console.log('DEBUG - Recipient Email:', email);
      
      // Send email using EmailJS with proper configuration
      console.log('DEBUG - Sending email with EmailJS...');
      const response = await emailjs.send(
        this.emailJSConfig.serviceId,
        this.emailJSConfig.templateId,
        templateParams,
        {
          publicKey: this.emailJSConfig.publicKey,
          // Set the sender name explicitly in the options
          headers: {
            'From-Name': EMAIL_CONFIG.FROM_NAME
          }
        }
      );
      
      console.log('Email sent successfully:', response);
      
      return {
        success: true,
        message: 'Verification code sent to your email address.'
      };
      
    } catch (error) {
       console.error('EmailJS error:', error);
       
       // Specific error handling for common EmailJS errors
       if (error.text && error.text.includes('recipients address is empty')) {
         console.error('EMAILJS CONFIGURATION ERROR: The recipient address is empty. Please check:');
         console.error('1. You have enabled API calls for non-browser applications in EmailJS Account > Security');
         console.error('2. Your EmailJS template has a valid "To Email" field configured');
         console.error('3. The to_email parameter is being passed correctly');
         
         return {
           success: false,
           message: 'Email configuration error: Recipient address is missing. Please contact support.'
         };
       }
       
       return {
         success: false,
         message: 'Failed to send verification email. Please check your email configuration.'
       };
     }
  }



  /**
   * Validate email format
   * @param {string} email 
   * @returns {boolean}
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if email is from CSPC domain
   * @param {string} email 
   * @returns {boolean}
   */
  isCSPCEmail(email) {
    return email.toLowerCase().endsWith('@my.cspc.edu.ph');
  }

  /**
   * Check if EmailJS is properly configured
   * @returns {boolean}
   */
  isEmailJSConfigured() {
    return (
      this.emailJSConfig.serviceId && 
      this.emailJSConfig.serviceId !== 'YOUR_SERVICE_ID' &&
      this.emailJSConfig.templateId && 
      this.emailJSConfig.templateId !== 'YOUR_TEMPLATE_ID' &&
      this.emailJSConfig.publicKey && 
      this.emailJSConfig.publicKey !== 'YOUR_PUBLIC_KEY'
    );
  }
}

// Export singleton instance
const emailService = new EmailService();
export default emailService;

// Export individual methods for convenience
export const {
  sendVerificationCode,
  isValidEmail,
  isCSPCEmail
} = emailService;