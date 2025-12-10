-- ========================================
-- ADD CLAIM DEADLINE FIELDS
-- ========================================
-- Adds fields to track claim approval deadline for automatic rejection

-- Add new columns to claims table
ALTER TABLE claims
ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL COMMENT 'When the claim was approved',
ADD COLUMN IF NOT EXISTS claim_deadline DATETIME NULL COMMENT '7-day deadline to collect item after approval',
ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL COMMENT 'Reason for automatic rejection';

-- Create index for efficient deadline checking
CREATE INDEX IF NOT EXISTS idx_claim_deadline ON claims(claim_deadline, status);

-- Log completion
SELECT 'Claim deadline fields added successfully' AS status;
