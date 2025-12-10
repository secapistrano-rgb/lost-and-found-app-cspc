# Finder Claim Notification System

## Overview
When a found item is claimed by its owner, the honest finder who reported it receives a thank you notification. This recognizes and appreciates their good deed in helping reunite someone with their lost item.

## Implementation Date
November 25, 2025

## How It Works

### Trigger Conditions
The notification is sent when:
1. An item's status changes from any status to `claimed` or `returned`
2. The item type is `found` (not lost items)
3. The status actually changed (not a duplicate update)

### Notification Details

**To:** The finder (person who reported the found item)
**Type:** `finderClaim`
**Icon:** 🏆 Trophy icon (gold color)
**Title:** "🎉 Your Found Item Was Claimed!"

**Message Format:**
```
Great news! The item you found and reported "[Item Title]" has been successfully 
claimed and returned to its owner (Claimant Name). Thank you for being an honest 
finder! Your good deed helped reunite someone with their lost item. 🙏
```

### Data Included
The notification includes:
- Item ID and title
- Item type (found)
- Claim status (claimed/returned)
- Claimant email and name (if available)
- Date item was reported
- Date item was claimed

## Database Components

### Trigger: `notify_finder_on_claim`
- **Table:** `items`
- **Event:** AFTER UPDATE
- **Timing:** After the item status is updated

### Logic Flow
1. Check if status changed to 'claimed' or 'returned'
2. Verify item type is 'found'
3. Get finder's email from `reporter_email`
4. Lookup claimant info from:
   - `claims` table (first priority)
   - `matches` table (fallback)
5. Generate unique notification ID
6. Create personalized message
7. Insert into `notifications` table

## Installation

### Option 1: Run the setup script
```bash
node create_finder_claim_notification_trigger.js
```

### Option 2: Run SQL directly
```bash
mysql -u root -p lost_and_found < create_finder_claim_notification_trigger.sql
```

### Option 3: Manual execution
```sql
-- Copy contents from create_finder_claim_notification_trigger.sql
-- and execute in your MySQL client
```

## Frontend Integration

### NotificationsScreen.js Changes
✅ Added navigation handler for `finderClaim` type
✅ Added trophy icon (🏆) for finder notifications
✅ Navigates to item details when tapped

### Navigation Flow
When user taps the notification:
1. Opens ItemDetails screen
2. Shows the found item that was claimed
3. Includes item type parameter: `itemType: 'found'`

## Testing

### Manual Test
1. Report a found item as User A
2. Report the same item as lost by User B
3. Create a match between them
4. Update the found item status to 'claimed'
5. Check User A's notifications

### SQL Test Query
```sql
-- Simulate a claim by updating an item
UPDATE items 
SET status = 'claimed' 
WHERE id = 'YOUR_FOUND_ITEM_ID' 
  AND type = 'found';

-- Check if notification was created
SELECT * FROM notifications 
WHERE type = 'finderClaim' 
ORDER BY created_at DESC 
LIMIT 1;
```

## Benefits

### For Finders
- **Recognition:** Acknowledges their honesty
- **Closure:** Confirms their effort made a difference
- **Motivation:** Encourages future good deeds
- **Satisfaction:** Shows the positive outcome

### For System
- **Trust Building:** Shows transparency
- **Community:** Strengthens campus culture
- **Engagement:** Keeps users informed
- **Appreciation:** Rewards honest behavior

## Notification Examples

### When Claimant Name is Known
```
🎉 Your Found Item Was Claimed!

Great news! The item you found and reported "Blue Nike Backpack" has been 
successfully claimed and returned to its owner (John Smith). Thank you for 
being an honest finder! Your good deed helped reunite someone with their 
lost item. 🙏
```

### When Claimant Name is Unknown
```
🎉 Your Found Item Was Claimed!

Great news! The item you found and reported "Blue Nike Backpack" has been 
successfully claimed and returned to its owner. Thank you for being an honest 
finder! Your good deed helped reunite someone with their lost item. 🙏
```

## Files Modified/Created

### Database
- ✅ `create_finder_claim_notification_trigger.sql` - SQL trigger definition
- ✅ `create_finder_claim_notification_trigger.js` - Setup script
- ✅ `notify_finder_on_claim` trigger on `items` table

### Frontend
- ✅ `NotificationsScreen.js` - Added finderClaim handling and icon

## Related Systems

### Works With
- ✅ Item claiming system
- ✅ Match resolution system
- ✅ Status update system
- ✅ Notification display system

### Integrates With
- Claims table (for claimant info)
- Matches table (for fallback claimant info)
- Users table (for claimant name)
- Notifications table (for delivery)

## Future Enhancements

### Potential Additions
1. **Reputation Points:** Award points to honest finders
2. **Thank You Message:** Allow claimant to send personal thanks
3. **Statistics:** Track finder's reunion count
4. **Leaderboard:** Show top honest finders
5. **Badges:** Award "Honest Finder" achievement

## Troubleshooting

### Notification Not Received
Check:
1. Trigger exists: `SHOW TRIGGERS LIKE 'notify_finder_on_claim'`
2. Item type is 'found'
3. Status changed to 'claimed' or 'returned'
4. Finder email exists in items table
5. Notifications table has the record

### Claimant Name Not Showing
- Claimant may not have completed claim process
- No matching claim or match record found
- User table missing claimant's name
- Will still send notification, just without name

## Status: ✅ Complete and Ready

The trigger is created and the frontend is updated. Once you run the database migration, the system will automatically send thank you notifications to honest finders when their found items are claimed!
