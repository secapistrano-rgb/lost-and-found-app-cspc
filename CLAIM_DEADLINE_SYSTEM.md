# Claim Deadline & Auto-Rejection System

## Overview
Implemented a 7-day deadline system for approved claims. Claims that are not collected within 7 days of approval are automatically rejected, and users are notified to resubmit if needed.

## Implementation Date
December 2, 2025

---

## Features Implemented

### 1. Database Schema Updates

**File:** `add_claim_deadline_fields.sql`

Added three new columns to the `claims` table:

```sql
- approved_at DATETIME NULL       -- Timestamp when claim was approved
- claim_deadline DATETIME NULL    -- 7 days after approval (auto-calculated)
- rejection_reason TEXT NULL      -- Reason for rejection (especially auto-rejection)
```

**Index Created:**
```sql
CREATE INDEX idx_claim_deadline ON claims(claim_deadline, status);
```
This improves query performance when checking for expired claims.

---

### 2. Automatic Deadline Setting

**File:** `src/shared/api/server.js`

When a claim is approved via API (`PATCH /api/claims/:id/status`):

```javascript
if (status === 'approved') {
    // Automatically sets:
    // - approved_at = current timestamp
    // - claim_deadline = current timestamp + 7 days
    updateClaimQuery = `
        UPDATE claims 
        SET status = ?, 
            approved_at = CURRENT_TIMESTAMP,
            claim_deadline = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY),
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `;
}
```

**Result:** Every approved claim automatically gets a 7-day countdown timer.

---

### 3. Periodic Expiration Checking

**Implementation:** Server-side background task

#### On Server Startup:
- Checks for expired claims immediately
- Sets up hourly interval checks (`setInterval`)

#### Checking Logic:
```javascript
// Finds approved claims past their deadline
SELECT c.id, c.google_user_id, c.item_id, c.claim_deadline, c.approved_at,
       i.title as item_title
FROM claims c
LEFT JOIN items i ON c.item_id = i.id
WHERE c.status = 'approved' 
AND c.claim_deadline IS NOT NULL
AND c.claim_deadline < NOW()
```

#### Auto-Rejection Process:
1. **Update Claim Status** → `rejected`
2. **Set Rejection Reason** → Detailed message with dates
3. **Create Notification** → Informs user about expiration
4. **Log Action** → Console output for monitoring

**Frequency:** Every 1 hour

---

### 4. Manual Expiration Check Endpoint

**Endpoint:** `GET /api/claims/check-expired`

Allows manual triggering of expiration check (useful for testing or cron jobs).

**Response:**
```json
{
  "message": "2 expired claim(s) processed",
  "processedCount": 2
}
```

---

### 5. Enhanced User Interface

**File:** `src/features/matching/screens/ClaimDetailsScreen.js`

#### Deadline Banner (Approved Claims Only)

Visual countdown display with color-coded urgency:

**🟢 Green (3-7 days):** "X days remaining"
```
✅ Plenty of time to collect
```

**🟡 Yellow (1-2 days):** "X days remaining" + Urgent warning
```
⚠️ Urgent: Please collect your item soon!
```

**🔴 Red (Expired):** "Deadline passed!"
```
⚠️ Your claim has expired. Submit a new request.
```

#### Deadline Calculation:
```javascript
const calculateDaysRemaining = (deadlineString) => {
    const deadline = new Date(deadlineString);
    const now = new Date();
    const diffTime = deadline - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};
```

#### Visual Elements:
- **📅 Deadline Date:** Full formatted timestamp
- **⏰ Days Remaining Badge:** Color-coded pill badge
- **⚠️ Warning Messages:** Context-appropriate alerts
- **📍 Collection Info:** SSC office location with map

---

### 6. Rejection Reason Display

**For Rejected Claims:**

Shows detailed rejection reason, especially for auto-rejected claims:

```
Your claim expired: Item was not collected within 7 days of 
approval (approved on 12/2/2025, deadline was 12/9/2025). 
Please submit a new claim request if you still need the item.
```

**Resubmit Prompt:**
```
🔄 You can submit a new claim request if the item is still available.
```

---

### 7. Updated Notifications

#### Approval Notification:
```
Congratulations! Your claim request for "Lost Wallet" has been 
approved. You have 7 days to collect your item from the SSC Office. 
Please check your email for further instructions.
```

