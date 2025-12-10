-- Automatic Expiration and Deletion System for Found Items
-- This file creates the event scheduler that automatically deletes expired found items

-- Enable the event scheduler (must be enabled on the MySQL server)
SET GLOBAL event_scheduler = ON;

-- Drop existing event if it exists
DROP EVENT IF EXISTS expire_overdue_found_items;

-- Create event that runs every hour to check and delete expired items
DELIMITER $$

CREATE EVENT expire_overdue_found_items
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Delete found items where:
    -- 1. Type is 'found'
    -- 2. Status is 'pending_turnin' (waiting to be turned in)
    -- 3. Deadline has passed (turnin_deadline < NOW())
    -- 4. Status is NOT 'active' (items turned in to SSC Office are exempt)
    DELETE FROM items
    WHERE type = 'found'
      AND status = 'pending_turnin'
      AND turnin_deadline IS NOT NULL
      AND turnin_deadline < NOW();
      
    -- Optional: Log how many items were deleted (requires a separate log table)
    -- INSERT INTO deletion_log (deleted_at, items_deleted, reason)
    -- VALUES (NOW(), ROW_COUNT(), 'Expired turn-in deadline');
END$$

DELIMITER ;

-- Verify the event was created
SHOW EVENTS WHERE Name = 'expire_overdue_found_items';

-- Check current event scheduler status
SHOW VARIABLES LIKE 'event_scheduler';
