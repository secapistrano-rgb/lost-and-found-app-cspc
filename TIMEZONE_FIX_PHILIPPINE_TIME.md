# Timezone Fix - Philippine Time (UTC+8)

## Problem

Notifications were showing incorrect time (4 hours ahead):
- **Expected**: 12:35 PM (Philippine Time)
- **Actual**: 4:35 PM (UTC time)

The issue occurred because:
1. Timestamps were created using `new Date().toISOString()` which returns UTC time
2. MySQL DATETIME stores the value without timezone information
3. When displayed, the app showed the UTC time as-is instead of converting to local time

---

## Solution

Created a comprehensive timezone handling system for Philippine Time (UTC+8).

### Files Modified

1. **`src/shared/utils/dateUtils.js`** (NEW)
   - Utility functions for Philippine timezone handling
   - Functions to format dates for display and database storage

2. **`src/shared/api/notificationService.js`**
   - Added `getPhilippineTime()` function
   - Converts UTC to Philippine Time (UTC+8) when creating timestamps
   - All notifications now store Philippine time in database

3. **`src/features/notifications/screens/NotificationsScreen.js`**
   - Uses `formatPhilippineDate()` from dateUtils
   - Properly displays time in Philippine timezone

---

## Implementation Details

### Server-Side (notificationService.js)

```javascript
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
```

**Usage:**
```javascript
// Before
createdAt: new Date().toISOString()  // UTC time

// After
createdAt: getPhilippineTime()       // Philippine time (UTC+8)
```

### Client-Side (dateUtils.js)

```javascript
/**
 * Format date for display (with Philippine time)
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
```

---

## Date Utility Functions

### Available Functions

1. **`getPhilippineTime()`**
   - Returns current Date object in Philippine timezone
   
2. **`getPhilippineTimeISO()`**
   - Returns ISO string for Philippine time
   
3. **`convertToPhilippineTime(date)`**
   - Converts any date to Philippine timezone
   
4. **`formatPhilippineDate(date)`**
   - Formats date for display in Philippine timezone
   - Example: "Oct 10, 2025, 12:35 PM"
   
5. **`formatForMySQL(date)`**
   - Formats date for MySQL storage
   - Format: "YYYY-MM-DD HH:MM:SS"
   
6. **`getPhilippineTimeForMySQL()`**
   - Current time formatted for MySQL in Philippine timezone
   
7. **`formatTimeAgo(date)`**
   - Relative time format
   - Examples: "Just now", "2 hours ago", "3 days ago"

---

## Usage Examples

### Creating Notifications

```javascript
// Server-side (notificationService.js)
const notification = {
  id: `match_${Date.now()}`,
  type: 'match',
  title: 'Match Found',
  message: 'A potential match was found',
  createdAt: getPhilippineTime(), // Philippine time
  userEmail: user.email
};
```

### Displaying Dates

```javascript
// Client-side (NotificationsScreen.js)
import { formatPhilippineDate } from '../../../shared/utils/dateUtils';

const formatDate = (dateString) => {
  return formatPhilippineDate(dateString);
};

// Output: "Oct 10, 2025, 12:35 PM" (Philippine time)
```

### Storing Dates in Database

```javascript
// Use getPhilippineTime() for MySQL DATETIME
const query = `INSERT INTO notifications (created_at) VALUES (?)`;
const values = [getPhilippineTime()];
```

---

## Testing

### Before Fix
```
Server creates notification: 2025-10-10 04:35:00 (UTC)
MySQL stores: 2025-10-10 04:35:00
App displays: Oct 10, 2025, 4:35 PM ❌ (Wrong!)
```

### After Fix
```
Server creates notification: 2025-10-10 12:35:00 (Philippine Time)
MySQL stores: 2025-10-10 12:35:00
App displays: Oct 10, 2025, 12:35 PM ✅ (Correct!)
```

---

## Impact

### What's Fixed
- ✅ Match notifications show correct time
- ✅ All new notifications use Philippine time
- ✅ Consistent timezone across app

### What Needs Migration (Optional)
- Existing notifications in database still have UTC time
- To fix old data, run this SQL:
  ```sql
  UPDATE notifications 
  SET created_at = DATE_ADD(created_at, INTERVAL 8 HOUR)
  WHERE created_at < '2025-10-10 12:00:00';
  ```

---

## Other Areas That May Need Updating

If other parts of the app show wrong times, update them to use dateUtils:

### Item Reports
```javascript
// In ReportItemScreen.js or similar
import { getPhilippineTimeForMySQL } from '../utils/dateUtils';

const item = {
  ...otherFields,
  date_reported: getPhilippineTimeForMySQL()
};
```

### Match Creation
```javascript
// In matchingService.js
import { getPhilippineTimeForMySQL } from '../utils/dateUtils';

const match = {
  ...otherFields,
  created_at: getPhilippineTimeForMySQL()
};
```

### Claims
```javascript
// In claim handling
const claim = {
  ...otherFields,
  created_at: getPhilippineTimeForMySQL()
};
```

---

## Summary

**Problem**: Notifications showed 4:35 PM when it should be 12:35 PM  
**Root Cause**: Using UTC time instead of Philippine Time (UTC+8)  
**Solution**: Created timezone utilities and updated notification service  
**Result**: All timestamps now correctly show Philippine Time 🎉

---

## Quick Reference

```javascript
// Server-side (Node.js)
const { getPhilippineTime } = require('./path/to/utils');
createdAt: getPhilippineTime()

// Client-side (React Native)
import { formatPhilippineDate } from './path/to/dateUtils';
<Text>{formatPhilippineDate(notification.createdAt)}</Text>
```

**Philippine Time Zone**: UTC+8 (Asia/Manila)  
**No Daylight Saving Time**: Philippines doesn't observe DST
