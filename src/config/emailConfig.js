/**
 * Email Configuration for 2FA Verification
 * 
 * To enable real email sending, you need to:
 * 1. Create an account at https://www.emailjs.com/
 * 2. Set up an email service (Gmail, Outlook, etc.)
 * 3. Create an email template
 * 4. Replace the placeholder values below with your actual credentials
 */

export const EMAIL_CONFIG = {
  // EmailJS Service Configuration
  SERVICE_ID: 'service_pk84f35', // Replace with your EmailJS service ID
  TEMPLATE_ID: 'template_b63wp7r', // Replace with your EmailJS template ID
  PUBLIC_KEY: 'hIU5t1T-jtwFafA_p', // Replace with your EmailJS public key
  
  // Email Template Variables (these should match your EmailJS template)
  TEMPLATE_VARS: {
    TO_EMAIL: 'to_email',
    TO_NAME: 'to_name', 
    VERIFICATION_CODE: 'verification_code',
    APP_NAME: 'app_name',
    FROM_NAME: 'from_name',
    TP_TIME: 'time',
  },
  
  // App-specific settings
  APP_NAME: 'CSPC Lost & Found',
  FROM_NAME: 'CSPC Lost & Found System', // This will be displayed as the sender name in emails
  
  // Production settings
  ENABLE_REAL_EMAILS: true // Always use real emails in production
};

/**
 * EmailJS Template Example:
 * 
 * Subject: Your CSPC Lost & Found Verification Code
 * 
 * Body:
 * Hello {{to_name}},
 * 
 * Your verification code for {{app_name}} is: {{verification_code}}
 * 
 * This code will expire in 10 minutes. Please do not share this code with anyone.
 * 
 * If you didn't request this code, please ignore this email.
 * 
 * Best regards,
 * {{from_name}} <!-- This will display 'CSPC Lost & Found System' as the sender -->
 *
 * IMPORTANT: In your EmailJS template settings, make sure to set the 'From Name' field to {{from_name}}
 * to ensure the sender appears as 'CSPC Lost & Found System' instead of the default EmailJS account name.
 */

/**
 * Setup Instructions:
 * 
 * 1. Go to https://www.emailjs.com/ and create an account
 * 2. Add an email service (Gmail recommended):
 *    - Go to Email Services
 *    - Click "Add New Service"
 *    - Choose Gmail and follow the setup
 *    - Note down the Service ID
 * 
 * 3. Create an email template:
 *    - Go to Email Templates
 *    - Click "Create New Template"
 *    - Use the template example above
 *    - Note down the Template ID
 * 
 * 4. Get your Public Key:
 *    - Go to Account > API Keys
 *    - Copy your Public Key
 * 
 * 5. Update this config file with your credentials
 * 
 * 6. Enable API calls for non-browser applications:
 *    - Go to Account > Security
 *    - Check the box for "Allow EmailJS API for non-browser applications"
 *    - This is REQUIRED for React Native applications
 * 
 * 7. Configure the 'From Name' field in your EmailJS template:
 *    - Go to Email Templates > Your Template > Email Fields
 *    - Set the 'From Name' field to {{from_name}} to use the value from this config
 *    - This ensures the sender name appears as 'CSPC Lost & Found System' in emails
 * 
 * 8. Test the integration using the 2FA verification screen
 */