#### Expiration Notification:
```
Title: Claim Expired - Action Required
Message: Your approved claim for "Lost Wallet" has expired because 
it was not collected within 7 days. You may submit a new claim 
request if the item is still available.
```

**Notification Type:** `claimExpired`

**Notification Data:**
```json
{
  "type": "claimExpired",
  "claimId": "claim_123",
  "itemId": "item_456",
  "itemTitle": "Lost Wallet",
  "expiredAt": "2025-12-09T15:30:00.000Z"
}
```

---

## User Flow

### Happy Path (Collected in Time)

1. **Claim Submitted** → User submits claim with proof
2. **Admin Approves** → Claim status = 'approved'
   - `approved_at` = now
   - `claim_deadline` = now + 7 days
3. **User Notified** → "You have 7 days to collect"
4. **User Views Details** → Sees deadline countdown
5. **User Collects Item** → Within 7 days
6. **Admin Marks Resolved** → Claim status = 'resolved'

### Expiration Path (Not Collected)

1. **Claim Submitted** → User submits claim
2. **Admin Approves** → 7-day timer starts
3. **User Notified** → "You have 7 days to collect"
4. **Days Pass** → User doesn't collect
5. **Deadline Passes** → claim_deadline < NOW()
6. **Hourly Check Runs** → Server detects expired claim
7. **Auto-Rejection** → Claim status = 'rejected'
   - Rejection reason set
8. **User Notified** → "Claim expired, resubmit if needed"
9. **User Can Resubmit** → New claim request possible

---

## Technical Details

### Database Migration

**Run Migration:**
```bash
node add_claim_deadline_fields_migration.js
```

**What It Does:**
- Adds `approved_at`, `claim_deadline`, `rejection_reason` columns
- Creates index on `claim_deadline` and `status`
- Safe to run multiple times (uses `IF NOT EXISTS`)

### Manual Expiration Check

**Standalone Script:**
```bash
node check_expired_claims.js
```

**Use Cases:**
- Testing the expiration logic
- Manual cleanup
- Cron job integration
- Debugging

### Cron Job Setup (Optional)

Instead of relying on server uptime, use a cron job:

```bash
# Check every hour
0 * * * * cd /path/to/app && node check_expired_claims.js
```

---

## Configuration

### Change Deadline Duration

Currently hardcoded to 7 days. To change:

**In server.js:**
```javascript
// Change this line:
claim_deadline = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY)

// To (for example, 14 days):
claim_deadline = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 14 DAY)
```

**In ClaimDetailsScreen.js:**
Update the reminder text to match new duration.

### Change Check Frequency

**In server.js:**
```javascript
// Change from 1 hour to 30 minutes:
setInterval(() => {
    checkExpiredClaimsNow();
}, 30 * 60 * 1000); // 30 minutes
```

---

## Color Coding

### Deadline Status Colors

| Days Remaining | Color | Hex | Meaning |
|---------------|-------|-----|---------|
| 3-7 days | 🟢 Green | #28a745 | Safe |
| 1-2 days | 🟡 Yellow | #ffc107 | Warning |
| Expired | 🔴 Red | #dc3545 | Urgent |

### Section Borders

