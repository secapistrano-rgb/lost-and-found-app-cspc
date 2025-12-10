# Found Item 12-Hour Turn-In Requirement

## Overview
Implemented a mandatory 12-hour turn-in requirement for all found items reported in the system. This feature prevents fake reports and ensures all found items are properly tracked through the SSC Office.

## Implementation Date
November 25, 2025

## Business Rules

### 1. Reporting Phase
- When a user reports a **found item**, the system:
  - Sets status to `pending_turnin` instead of `active`
  - Records `turnin_deadline` as 12 hours from report time
  - Sets `turnin_status` to `pending`
  - **Item does NOT appear on home screen**

### 2. Turn-In Window
- User has **12 hours** to physically turn in the item to SSC Office
- SSC Admin confirms receipt and marks item as turned in
- Upon confirmation:
  - Status changes from `pending_turnin` to `active`
  - `turnin_status` changes to `confirmed`
  - Item NOW appears on home screen
  - Item becomes available for matching

### 3. Deadline Expiration
- If 12 hours pass without turn-in:
  - Status automatically changes to `fake_report`
  - `turnin_status` changes to `expired`
  - Violation record created for user
  - Item permanently removed from active listings
  - User receives warning/suspension based on violation count

## Database Schema Changes

### Items Table - New Fields
```sql
ALTER TABLE items ADD COLUMN turnin_deadline DATETIME NULL;
ALTER TABLE items ADD COLUMN turnin_status ENUM('pending', 'confirmed', 'expired') NULL;
ALTER TABLE items ADD COLUMN turnin_confirmed_at DATETIME NULL;
ALTER TABLE items ADD COLUMN turnin_confirmed_by VARCHAR(255) NULL;
```

### Status Values
- `pending_turnin` - Found item waiting to be turned in to SSC Office
- `fake_report` - Item marked as fake after deadline expiration
- `active` - Item confirmed turned in and visible on home screen

## API Endpoints

### 1. Mark Item as Turned In
```
PATCH /api/items/:id/turnin
Body: {
  "turnedIn": true,
  "adminEmail": "admin@cspc.edu.ph"
}
```

**Response:**
```json
{
  "message": "Item marked as turned in successfully",
  "status": "active"
}
```

### 2. Check Expired Turn-In Deadlines (Automated)
```
GET /api/items/check-turnin-deadlines
```

**Response:**
```json
{
  "message": "Processed 3 expired turn-in deadlines",
  "expiredCount": 3
}
```

### 3. Updated Status Validation
```
PATCH /api/items/:id/status
```
Now accepts: `active`, `inactive`, `claimed`, `returned`, `resolved`, `pending_turnin`, `fake_report`

## Frontend Implementation

### ReportItemScreen.js

#### New State Variables
- `turnInDeadline` - Stores the 12-hour deadline timestamp

#### Item Creation Logic
```javascript
const now = new Date();
const turnInDeadlineDate = new Date(now.getTime() + (12 * 60 * 60 * 1000));
const itemStatus = type === 'found' ? 'pending_turnin' : 'active';

const item = {
  // ... other fields
  status: itemStatus,
  turnin_deadline: type === 'found' ? turnInDeadlineDate.toISOString() : null,
  turnin_status: type === 'found' ? 'pending' : null,
};
```

#### UI Components
**Turn-In Reminder Card** (Orange border, high visibility)
- Displays 12-hour requirement
- Warns item won't appear on home screen until turned in
- Explains consequences of not turning in
- Shows SSC Office location

**Success Message Enhancement**
```
⚠️ IMPORTANT: You must turn in this item to the SSC Office 
within 12 hours (by 3:45 PM today) for it to appear on the 
home screen. Items not turned in will be tagged as fake 
reports and removed.
```

### HomeScreen.js

#### Filtering Logic
```javascript
const activeItems = allItems.filter(item => 
  !['resolved', 'claimed', 'returned', 'pending_turnin'].includes(item.status)
);
```

**Result:** Only items with `active` status appear on home screen

## User Experience Flow

### For Users Who Find Items

1. **Report Found Item**
   - Fill out report form
   - See prominent turn-in reminder card
   - Submit report
   - Receive success message with deadline

2. **Turn In to SSC Office**
   - Bring item to SSC Office within 12 hours
   - Admin confirms receipt
   - Item becomes visible on home screen

3. **If Deadline Missed**
   - Item automatically flagged as fake
   - Violation added to account
   - Warning notification sent
   - Account at risk of suspension

### For SSC Administrators

1. **Item Turn-In Process**
   - User brings found item to office
   - Verify item matches report
   - Use admin panel to mark as turned in
   - Item becomes active and visible

2. **Monitoring**
   - Check pending turn-in items regularly
   - Follow up with users approaching deadline
   - System auto-processes expired items

## Violation System Integration

