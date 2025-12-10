# MySQL Timezone Configuration Fix

## Problem
Feedback and other timestamps are showing UTC time (e.g., 4:45 PM) instead of Philippine Time (e.g., 12:45 AM next day, UTC+8).

## Root Cause
MySQL server timezone is set to UTC by default. When using `CURRENT_TIMESTAMP` or `NOW()`, MySQL stores UTC time.

## Solutions

### Option 1: Set MySQL Session Timezone (Recommended - Already Implemented)
This is done at the connection level in the application code.

**In `server.js`:**
```javascript
// After database connection
db.query("SET time_zone = '+08:00'", (err) => {
  if (err) {
    console.error('Error setting timezone:', err);
  } else {
    console.log('✓ MySQL timezone set to Philippine Time (UTC+8)');
  }
});
```

### Option 2: Set MySQL Global Timezone (Server-level)
This requires server administrator access.

**On your VPS (Hostinger):**
```bash
# Edit MySQL configuration
sudo nano /etc/mysql/my.cnf

# Add under [mysqld] section:
[mysqld]
default-time-zone = '+08:00'

# Restart MySQL
sudo systemctl restart mysql
```

### Option 3: Convert on Insert (Already Implemented)
Use the `getPhilippineTime()` function to convert dates before INSERT.

## Implementation Status

### ✅ Completed
1. **Date conversion for items table:**
   - `POST /api/items` - converts `date_lost_found` to MySQL format
   - `PUT /api/items/:id` - converts `date_lost_found` and `date_occurred` to MySQL format

2. **Date conversion for matches table:**
   - `createMatchRecords()` in `matchingService.js` - converts all date fields

3. **Date conversion for feedback responses:**
   - `getPhilippineTime()` function already exists in `server.js`
   - Used in notification data but NOT in database INSERT

### ⚠️ Still Needed
1. **Feedback table** - Uses MySQL default `CURRENT_TIMESTAMP` (UTC)
2. **Feedback responses table** - Uses MySQL default `CURRENT_TIMESTAMP` (UTC)
3. **Other tables** - May need review

## Quick Fix for Production

Add this immediately after your database connection in `server.js`:

```javascript
// Set MySQL session timezone to Philippine Time
db.query("SET time_zone = '+08:00'", (err) => {
  if (err) {
    console.error('❌ Error setting MySQL timezone:', err);
  } else {
    console.log('✅ MySQL timezone set to Philippine Time (UTC+8)');
  }
});
```

This will make ALL future timestamps use Philippine Time automatically!

## Testing
1. Create a new feedback
2. Check the `created_at` timestamp
3. It should now show Philippine Time (UTC+8)

## Status
🔧 **REQUIRES DEPLOYMENT** - Need to add timezone setting to production server.js
