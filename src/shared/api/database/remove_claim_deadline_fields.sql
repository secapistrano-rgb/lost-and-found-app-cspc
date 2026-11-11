-- ========================================
-- REMOVE Claim Deadline Fields
-- ========================================
-- Run this on your production database to remove deadline columns

USE lost_and_found;  -- Replace with your actual database name

-- Drop the index first
DROP INDEX IF EXISTS idx_claim_deadline ON claims;

-- Remove columns from claims table (with IF EXISTS for safety)
ALTER TABLE claims
DROP COLUMN IF EXISTS claim_deadline;

ALTER TABLE claims
DROP COLUMN IF EXISTS approved_at;

ALTER TABLE claims
DROP COLUMN IF EXISTS rejection_reason;

-- Show the result
SHOW COLUMNS FROM claims;

SELECT 'Removal completed successfully! Claim deadline fields removed.' AS Status;
