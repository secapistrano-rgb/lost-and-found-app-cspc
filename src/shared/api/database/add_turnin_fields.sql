-- Add turn-in tracking fields to items table
-- This supports the 12-hour turn-in requirement for found items

ALTER TABLE items
ADD COLUMN turnin_deadline DATETIME NULL COMMENT '12-hour deadline for found items to be turned in to SSC Office',
ADD COLUMN turnin_status ENUM('pending', 'confirmed', 'expired') NULL COMMENT 'Status of turn-in: pending, confirmed by SSC, or expired',
ADD COLUMN turnin_confirmed_at DATETIME NULL COMMENT 'When SSC Office confirmed receiving the item',
ADD COLUMN turnin_confirmed_by VARCHAR(255) NULL COMMENT 'Email of SSC admin who confirmed turn-in';

-- Update status enum to include new statuses
ALTER TABLE items
MODIFY COLUMN status ENUM('active', 'inactive', 'claimed', 'returned', 'resolved', 'pending_turnin', 'fake_report') DEFAULT 'active';

-- Add index for checking expired deadlines
CREATE INDEX idx_turnin_deadline ON items(turnin_deadline, status, type);

-- Add index for turnin_status queries
CREATE INDEX idx_turnin_status ON items(turnin_status);
