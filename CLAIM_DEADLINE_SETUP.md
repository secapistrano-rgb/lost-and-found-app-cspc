# Quick Setup: Claim Deadline System

## Prerequisites
- Node.js installed
- MySQL database running
- `.env` file configured with database credentials

## Step-by-Step Setup

### 1. Run Database Migration

```bash
node add_claim_deadline_fields_migration.js
```

**Expected Output:**
```
✅ Connected to database
✅ Migration completed successfully

Fields Added:
• approved_at - Tracks when claim was approved
• claim_deadline - 7-day deadline for collection
• rejection_reason - Reason for automatic rejection

Index Created:
• idx_claim_deadline - For efficient deadline checking
```

### 2. Restart Your Server

The server will automatically:
- Check for expired claims on startup
- Set up hourly checks thereafter

**Look for this log:**
```
⏰ Starting periodic expired claims checker...
=== CHECKING FOR EXPIRED CLAIMS ===
✅ No expired claims found
```

### 3. Test the Feature

#### Test Approval Flow:
1. Submit a claim request
2. Approve it as admin
3. View claim details
4. See the 7-day deadline countdown

#### Test Expiration (Quick):
```sql
-- Manually set a claim to expire
UPDATE claims 
SET approved_at = DATE_SUB(NOW(), INTERVAL 8 DAY),
    claim_deadline = DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE id = 'your-claim-id';
```

Then run:
```bash
node check_expired_claims.js
```

### 4. Verify Results

Check the claim:
- Status should be 'rejected'
- rejection_reason should be populated
- User should receive notification

## That's It!

The system is now active and will:
✅ Set 7-day deadlines on approval
✅ Check for expired claims every hour
✅ Auto-reject expired claims
✅ Notify users when claims expire

---

## Rollback (If Needed)

```sql
ALTER TABLE claims
DROP COLUMN approved_at,
DROP COLUMN claim_deadline,
DROP COLUMN rejection_reason;

DROP INDEX idx_claim_deadline ON claims;
```
