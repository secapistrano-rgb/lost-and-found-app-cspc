# 🚨 URGENT: Fix Claim Deadline Error

## Problem
Your production server is crashing because the database columns don't exist yet:
```
Unknown column 'c.claim_deadline' in 'field list'
```

## Quick Fix - Run SQL Migration on Production

### Option 1: Using MySQL Command Line
```bash
mysql -u your_username -p your_database_name < migrate_claim_deadline.sql
```

### Option 2: Using phpMyAdmin or MySQL Workbench
1. Open your database tool
2. Select your database
3. Run this SQL:

```sql
ALTER TABLE claims
ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL COMMENT 'When the claim was approved';

ALTER TABLE claims
ADD COLUMN IF NOT EXISTS claim_deadline DATETIME NULL COMMENT '7-day deadline to collect item after approval';

ALTER TABLE claims
ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL COMMENT 'Reason for automatic rejection';

CREATE INDEX IF NOT EXISTS idx_claim_deadline ON claims(claim_deadline, status);
```

### Option 3: Using SSH on Your Server
```bash
ssh your_server
cd /var/www/api
mysql -u your_username -p your_database_name < migrate_claim_deadline.sql
```

## After Running Migration

Your server will stop crashing and the claim deadline feature will work!

## Verify It Worked

Run this query to check:
```sql
SHOW COLUMNS FROM claims WHERE Field IN ('approved_at', 'claim_deadline', 'rejection_reason');
```

You should see 3 columns listed.

---

**Note:** The migration is safe to run multiple times (uses `IF NOT EXISTS`)
