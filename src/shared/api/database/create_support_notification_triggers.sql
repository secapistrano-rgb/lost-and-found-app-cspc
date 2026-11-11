-- ========================================
-- SUPPORT TICKET NOTIFICATION TRIGGERS
-- ========================================
-- These triggers automatically create notifications when:
-- 1. Support ticket status changes
-- 2. Admin responds to support ticket

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS after_support_status_update;
DROP TRIGGER IF EXISTS create_support_response_notification;

DELIMITER $$

-- ========================================
-- TRIGGER 1: Support Status Change Notification
-- ========================================
CREATE TRIGGER after_support_status_update
AFTER UPDATE ON support_tickets
FOR EACH ROW
BEGIN
    DECLARE notification_id VARCHAR(255);
    DECLARE notification_title VARCHAR(255);
    DECLARE notification_message TEXT;
    DECLARE notification_data JSON;
    DECLARE status_label VARCHAR(50);
    
    -- Only create notification if status actually changed
    IF OLD.status != NEW.status THEN
        -- Generate unique notification ID
        SET notification_id = CONCAT('supportStatus_', UNIX_TIMESTAMP(NOW()), '_', SUBSTRING(MD5(RAND()), 1, 9));
        SET notification_title = 'Support Ticket Status Updated';
        
        -- Create user-friendly status label
        CASE NEW.status
            WHEN 'open' THEN
                SET status_label = 'Open';
            WHEN 'in_progress' THEN
                SET status_label = 'In Progress';
            WHEN 'pending_user' THEN
                SET status_label = 'Awaiting Your Response';
            WHEN 'resolved' THEN
                SET status_label = 'Resolved';
            WHEN 'closed' THEN
                SET status_label = 'Closed';
            ELSE
                SET status_label = NEW.status;
        END CASE;
        
        -- Create custom message based on new status
        SET notification_message = CONCAT(
            'Your support ticket "', 
            LEFT(NEW.subject, 50), 
            CASE 
                WHEN LENGTH(NEW.subject) > 50 THEN '...' 
                ELSE '' 
            END,
            '" has been updated to: ',
            status_label,
            '. Tap to view details.'
        );
        
        -- Create notification data JSON
        SET notification_data = JSON_OBJECT(
            'type', 'supportStatus',
            'ticketId', NEW.id,
            'oldStatus', OLD.status,
            'newStatus', NEW.status,
            'subject', NEW.subject
        );
        
        -- Insert notification for the user
        INSERT INTO notifications (
            id,
            user_email,
            type,
            title,
            message,
            data,
            is_read,
            created_at
        ) VALUES (
            notification_id,
            NEW.user_email,
            'supportStatus',
            notification_title,
            notification_message,
            notification_data,
            0,
            NOW()
        );
    END IF;
END$$

-- ========================================
-- TRIGGER 2: Support Response Notification
-- ========================================
CREATE TRIGGER create_support_response_notification
AFTER INSERT ON support_responses
FOR EACH ROW
BEGIN
    DECLARE notification_id VARCHAR(255);
    DECLARE notification_title VARCHAR(255);
    DECLARE notification_message TEXT;
    DECLARE notification_data JSON;
    DECLARE ticket_subject VARCHAR(500);
    DECLARE ticket_user_email VARCHAR(255);
    
    -- Only create notification for non-internal responses
    IF NEW.is_internal = 0 THEN
        -- Get ticket information
        SELECT subject, user_email 
        INTO ticket_subject, ticket_user_email
        FROM support_tickets 
        WHERE id = NEW.ticket_id
        LIMIT 1;
        
        -- Generate unique notification ID
        SET notification_id = CONCAT('supportResponse_', UNIX_TIMESTAMP(NOW()), '_', SUBSTRING(MD5(RAND()), 1, 9));
        SET notification_title = 'New Response to Your Support Ticket';
        
        -- Create message
        SET notification_message = CONCAT(
            'Admin has responded to your ticket "',
            LEFT(ticket_subject, 50),
            CASE 
                WHEN LENGTH(ticket_subject) > 50 THEN '...' 
                ELSE '' 
            END,
            '". Tap to view the response.'
        );
        
        -- Create notification data JSON
        SET notification_data = JSON_OBJECT(
            'type', 'supportResponse',
            'ticketId', NEW.ticket_id,
            'responseId', NEW.id,
            'adminEmail', NEW.admin_email,
            'subject', ticket_subject
        );
        
        -- Insert notification for the user
        INSERT INTO notifications (
            id,
            user_email,
            type,
            title,
            message,
            data,
            is_read,
            created_at
        ) VALUES (
            notification_id,
            ticket_user_email,
            'supportResponse',
            notification_title,
            notification_message,
            notification_data,
            0,
            NOW()
        );
    END IF;
END$$

DELIMITER ;

-- Show created triggers
SHOW TRIGGERS WHERE `Table` IN ('support_tickets', 'support_responses');