- **Deadline Section:** Left border matches urgency color
- **Rejection Section:** Red left border (#dc3545)
- **Approved Sections:** Green left border (#28a745)

---

## Benefits

### For Claimants
✅ Clear deadline visibility
✅ Color-coded urgency indicators
✅ Countdown timer shows exact days remaining
✅ Can resubmit if claim expires
✅ No confusion about collection timeframe

### For SSC Staff
✅ Automatic cleanup of stale claims
✅ Less manual tracking needed
✅ Freed up storage for unclaimed items
✅ Clear audit trail with rejection reasons
✅ Reduced workload for claim management

### For System
✅ Prevents indefinite claim limbo
✅ Keeps database clean
✅ Encourages timely collection
✅ Fair to all users (everyone gets same deadline)
✅ Automated workflow = fewer errors

---

## Testing Checklist

### Database Migration
- [ ] Run migration script successfully
- [ ] Verify new columns exist in claims table
- [ ] Check index was created
- [ ] Test with existing claims (backward compatible)

### Approval Flow
- [ ] Approve a claim via admin panel
- [ ] Verify `approved_at` is set
- [ ] Verify `claim_deadline` is 7 days later
- [ ] Check notification includes "7 days" message

### Expiration Logic
- [ ] Manually set a claim's deadline to past date
- [ ] Run `check_expired_claims.js`
- [ ] Verify claim status changed to 'rejected'
- [ ] Verify rejection_reason is populated
- [ ] Verify notification was created

### UI Display
- [ ] View approved claim with 7 days remaining (green)
- [ ] View approved claim with 2 days remaining (yellow)
- [ ] View approved claim with 0 days remaining (red)
- [ ] View rejected claim with expiration reason
- [ ] Test "Get Directions" button

### Periodic Checking
- [ ] Start server and check console logs
- [ ] Verify "Starting periodic expired claims checker" message
- [ ] Wait 1 hour, verify check runs again
- [ ] Check expired claims are processed

---

## Files Modified/Created

### Created:
1. `add_claim_deadline_fields.sql` - Database migration
2. `add_claim_deadline_fields_migration.js` - Migration runner
3. `check_expired_claims.js` - Standalone expiration checker
4. `CLAIM_DEADLINE_SYSTEM.md` - This documentation

### Modified:
1. `src/shared/api/server.js` - Deadline setting, periodic checks, API endpoint
2. `src/features/matching/screens/ClaimDetailsScreen.js` - UI enhancements
3. `create_claim_notification_triggers.sql` - Updated approval message

---

## Error Handling

### Database Errors
- Logged to console with ❌ emoji
- Request continues (non-blocking)
- User still gets notification

### Notification Failures
- Logged but doesn't block claim update
- User can still view claim details
- Admin should check logs periodically

### Missing Data
- Gracefully handles null deadlines
- Shows "N/A" for missing dates
- Doesn't crash if claim data incomplete

---

## Future Enhancements

### Potential Improvements:
1. **Email Reminders** - Send at 3 days, 1 day, deadline
2. **SMS Notifications** - For urgent deadline warnings
3. **Configurable Deadlines** - Per claim or per item type
4. **Extension Requests** - Allow users to request more time
5. **Holiday Adjustments** - Exclude weekends/holidays from countdown
6. **Analytics Dashboard** - Track expiration rates
7. **Bulk Operations** - Admin can extend multiple deadlines
8. **Grace Period** - Allow 1-2 hour buffer after deadline

---

## Troubleshooting

### Claims Not Auto-Expiring

**Check:**
1. Is server running?
2. Check console for "CHECKING FOR EXPIRED CLAIMS"
3. Verify database columns exist
4. Check if claims have `claim_deadline` set
5. Verify system time is correct

**Debug Query:**
```sql
SELECT id, status, approved_at, claim_deadline, 
       NOW() as current_time,
       TIMESTAMPDIFF(HOUR, claim_deadline, NOW()) as hours_past_deadline
FROM claims 
WHERE status = 'approved' AND claim_deadline < NOW();
```

### Notifications Not Appearing

**Check:**
1. Is `user_email` field correct in notifications table?
2. Verify notification query executed successfully
3. Check notifications table for new entries
4. Ensure user is logged in with correct email

### Deadline Not Showing in UI

**Check:**
1. Is claim status 'approved'?
2. Does claim have `claim_deadline` field?
3. Check React Native console for errors
4. Verify `claim` object passed to screen

---

## Security Considerations

### Data Integrity
- Deadline cannot be modified by users
- Only server can set/update deadlines
- Admin approval triggers deadline automatically

### Race Conditions
- Database transactions ensure atomicity
- Status check + update happens together
- Notification creation separate (non-blocking)

### Authorization
- Only admins can approve claims
- Users can only view their own claim details
- Expiration check endpoint has no auth (read-only)

---

## Related Documentation

- `APPROVED_CLAIM_OFFICE_DIRECTION.md` - Office location feature
- `FINDER_CLAIM_NOTIFICATION_SYSTEM.md` - Notification system
- `create_claim_notification_triggers.sql` - Database triggers
- `NOTIFICATION_SYSTEM_IMPLEMENTATION.md` - Notification architecture

---

## Status

**Implementation Status:** ✅ Complete
**Testing Status:** ⏳ Pending
**Production Ready:** ⚠️ Requires migration + testing

**Next Steps:**
1. Run database migration
2. Test approval flow
3. Test expiration logic
4. Monitor for 24 hours
5. Deploy to production

---

**Last Updated:** December 2, 2025
**Version:** 1.0.0
**Priority:** High - Essential for claim management
