-- ========================================
-- CLAIM REQUEST NOTIFICATION TRIGGERS
-- ========================================
-- These triggers automatically create notifications when:
-- 1. Claim request status changes (notifies the claimant)
-- 2. Item is claimed (notifies the finder/reporter of the found item)

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS after_claim_status_update;
DROP TRIGGER IF EXISTS after_claim_approved;

DELIMITER $$

-- ========================================
-- TRIGGER 1: Claim Status Change Notification (for claimant)
-- ========================================
CREATE TRIGGER after_claim_status_update
AFTER UPDATE ON claims
FOR EACH ROW
BEGIN
    DECLARE notification_id VARCHAR(255);
    DECLARE notification_title VARCHAR(255);
    DECLARE notification_message TEXT;
    DECLARE notification_data JSON;
    DECLARE status_label VARCHAR(50);
    DECLARE item_title VARCHAR(255);
    
    -- Only create notification if status actually changed
    IF BINARY OLD.status != BINARY NEW.status THEN
        -- Get item title from items table
        SELECT title INTO item_title
        FROM items
        WHERE id = NEW.item_id
        LIMIT 1;
        
        -- Fallback if item not found
        IF item_title IS NULL THEN
            SET item_title = CONCAT('Item #', NEW.item_id);
        END IF;
        
        -- Generate unique notification ID
        SET notification_id = CONCAT('claimStatus_', UNIX_TIMESTAMP(NOW()), '_', SUBSTRING(MD5(RAND()), 1, 9));
        SET notification_title = 'Claim Request Status Updated';
        
        -- Create user-friendly status label and notification message
        CASE NEW.status
            WHEN 'pending' THEN
                SET status_label = 'Pending Review';
                SET notification_message = CONCAT(
                    'Your claim request for "', LEFT(item_title, 50),
                    CASE WHEN LENGTH(item_title) > 50 THEN '...' ELSE '' END,
                    '" has been received and is currently pending review. Our team will assess your submission shortly.'
                );
            WHEN 'reviewing' THEN
                SET status_label = 'Under Review';
                SET notification_message = CONCAT(
                    'Your claim request for "', LEFT(item_title, 50),
                    CASE WHEN LENGTH(item_title) > 50 THEN '...' ELSE '' END,
                    '" is now under review. Our staff is carefully evaluating your proof of ownership.'
                );
            WHEN 'approved' THEN
                SET status_label = 'Approved';
                SET notification_message = CONCAT(
                    'Congratulations! Your claim request for "', LEFT(item_title, 50),
                    CASE WHEN LENGTH(item_title) > 50 THEN '...' ELSE '' END,
                    '" has been approved. You have 7 days to collect your item from the SSC Office. Please check your email for further instructions regarding item retrieval.'
                );
            WHEN 'rejected' THEN
                SET status_label = 'Rejected';
                SET notification_message = CONCAT(
                    'Your claim request for "', LEFT(item_title, 50),
                    CASE WHEN LENGTH(item_title) > 50 THEN '...' ELSE '' END,
                    '" has been declined. Please check your email for the reason and further guidance.'
                );
            WHEN 'completed' THEN
                SET status_label = 'Completed';
                SET notification_message = CONCAT(
                    'Your claim for "', LEFT(item_title, 50),
                    CASE WHEN LENGTH(item_title) > 50 THEN '...' ELSE '' END,
                    '" has been completed. Thank you for using the Lost and Found system.'
                );
            WHEN 'resolved' THEN
                SET status_label = 'Resolved';
                SET notification_message = CONCAT(
                    'Your claim request for "', LEFT(item_title, 50),
                    CASE WHEN LENGTH(item_title) > 50 THEN '...' ELSE '' END,
                    '" has been successfully resolved. The item has been returned to you. Thank you for your patience.'
                );
            ELSE
                SET status_label = NEW.status;
                SET notification_message = CONCAT(
                    'Your claim request for "', LEFT(item_title, 50),
                    CASE WHEN LENGTH(item_title) > 50 THEN '...' ELSE '' END,
                    '" status has been updated. Please tap to view details.'
                );
        END CASE;
        
        -- Create notification data JSON
        SET notification_data = JSON_OBJECT(
            'type', 'claimStatus',
            'claimId', NEW.id,
            'oldStatus', OLD.status,
            'newStatus', NEW.status,
            'itemTitle', item_title,
            'itemId', NEW.item_id
        );
        
        -- Insert notification for the user
        INSERT INTO notifications (
            id,
            user_email,
            type,
            title,
            message,
            data,
            `read`,
            created_at
        ) VALUES (
            notification_id,
            NEW.google_user_id,
            'claimStatus',
            notification_title,
            notification_message,
            notification_data,
            0,
            NOW()
        );
    END IF;
