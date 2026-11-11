-- ========================================
-- EMERGENCY FIX: Add Claim Deadline Fields
-- ========================================
-- Run this on your production database to fix the error

USE lost_and_found;  -- Replace with your actual database name

-- Add new columns to claims table (with IF NOT EXISTS for safety)
ALTER TABLE claims
ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL COMMENT 'When the claim was approved';

ALTER TABLE claims
ADD COLUMN IF NOT EXISTS claim_deadline DATETIME NULL COMMENT '7-day deadline to collect item after approval';

ALTER TABLE claims
ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL COMMENT 'Reason for automatic rejection';

-- Create index for efficient deadline checking
CREATE INDEX IF NOT EXISTS idx_claim_deadline ON claims(claim_deadline, status);

-- Show the result
SHOW COLUMNS FROM claims LIKE '%deadline%';
SHOW COLUMNS FROM claims LIKE '%approved_at%';
SHOW COLUMNS FROM claims LIKE '%rejection_reason%';

SELECT 'Migration completed successfully! Claim deadline fields added.' AS Status;
