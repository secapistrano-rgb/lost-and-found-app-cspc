# Auto Re-Match After Deletion - Quick Guide

## 🎯 What It Does

When a user deletes a suggested match, the system **automatically searches for new potential matches** for those items.

---

## 🚀 How to Use

### Single Match Deletion
1. Go to **Matches** screen
2. Tap **Delete** on any match
3. Confirm deletion
4. ✅ System automatically searches for new matches
5. 📬 Get notifications if new matches are found

### Multiple Match Deletion
1. Long-press on a match to enter selection mode
2. Select multiple matches
3. Tap **Delete** button
4. Confirm deletion
5. ✅ System re-matches all involved items
6. 📬 Get notifications for new matches

---

## 🔧 Technical Quick Reference

### Files Modified

| File | Purpose | Changes |
|------|---------|---------|
| `src/shared/api/matchingService.js` | Backend matching logic | Added `runMatchingForItems()` function |
| `src/shared/api/server.js` | API endpoints | Added `POST /api/matches/rematch` endpoint |
| `src/config/apiConfig.js` | Frontend API calls | Added `runRematchForItems()` function |
| `src/features/matching/screens/MatchesScreen.js` | UI logic | Updated delete handlers to trigger re-matching |

### API Endpoint

**POST** `/api/matches/rematch`

**Request Body:**
```json
{
  "lostItemIds": ["item_123", "item_456"],
  "foundItemIds": ["item_789", "item_012"]
}
```

**Response:**
```json
{
  "success": true,
  "matchesFound": 3,
  "highScoreMatches": 1,
  "message": "Found 3 new potential matches"
}
```

### Frontend Usage

```javascript
import { runRematchForItems } from '../../../config/apiConfig';

// Single item re-match
await runRematchForItems([lostItemId], [foundItemId]);

// Multiple items re-match
await runRematchForItems(lostItemIds, foundItemIds);
```

### Backend Function

```javascript
// In matchingService.js
const { runMatchingForItems } = require('./matchingService');

// Run matching for specific items
const result = await runMatchingForItems(lostItems, foundItems);
// Returns: { success, matchesFound, matches, highScoreMatches }
```

---

## 📊 Matching Algorithm

### Scoring Weights
- **Image Similarity**: 65% (Primary factor)
- **Category Match**: 20% (Major factor)
- **Title Keywords**: 5%
- **Description Keywords**: 2%
- **Location Proximity**: 3%
- **Date Proximity**: 8%

### Threshold
- Minimum match score: **40%**
- High score (notification): **40%+**

---

## ✅ Success Messages

### Single Match
> **Match Deleted**  
> The match has been deleted and new potential matches are being searched.

### Multiple Matches
> **Matches Deleted**  
> 3 matches deleted successfully. New potential matches are being searched.

---

## 🧪 Testing

### Test Single Deletion
```bash
1. Create test lost item (e.g., Blue Wallet)
2. Create multiple test found items (e.g., Blue Wallet, Black Wallet)
3. Wait for initial matches
4. Delete the Blue Wallet match
5. Verify new match with Black Wallet appears
```

### Test Bulk Deletion
```bash
1. Create multiple lost/found items
2. Wait for multiple matches
3. Select 3-5 matches
4. Delete all selected
5. Verify new matches appear for all items
```

---

## 🐛 Troubleshooting

### No New Matches Appear

**Possible Causes:**
- No other items in database meet threshold (40%+)
- Items are not active (status != 'active')
- Items are wrong type (lost vs found)

**Solution:** Check console logs for matching results

### Re-Matching Fails

**Check:**
1. Server logs: `console.log` in matchingService.js
2. Network tab: Verify `/api/matches/rematch` call succeeds
3. Database: Verify items exist and are active

### Notifications Not Sent

**Check:**
1. Match score >= 40%
2. User has notification permissions
3. Expo push token is valid
4. Server logs for notification errors

---

## 📝 Console Logs

### Expected Logs on Deletion

```
Match deleted: { deletedMatch: { lostItemId: '...', foundItemId: '...' } }
Triggering re-match for items: { lostItemId: '...', foundItemId: '...' }
Re-matching completed: { success: true, matchesFound: 2 }
```

### Server Logs

```
Re-matching 1 lost items with 1 found items
Sent 1 match notifications for 1 re-matched items
```

---

## 🔍 Database Changes

### Tables Affected

1. **matches** - New match records created
2. **support_notifications** - Notification records created
3. **items** - No changes (read-only during re-match)

### SQL Queries

```sql
-- Delete match (returns info)
SELECT * FROM matches WHERE id = ?;
DELETE FROM matches WHERE id = ?;

-- Fetch items for re-matching
SELECT * FROM items WHERE id IN (...) AND type = 'lost' AND status = 'active';
SELECT * FROM items WHERE id IN (...) AND type = 'found' AND status = 'active';

-- Create new matches
INSERT INTO matches (...) VALUES (...);
```

---

## 🎓 Key Concepts

### Server-Side vs Client-Side Matching

**Before (Client-Side):**
- ❌ Required fetching items to client
- ❌ More network requests
- ❌ Less reliable

**After (Server-Side):**
- ✅ All processing on server
- ✅ Single API call
- ✅ More reliable and efficient

### Why Server-Side is Better

1. **Performance**: No need to transfer item data to client
2. **Reliability**: Server has direct database access
3. **Consistency**: Same matching logic for auto and manual matches
4. **Scalability**: Can handle more items without client overhead

---

## 🚦 Status Indicators

### During Re-Matching
- Loading spinner shown
- User cannot interact with matches list
- "Searching..." message (implicit)

### After Re-Matching
- Success message shown
- Loading spinner hidden
- Matches list refreshed automatically
- New matches highlighted (if any)

---

## 💡 Tips

1. **Always check console logs** when testing re-matching
2. **Test with multiple items** to see bulk re-matching
3. **Verify notifications** are sent for high-score matches
4. **Check database** to confirm new match records
5. **Test with no matches** to verify graceful handling

---

## 📚 Related Documentation

- `AUTO_REMATCH_AFTER_DELETION.md` - Complete implementation guide
- `NOTIFICATION_SYSTEM_IMPLEMENTATION.md` - How notifications work
- `FEEDBACK_FLOW_DIAGRAM.txt` - Overall system flow

---

## 🎉 Summary

**One Line:** Delete match → System finds new matches automatically → User gets notified

**Impact:** Users never miss better matches! 🎯
