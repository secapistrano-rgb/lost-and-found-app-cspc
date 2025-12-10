/**
 * Date and Time Utility Functions
 * Handles timezone conversions for Philippine Time (UTC+8)
 */

/**
 * Get current time in Philippine timezone
 * @returns {Date} - Current date/time in Philippine timezone
 */
export const getPhilippineTime = () => {
  const now = new Date();
  // Philippine Time is UTC+8
  const utcOffset = now.getTimezoneOffset() * 60000; // offset in milliseconds
  const philippineOffset = 8 * 60 * 60000; // UTC+8 in milliseconds
  return new Date(now.getTime() + utcOffset + philippineOffset);
};

/**
 * Get current time as ISO string in Philippine timezone
 * @returns {string} - ISO string for Philippine time
 */
export const getPhilippineTimeISO = () => {
  return getPhilippineTime().toISOString();
};

/**
 * Convert UTC date to Philippine time
 * @param {string|Date} date - UTC date
 * @returns {Date} - Date in Philippine timezone
 */
export const convertToPhilippineTime = (date) => {
  const d = new Date(date);
  const utcOffset = d.getTimezoneOffset() * 60000;
  const philippineOffset = 8 * 60 * 60000;
  return new Date(d.getTime() + utcOffset + philippineOffset);
};

/**
 * Format date for display (with Philippine time)
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export const formatPhilippineDate = (date) => {
  const phTime = typeof date === 'string' && !date.endsWith('Z') 
    ? new Date(date + 'Z') // Add Z if not present to treat as UTC
    : new Date(date);
  
  return phTime.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila' // Philippine timezone
  });
};

/**
 * Format date for database storage
 * MySQL DATETIME format: YYYY-MM-DD HH:MM:SS
 * @param {Date} date - Date object
 * @returns {string} - MySQL datetime string
 */
export const formatForMySQL = (date = new Date()) => {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Get current Philippine time formatted for MySQL
 * @returns {string} - MySQL datetime string in Philippine time
 */
export const getPhilippineTimeForMySQL = () => {
  return formatForMySQL(getPhilippineTime());
};

/**
 * Format time ago (e.g., "2 hours ago", "3 days ago")
 * @param {string|Date} date - Date to compare
 * @returns {string} - Relative time string
 */
export const formatTimeAgo = (date) => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return formatPhilippineDate(date);
};
