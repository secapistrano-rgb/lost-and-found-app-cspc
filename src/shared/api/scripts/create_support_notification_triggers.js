require('../env');
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
});

const statusTrigger = `
CREATE TRIGGER after_support_status_update
AFTER UPDATE ON support_tickets
FOR EACH ROW
BEGIN
    DECLARE notification_id VARCHAR(255);
    DECLARE notification_title VARCHAR(255);
    DECLARE notification_message TEXT;
    DECLARE notification_data JSON;
    DECLARE status_label VARCHAR(50);
    
    IF OLD.status != NEW.status THEN
        SET notification_id = CONCAT('supportStatus_', UNIX_TIMESTAMP(NOW()), '_', SUBSTRING(MD5(RAND()), 1, 9));
        SET notification_title = 'Support Ticket Status Updated';
        
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
        
        SET notification_data = JSON_OBJECT(
            'type', 'supportStatus',
            'ticketId', NEW.id,
            'oldStatus', OLD.status,
            'newStatus', NEW.status,
            'subject', NEW.subject
        );
        
        INSERT INTO notifications (
            id,
            user_email,
            type,
            title,
            message,
            data,
            \`read\`,
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
END
`;

const responseTrigger = `
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
    
    IF NEW.is_internal = 0 THEN
        SELECT subject, user_email 
        INTO ticket_subject, ticket_user_email
        FROM support_tickets 
        WHERE id = NEW.ticket_id
        LIMIT 1;
        
        SET notification_id = CONCAT('supportResponse_', UNIX_TIMESTAMP(NOW()), '_', SUBSTRING(MD5(RAND()), 1, 9));
        SET notification_title = 'New Response to Your Support Ticket';
        
        SET notification_message = CONCAT(
            'Our team has responded to your ticket "',
            LEFT(ticket_subject, 50),
            CASE 
                WHEN LENGTH(ticket_subject) > 50 THEN '...' 
                ELSE '' 
            END,
            '". Please check the response on your Gmail App.'
        );
        
        SET notification_data = JSON_OBJECT(
            'type', 'supportResponse',
            'ticketId', NEW.ticket_id,
            'responseId', NEW.id,
            'adminEmail', NEW.admin_email,
            'subject', ticket_subject
        );
        
        INSERT INTO notifications (
            id,
            user_email,
            type,
            title,
            message,
            data,
            \`read\`,
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
END
`;

db.connect((err) => {
    if (err) {
        console.error('Connection error:', err);
        process.exit(1);
    }
    
    console.log('✓ Connected to database\n');
    console.log('========================================');
    console.log('Creating Support Notification Triggers');
    console.log('========================================\n');
    
    // Drop existing triggers
    db.query('DROP TRIGGER IF EXISTS after_support_status_update', (err) => {
        if (err) console.log('No existing status trigger to drop');
        
        db.query('DROP TRIGGER IF EXISTS create_support_response_notification', (err) => {
            if (err) console.log('No existing response trigger to drop');
            
            console.log('\n1. Creating status change trigger...');
            db.query(statusTrigger, (err) => {
                if (err) {
                    console.error('❌ Error creating status trigger:', err.message);
                    db.end();
                    process.exit(1);
                }
                
                console.log('   ✓ Status change trigger created');
                
                console.log('\n2. Creating response trigger...');
                db.query(responseTrigger, (err) => {
                    if (err) {
                        console.error('❌ Error creating response trigger:', err.message);
                        db.end();
                        process.exit(1);
                    }
                    
                    console.log('   ✓ Response trigger created');
                    
                    // Show the triggers
                    db.query("SHOW TRIGGERS WHERE `Table` IN ('support_tickets', 'support_responses')", (err, triggers) => {
                        if (err) {
                            console.error('Error showing triggers:', err);
                        } else {
                            console.log('\n=== ACTIVE SUPPORT TRIGGERS ===');
                            console.table(triggers.map(t => ({
                                Trigger: t.Trigger,
                                Event: t.Event,
                                Table: t.Table,
                                Timing: t.Timing
                            })));
                        }
                        
                        db.end();
                        console.log('\n✅ Support notification system ready!');
                        console.log('\nTriggers will automatically create notifications when:');
                        console.log('  1. Support ticket status changes (open → in_progress → resolved, etc.)');
                        console.log('  2. Admin responds to a support ticket\n');
                    });
                });
            });
        });
    });
});
