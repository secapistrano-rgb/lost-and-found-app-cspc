# Monthly Activity Debugging Guide

## Issue
Monthly Activity chart is showing "No activity data available" even though items exist.

## Enhanced Logging Added

I've added comprehensive console logging to help diagnose the issue. When you open the User Statistics screen, you should see these logs:

### 1. **Data Loading Logs**
```
📊 USER STATS - Total user items: X
📊 USER STATS - Lost items: X, Found items: X
📊 USER STATS - Sample item structure: {...}
```

### 2. **Monthly Activity Calculation Logs**
```
📊 Calculating monthly activity for X items
✅ Monthly activity calculated: X items with dates, counts: [...]
```

### 3. **Rendering Logs**
```
🎨 RENDER - monthlyActivity object: {...}
🎨 RENDER - months: [...]
🎨 RENDER - counts: [...]
🎨 RENDER - Has data? true/false
```

## How to Debug

### Step 1: Open the App
1. Launch your Lost & Found app
2. Navigate to **Profile** → **Statistics**
3. **Open the console/debugging panel** (React Native Debugger or Metro console)

### Step 2: Check the Logs

#### Scenario A: No Items Found
If you see:
```
📊 USER STATS - Total user items: 0
📊 USER STATS - Lost items: 0, Found items: 0
```

**Problem:** No items are associated with your user account  
**Solution:** 
- Make sure you're logged in with the correct account
- Create some lost/found items first
- Check that items have your email as reporter

#### Scenario B: Items Found, But No Dates
If you see:
```
📊 USER STATS - Total user items: 5
📊 Calculating monthly activity for 5 items
✅ Monthly activity calculated: 0 items with dates
```

**Problem:** Items don't have date fields  
**Solution:** Check the sample item structure:
```javascript
📊 USER STATS - Sample item structure: {
  id: 'item_123',
  title: 'Lost Wallet',
  created_at: null,           // ❌ Missing
  date_reported: null,        // ❌ Missing
  date_lost_found: null,      // ❌ Missing
  availableKeys: [...all keys in item...]
}
```

If all date fields are `null`, the database records don't have dates. This could be because:
1. Items were created before date fields were added
2. Date fields are using different names
3. MySQL timezone issues caused dates to be stored incorrectly

#### Scenario C: Items Have Dates, But Still No Display
If you see:
```
📊 Calculating monthly activity for 5 items
✅ Monthly activity calculated: 5 items with dates, counts: [0,0,0,0,0,0,0,0,0,5,0,0]
🎨 RENDER - counts: [0,0,0,0,0,0,0,0,0,5,0,0]
🎨 RENDER - Has data? true
✅ RENDER - Displaying monthly activity chart
```

**Problem:** Data exists but chart may not be rendering  
**Solution:** Check for rendering errors in the UI

## Quick Fixes

### Fix 1: If No Items Have Dates

You need to update existing items in the database. Run this SQL:

```sql
-- Update items to have date_lost_found from created_at if available
UPDATE items 
SET date_lost_found = COALESCE(date_lost_found, created_at, date_reported, NOW())
WHERE date_lost_found IS NULL;

-- Or set all NULL dates to current date
UPDATE items 
SET date_lost_found = NOW()
WHERE date_lost_found IS NULL;
```

### Fix 2: If Items Exist But Not Showing

The filter might be too strict. Check your user email in the database:

```sql
-- Check what items exist for your email
SELECT id, title, reporter_email, reporter_id, date_lost_found
FROM items
WHERE reporter_email = 'your_email@my.cspc.edu.ph' 
   OR reporter_id = 'your_email@my.cspc.edu.ph';
```

### Fix 3: Force Refresh

Sometimes cached data causes issues:
1. Pull down to refresh the statistics screen
2. Restart the app
3. Clear app cache if available

## Expected Output (Working Scenario)

When everything is working correctly, you should see:

```
📊 USER STATS - Total user items: 10
📊 USER STATS - Lost items: 6, Found items: 4
📊 USER STATS - Sample item structure: {
  id: 'lost-123',
  title: 'Lost Wallet',
  created_at: '2025-10-12 08:30:00',
  date_reported: '2025-10-12 08:30:00',
  date_lost_found: '2025-10-11 14:00:00',  ✅
  availableKeys: [...]
}

📊 Calculating monthly activity for 10 items
✅ Monthly activity calculated: 10 items with dates, counts: [0,0,0,0,0,0,0,0,0,10,0,0]

🎨 RENDER - monthlyActivity object: { labels: [...], data: [...] }
🎨 RENDER - months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
🎨 RENDER - counts: [0,0,0,0,0,0,0,0,0,10,0,0]
🎨 RENDER - Has data? true
✅ RENDER - Displaying monthly activity chart
```

And the chart should display with bars for October (10 items).

## Common Issues & Solutions

| Issue | Log Pattern | Solution |
|-------|-------------|----------|
| No items | `Total user items: 0` | Create items or check user filter |
| No dates | `0 items with dates` | Update database with SQL above |
| Wrong month | Counts in wrong month | Check timezone settings (should be UTC+8) |
| Chart not visible | Data exists but no UI | Check for rendering errors |

## Still Not Working?

Send me these console logs:
1. All logs starting with `📊 USER STATS`
2. All logs starting with `📊 Calculating`
3. All logs starting with `🎨 RENDER`
4. The sample item structure

This will help identify the exact issue!

---

**Testing Steps:**
1. ✅ Open app
2. ✅ Navigate to Statistics
3. ✅ Check console logs
4. ✅ Look for the patterns above
5. ✅ Apply appropriate fix

**Status:** Ready for debugging - Enhanced logging active