END$$

-- ========================================
-- TRIGGER 2: Item Claimed Notification (for finder)
-- ========================================
-- Notifies the person who reported the found item when it gets claimed
CREATE TRIGGER after_claim_approved
AFTER UPDATE ON claims
FOR EACH ROW
BEGIN
    DECLARE notification_id VARCHAR(255);
    DECLARE notification_title VARCHAR(255);
    DECLARE notification_message TEXT;
    DECLARE notification_data JSON;
    DECLARE item_title VARCHAR(255);
    DECLARE item_reporter_email VARCHAR(255);
    DECLARE claimant_name VARCHAR(255);
    
    -- Only trigger when claim is approved (for the first time)
    IF BINARY OLD.status != 'approved' AND BINARY NEW.status = 'approved' THEN
        -- Get item details and reporter email
        SELECT title, reporter_email INTO item_title, item_reporter_email
        FROM items
        WHERE id = NEW.item_id
        LIMIT 1;
        
        -- Only notify if this is a found item (has reporter_email)
        IF item_reporter_email IS NOT NULL AND BINARY item_reporter_email != BINARY NEW.google_user_id THEN
            -- Get claimant name from users table
            SELECT name INTO claimant_name
            FROM users
            WHERE email = NEW.google_user_id
            LIMIT 1;
            
            -- Fallback if name not found
            IF claimant_name IS NULL THEN
                SET claimant_name = 'A user';
            END IF;
            
            -- Fallback if item not found
            IF item_title IS NULL THEN
                SET item_title = CONCAT('Item #', NEW.item_id);
            END IF;
            
            -- Generate unique notification ID
            SET notification_id = CONCAT('itemClaimed_', UNIX_TIMESTAMP(NOW()), '_', SUBSTRING(MD5(RAND()), 1, 9));
            SET notification_title = 'Your Found Item Has Been Claimed';
            
            -- Create notification message
            SET notification_message = CONCAT(
                'Good news! The item "', LEFT(item_title, 50),
                CASE WHEN LENGTH(item_title) > 50 THEN '...' ELSE '' END,
                '" that you reported as found has been successfully claimed by its owner. ',
                'Thank you for your honesty and for helping reunite this item with its rightful owner!'
            );
            
            -- Create notification data JSON
            SET notification_data = JSON_OBJECT(
                'type', 'itemClaimed',
                'claimId', NEW.id,
                'itemId', NEW.item_id,
                'itemTitle', item_title,
                'claimantEmail', NEW.google_user_id,
                'claimantName', claimant_name
            );
            
            -- Insert notification for the finder/reporter
            INSERT INTO notifications (
                id,
                user_email,
                type,
                title,
                message,
                data,
                `read`,
                created_at
            ) VALUES (
                notification_id,
                item_reporter_email,
                'itemClaimed',
                notification_title,
                notification_message,
                notification_data,
                0,
                NOW()
            );
        END IF;
    END IF;
END$$

DELIMITER ;

-- Show created triggers
SHOW TRIGGERS WHERE `Table` = 'claims';
