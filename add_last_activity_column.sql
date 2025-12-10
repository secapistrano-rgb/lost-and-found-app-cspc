-- Add last_activity_at column to users table for heartbeat tracking
-- Run this SQL command on your MySQL database

ALTER TABLE users 
ADD COLUMN last_activity_at TIMESTAMP NULL DEFAULT NULL 
AFTER last_login_at;

-- Optional: Set current timestamp for all online users
UPDATE users 
SET last_activity_at = NOW() 
WHERE status = 'Online';

-- Verify the column was added
DESCRIBE users;
