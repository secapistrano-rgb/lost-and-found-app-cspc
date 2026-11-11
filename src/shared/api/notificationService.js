require('./env');
const mysql = require('mysql2');

// Database connection (reuse the same config as server.js)
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

/**
 * Get current time in Philippine timezone (UTC+8)
 * @returns {string} - MySQL datetime string in Philippine time
 */
function getPhilippineTime() {
  const now = new Date();
  // Add 8 hours for Philippine Time (UTC+8)
  const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  
  const year = phTime.getUTCFullYear();
  const month = String(phTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(phTime.getUTCDate()).padStart(2, '0');
  const hours = String(phTime.getUTCHours()).padStart(2, '0');
  const minutes = String(phTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(phTime.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Send match notification to users involved in the match
 * @param {Object} match - Match object containing lostItem and foundItem
 * @returns {Promise<boolean>} - Success status
 */
async function sendMatchNotification(match) {
  try {
    const { lostItem, foundItem, score } = match;
    const scorePercent = Math.round(score * 100);
    
    // Create notifications for both users involved
    const notifications = [];
    
    // Notification for lost item reporter
    if (lostItem.reporter_email) {
      notifications.push({
        id: `match_lost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'match',
        title: `Suggested Match Found for Your Lost Item (${scorePercent}%)`,
        message: `We may have found a potential match for your lost ${lostItem.title || 'item'}!`,
        data: JSON.stringify({ 
          type: 'match', 
          matchId: match.id,
          lostItemId: lostItem.id,
          foundItemId: foundItem.id,
          score: scorePercent
        }),
        read: false,
        createdAt: getPhilippineTime(),
        userEmail: lostItem.reporter_email
      });
    }
    
    // Notification for found item reporter
    if (foundItem.reporter_email && foundItem.reporter_email !== lostItem.reporter_email) {
      notifications.push({
        id: `match_found_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'match',
        title: `Suggested Match Found for Your Found Item (${scorePercent}%)`,
        message: `Your may have found item may belong to someone who reported it lost!`,
        data: JSON.stringify({ 
          type: 'match', 
          matchId: match.id,
          lostItemId: lostItem.id,
          foundItemId: foundItem.id,
          score: scorePercent
        }),
        read: false,
        createdAt: getPhilippineTime(),
        userEmail: foundItem.reporter_email
      });
    }
    
    // Save notifications to database
    for (const notification of notifications) {
      await saveNotificationToDatabase(notification);
    }
    
    console.log(`Match notifications sent for match ${match.id} (${scorePercent}% score)`);
    return true;
    
  } catch (error) {
    console.error('Error sending match notification:', error);
    return false;
  }
}

/**
 * Save notification to database
 * @param {Object} notification - Notification object
 * @returns {Promise<boolean>} - Success status
 */
async function saveNotificationToDatabase(notification) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO notifications (
        id, type, title, message, data, \`read\`, created_at, user_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      notification.id,
      notification.type,
      notification.title,
      notification.message,
      notification.data,
      notification.read ? 1 : 0,
      notification.createdAt,
      notification.userEmail
    ];
    
    db.query(query, values, (err, result) => {
      if (err) {
        console.error('Error saving notification to database:', err);
        return reject(err);
      }
      resolve(true);
    });
  });
}

/**
 * Send notifications for multiple matches
 * @param {Array} matches - Array of match objects
 * @returns {Promise<number>} - Number of notifications sent
 */
async function sendMatchNotifications(matches) {
  let notificationsSent = 0;
  
  for (const match of matches) {
    const success = await sendMatchNotification(match);
    if (success) {
      notificationsSent++;
    }
  }
  
  return notificationsSent;
}

/**
 * Check if notifications table exists and create it if not
 * @returns {Promise<boolean>} - Success status
 */
async function ensureNotificationsTable() {
  return new Promise((resolve, reject) => {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSON,
        \`read\` BOOLEAN DEFAULT FALSE,
        created_at DATETIME NOT NULL,
        user_email VARCHAR(255),
        INDEX idx_user_email (user_email),
        INDEX idx_created_at (created_at),
        INDEX idx_read (\`read\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    db.query(createTableQuery, (err, result) => {
      if (err) {
        console.error('Error creating notifications table:', err);
        return reject(err);
      }
      console.log('Notifications table ensured');
      resolve(true);
    });
  });
}

// Initialize notifications table on module load
ensureNotificationsTable().catch(console.error);

module.exports = {
  sendMatchNotification,
  sendMatchNotifications,
  saveNotificationToDatabase,
  ensureNotificationsTable
};