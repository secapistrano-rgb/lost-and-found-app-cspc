const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'lost_and_found'
});

// Trigger for support_ticket_responses (the REAL table CodeIgniter uses)
const ticketResponseTrigger = `
CREATE TRIGGER create_support_ticket_response_notification
AFTER INSERT ON support_ticket_responses
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
            'Our support team has responded to your ticket "',
            LEFT(ticket_subject, 50),
            CASE 
                WHEN LENGTH(ticket_subject) > 50 THEN '...' 
                ELSE '' 
            END,
            '". Check your Gmail app for the response.'
        );
        
        SET notification_data = JSON_OBJECT(
            'type', 'supportResponse',
            'ticketId', NEW.ticket_id,
            'responseId', NEW.id,
            'adminEmail', NEW.responder_email,
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
    console.log('FIXING: Creating Trigger on CORRECT Table');
    console.log('========================================\n');
    
    console.log('CodeIgniter uses: support_ticket_responses');
    console.log('Old trigger was on: support_responses (wrong!)\n');
    
    // Drop old trigger if exists
    db.query('DROP TRIGGER IF EXISTS create_support_ticket_response_notification', (err) => {
        if (err && err.code !== 'ER_TRG_DOES_NOT_EXIST') {
            console.error('Error dropping old trigger:', err);
        }
        
        console.log('Creating trigger on support_ticket_responses...\n');
        
        db.query(ticketResponseTrigger, (err) => {
            if (err) {
                console.error('❌ Error creating trigger:', err.message);
                db.end();
                process.exit(1);
            }
            
            console.log('✅ Trigger created successfully!\n');
            
            // Show all triggers
            db.query('SHOW TRIGGERS WHERE `Table` IN ("support_tickets", "support_ticket_responses")', (err, triggers) => {
                if (err) {
                    console.error('Error showing triggers:', err);
                } else {
                    console.log('=== ACTIVE SUPPORT TRIGGERS ===');
                    console.table(triggers.map(t => ({
                        Trigger: t.Trigger,
                        Event: t.Event,
                        Table: t.Table,
                        Timing: t.Timing
                    })));
                }
                
                db.end();
                console.log('\n✅ FIXED! Now response notifications will work from CodeIgniter!');
                console.log('\nNext time admin responds in CodeIgniter:');
                console.log('  ✅ Trigger will fire on support_ticket_responses');
                console.log('  ✅ Notification will be created');
                console.log('  ✅ You will see it on your phone!\n');
            });
        });
    });
});