### Violation Type: `failed_turnin`
**Reason:** "Failed to turn in found item '[title]' to SSC Office within 12 hours"

### Escalation Path
1. **First Violation:** Warning notification
2. **Second Violation:** Stronger warning + report restrictions
3. **Third Violation:** Account suspension

## Automation & Cron Jobs

### Recommended Cron Schedule
```bash
# Check for expired turn-in deadlines every hour
0 * * * * curl https://api.lostfound.systems/api/items/check-turnin-deadlines
```

### Alternative: Frontend Polling
```javascript
// Check every 15 minutes when app is active
setInterval(async () => {
  await fetch(`${API_CONFIG.BASE_URL}/api/items/check-turnin-deadlines`);
}, 15 * 60 * 1000);
```

## Testing Scenarios

### Test 1: Normal Turn-In Flow
1. Report found item ✅
2. Verify status is `pending_turnin` ✅
3. Verify not visible on home screen ✅
4. Admin marks as turned in ✅
5. Verify status changes to `active` ✅
6. Verify visible on home screen ✅

### Test 2: Deadline Expiration
1. Report found item ✅
2. Wait 12+ hours (or manually adjust deadline) ✅
3. Trigger deadline check ✅
4. Verify status changes to `fake_report` ✅
5. Verify violation created ✅
6. Verify user notified ✅

### Test 3: Lost Items Unaffected
1. Report lost item ✅
2. Verify status is `active` immediately ✅
3. Verify visible on home screen ✅
4. No turn-in requirements ✅

## Security Considerations

1. **Authorization:** Only SSC admins can mark items as turned in
2. **Validation:** API validates `type = 'found'` before applying turn-in logic
3. **Audit Trail:** Records `turnin_confirmed_by` and `turnin_confirmed_at`
4. **Immutable:** Once marked `fake_report`, status cannot be changed back

## Benefits

1. **Prevents Fake Reports:** Users must physically show item to SSC
2. **Centralized Tracking:** All found items go through SSC Office
3. **Quality Control:** Verifies item actually exists
4. **Accountability:** Clear violation system for non-compliance
5. **Trust Building:** Users know all found items are legitimate

## Future Enhancements

1. **SMS Reminders:** Text users approaching deadline
2. **Flexible Deadlines:** Adjust based on item value/category
3. **Photo Verification:** Require SSC admin to take photo at turn-in
4. **QR Code System:** Generate unique code for tracking
5. **Extended Hours:** Allow weekend turn-ins at alternate location

## Admin Panel Integration

### Required Admin Features
1. View pending turn-in items
2. Mark item as turned in (one-click)
3. View turn-in history
4. Override expired items (with reason)
5. Generate turn-in reports

### Sample Admin Query
```sql
SELECT id, title, reporter_name, reporter_email, 
       date_reported, turnin_deadline,
       TIMESTAMPDIFF(HOUR, NOW(), turnin_deadline) as hours_remaining
FROM items 
WHERE status = 'pending_turnin' 
AND type = 'found'
ORDER BY turnin_deadline ASC;
```

## Files Modified

### Frontend
- ✅ `src/features/items/screens/ReportItemScreen.js`
  - Added turn-in deadline calculation
  - Added turn-in reminder card UI
  - Updated success message
  - Added new styles

- ✅ `src/features/home/screens/HomeScreen.js`
  - Updated filtering to exclude `pending_turnin` items

### Backend
- ✅ `src/shared/api/server.js`
  - Added `/api/items/:id/turnin` endpoint
  - Added `/api/items/check-turnin-deadlines` endpoint
  - Updated status validation

### Documentation
- ✅ `FOUND_ITEM_TURNIN_REQUIREMENT.md` (this file)

## Rollout Plan

### Phase 1: Database Migration
1. Add new columns to items table
2. Backfill existing found items (set as `active`, no deadline)
3. Test queries

### Phase 2: API Deployment
1. Deploy updated server.js
2. Test endpoints in staging
3. Set up cron job

### Phase 3: Frontend Release
1. Deploy updated React Native app
2. Monitor for errors
3. Collect user feedback

### Phase 4: User Communication
1. In-app announcement
2. Email to all users
3. Update FAQ
4. Train SSC staff

## Support & Troubleshooting

### Common Issues

**Q: User turned in item but still pending?**
A: Admin needs to mark as turned in via admin panel

**Q: Deadline passed but item still showing as pending?**
A: Manually trigger `/api/items/check-turnin-deadlines` or wait for next cron run

**Q: User claims they turned it in on time?**
A: Check `turnin_confirmed_at` timestamp, admin can override if valid

**Q: Lost item showing turn-in requirement?**
A: Bug - check item `type` field, should only apply to `found` items

## Contact
For questions or issues with this feature:
- Email: dev@lostfound.systems
- SSC Office: ssc@cspc.edu.ph
