/**
 * MySQL User Settings Service
 * 
 * This service handles database operations for user settings using direct MySQL queries.
 * It provides functions to read and manage user settings from the MySQL database.
 */

const mysql = require('mysql2/promise');

// Database configuration
const DB_CONFIG = {
  host: 'localhost', // Update with your MySQL host
  user: process.env.DB_USER || 'root', // Update with your database user
  password: process.env.DB_PASSWORD || '', // Update with your database password
  database: 'lost_and_found',
  port: process.env.DB_PORT || 3306
};

// Create a connection pool for better performance
const pool = mysql.createPool({
  ...DB_CONFIG,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * Get user settings by user email
 * @param {string} email - User email
 * @returns {object|null} User settings object or null if not found
 */
const getUserSettingsByEmail = async (email) => {
  try {
    const [rows] = await pool.execute(
      `SELECT us.*, u.email 
       FROM user_settings us 
       JOIN users u ON us.user_id = u.id 
       WHERE u.email = ?`,
      [email]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    const settings = rows[0];
    return {
      notifications: Boolean(settings.notifications),
      emailAlerts: Boolean(settings.email_alerts),
      saveImageToGallery: Boolean(settings.save_image_to_gallery),
      updatedAt: settings.updated_at
    };
  } catch (error) {
    console.error('Error getting user settings by email:', error);
    throw error;
  }
};

/**
 * Get user settings by user ID
 * @param {number} userId - User ID
 * @returns {object|null} User settings object or null if not found
 */
const getUserSettingsById = async (userId) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM user_settings WHERE user_id = ?`,
      [userId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    const settings = rows[0];
    return {
      notifications: Boolean(settings.notifications),
      emailAlerts: Boolean(settings.email_alerts),
      saveImageToGallery: Boolean(settings.save_image_to_gallery),
      updatedAt: settings.updated_at
    };
  } catch (error) {
    console.error('Error getting user settings by ID:', error);
    throw error;
  }
};

/**
 * Create or update user settings
 * @param {string} email - User email
 * @param {object} settings - Settings object
 * @returns {boolean} Success status
 */
const saveUserSettings = async (email, settings) => {
  try {
    // First get the user ID from email
    const [userRows] = await pool.execute(
      `SELECT id FROM users WHERE email = ?`,
      [email]
    );
    
    if (userRows.length === 0) {
      throw new Error('User not found');
    }
    
    const userId = userRows[0].id;
    
    // Check if settings already exist
    const existingSettings = await getUserSettingsById(userId);
    
    if (existingSettings) {
      // Update existing settings
      await pool.execute(
        `UPDATE user_settings 
         SET notifications = ?, email_alerts = ?, save_image_to_gallery = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [
          settings.notifications ? 1 : 0,
          settings.emailAlerts ? 1 : 0,
          settings.saveImageToGallery ? 1 : 0,
          userId
        ]
      );
    } else {
      // Create new settings
      await pool.execute(
        `INSERT INTO user_settings (user_id, notifications, email_alerts, save_image_to_gallery) 
         VALUES (?, ?, ?, ?)`,
        [
          userId,
          settings.notifications ? 1 : 0,
          settings.emailAlerts ? 1 : 0,
          settings.saveImageToGallery ? 1 : 0
        ]
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw error;
  }
};

/**
 * Get default user settings
 * @returns {object} Default settings object
 */
const getDefaultUserSettings = () => {
  return {
    notifications: true,
    emailAlerts: true,
    saveImageToGallery: false
  };
};

/**
 * Initialize user settings for a new user
 * @param {string} email - User email
 * @returns {object} Default settings object
 */
const initializeUserSettings = async (email) => {
  try {
    const defaultSettings = getDefaultUserSettings();
    await saveUserSettings(email, defaultSettings);
    return defaultSettings;
  } catch (error) {
    console.error('Error initializing user settings:', error);
    throw error;
  }
};

/**
 * Close the database connection pool
 */
const closePool = async () => {
  try {
    await pool.end();
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

module.exports = {
  getUserSettingsByEmail,
  getUserSettingsById,
  saveUserSettings,
  getDefaultUserSettings,
  initializeUserSettings,
  closePool
};