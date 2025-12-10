# Clear Data Bug Fixes - Multiple Issues Resolved

## Issues

When users tried to clear their data from the app, the deletion failed with multiple errors:

### Issue 1: Wrong Column Name in Claims Table
```
Error: Unknown column 'claimant_email' in 'where clause'
Database query error: DELETE FROM claims WHERE claimant_email = 'user@example.com'
```

### Issue 2: Non-Existent Tables
```
Error: Table 'lost_and_found.user_violations' doesn't exist
Error: Table 'lost_and_found.user_settings' doesn't exist
```

---

## Root Causes

### Problem 1: Wrong Column Name
The delete user data endpoint in `server.js` was using the wrong column name when deleting claims:

**Incorrect:**
```sql
DELETE FROM claims WHERE claimant_email = ?
```

**Problem:** The `claims` table doesn't have a `claimant_email` column.

### Problem 2: Tables Don't Exist
The code tried to delete from tables that haven't been created yet:
- `user_violations` - Not in database
- `user_settings` - Not in database

---

## Solutions

### Fix 1: Updated Claims Query
Updated the query to use the correct column name `google_user_id`:

**Fixed:**
```sql
DELETE FROM claims WHERE google_user_id = ?
```

### Fix 2: Added Error Handling for Non-Existent Tables
Wrapped optional table deletions in try-catch blocks:

```javascript
// Delete user settings (if table exists)
try {
    await executeQueryWithRetry('DELETE FROM user_settings WHERE user_id = ?', [userId]);
    console.log('Deleted user settings');
} catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
        console.log('user_settings table does not exist, skipping...');
    } else {
        throw err;
    }
}

// Delete user violations (if table exists)
try {
    await executeQueryWithRetry('DELETE FROM user_violations WHERE user_id = ?', [userId]);
    console.log('Deleted user violations');
} catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
        console.log('user_violations table does not exist, skipping...');
    } else {
        throw err;
    }
}
```

---

## File Modified

### `src/shared/api/server.js`

**Line ~1349:**

```javascript
// Before (❌ WRONG)
await executeQueryWithRetry('DELETE FROM claims WHERE claimant_email = ?', [email]);

// After (✅ CORRECT)
await executeQueryWithRetry('DELETE FROM claims WHERE google_user_id = ?', [email]);
```

---

## Claims Table Structure

The `claims` table uses these columns for user identification:

- **`google_user_id`** - Stores the user's email (Google account)
- **`claimant_id`** - Stores an internal claimant identifier
- ~~`claimant_email`~~ - Does NOT exist in the table

---

## Testing

### Before Fixes
```
User clicks "Clear All Data"
→ API call to DELETE /api/users/:email/delete-all-data
→ Deletes feedback, support tickets, notifications ✅
→ Tries to delete claims with claimant_email ❌
→ Error: Unknown column 'claimant_email'
→ OR tries to delete from user_violations ❌
→ Error: Table doesn't exist
→ Process stops, data partially deleted
```

### After Fixes
```
User clicks "Clear All Data"
→ API call to DELETE /api/users/:email/delete-all-data
→ Deletes feedback responses ✅
→ Deletes feedback ✅
→ Deletes support ticket responses ✅
→ Deletes support tickets ✅
→ Deletes notifications ✅
→ Deletes claims using google_user_id ✅
→ Deletes matches ✅
→ Deletes items ✅
→ Tries user_settings (skips if not exists) ✅
→ Tries user_violations (skips if not exists) ✅
→ Deletes user account ✅
→ Success! All data cleared
```

---

## Impact

### Before Fix
- ❌ Data deletion failed at claims step
- ❌ User's data partially remained
- ❌ Poor user experience
- ❌ Privacy concerns

### After Fix
- ✅ Data deletion completes successfully
- ✅ All user data is removed
- ✅ Better user experience
- ✅ Privacy compliance

---

## Related Code

### Full Delete User Data Flow

```javascript
// DELETE /api/users/:email/delete-all-data
app.delete('/api/users/:email/delete-all-data', async (req, res) => {
    // 1. Delete feedback responses
    // 2. Delete feedback
    // 3. Delete support ticket responses
    // 4. Delete support tickets
    // 5. Delete notifications
    // 6. Delete claims (✅ FIXED - now uses google_user_id)
    // 7. Delete matches
    // 8. Delete items
    // 9. Delete user settings
    // 10. Delete user violations
    // 11. Delete user account
});
```

---

## How to Test

1. **Login to the app**
2. **Create some test data:**
   - Report a lost/found item
   - Create a claim
   - Send feedback
   - Create support ticket
3. **Go to Settings → Clear All Data**
4. **Confirm deletion**
5. **Verify:**
   - No error messages ✅
   - Success message appears ✅
   - Data is completely removed ✅

---

## Prevention

To avoid similar issues in the future:

### Best Practice: Always Verify Column Names

```javascript
// ❌ DON'T assume column names
DELETE FROM claims WHERE claimant_email = ?

// ✅ DO check the actual table structure
// Check: SELECT * FROM claims LIMIT 1;
// Verify columns exist before writing queries
DELETE FROM claims WHERE google_user_id = ?
```

### Document Table Structures

Keep a reference of table columns:

```sql
-- Claims table structure
CREATE TABLE claims (
    id VARCHAR(255) PRIMARY KEY,
    item_id VARCHAR(255),
    match_id VARCHAR(255),
    claimant_id VARCHAR(255),      -- Internal ID
    google_user_id VARCHAR(255),   -- User's email (Google)
    claim_type VARCHAR(50),
    status VARCHAR(50),
    proof_of_ownership TEXT,
    image TEXT,
    created_at DATETIME,
    updated_at DATETIME
);
```

---

## Summary

**Problems Fixed:**
1. ❌ Wrong column name: `claimant_email` → ✅ `google_user_id`
2. ❌ Non-existent tables causing crashes → ✅ Graceful error handling

**Changes Made:**
1. Updated claims deletion to use correct column
2. Added try-catch blocks for optional tables
3. Process continues even if optional tables don't exist

**Result:** User data deletion now works perfectly! ✅

---

## Quick Reference

```javascript
// Correct way to delete user's claims
await executeQueryWithRetry(
    'DELETE FROM claims WHERE google_user_id = ?', 
    [userEmail]
);
```

**Status:** ✅ FIXED - Users can now successfully clear all their data!
