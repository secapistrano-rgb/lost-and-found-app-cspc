const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'lost_and_found'
});

db.connect((err) => {
    if (err) {
        console.error('Connection error:', err);
        process.exit(1);
    }
    
    console.log('Connected to database\n');
    console.log('=== FIXING SUPPORT RESPONSE NOTIFICATIONS ===\n');
    
    const userEmail = 'secapistrano@my.cspc.edu.ph';
    
    // Step 1: Delete old response notifications (if any exist)
    console.log('Step 1: Cleaning up old response notifications...');
    db.query(
        `DELETE FROM notifications WHERE type = 'supportResponse' AND user_email = ?`,
        [userEmail],
        (err, result) => {
            if (err) {
                console.error('Error:', err);
            } else {
                console.log(`✓ Deleted ${result.affectedRows} old response notifications\n`);
            }
            
            // Step 2: Delete old test responses
            console.log('Step 2: Cleaning up test responses...');
            db.query(
                `DELETE FROM support_responses WHERE ticket_id IN (
                    SELECT id FROM support_tickets WHERE user_email = ?
                )`,
                [userEmail],
                (err, result) => {
                    if (err) {
                        console.error('Error:', err);
                    } else {
                        console.log(`✓ Deleted ${result.affectedRows} test responses\n`);
                    }
                    
                    // Step 3: Recreate the trigger
                    console.log('Step 3: Recreating trigger...');
                    db.query('DROP TRIGGER IF EXISTS after_support_response_insert', (err) => {
                        if (err) console.error('Warning:', err.message);
                        
                        const triggerSQL = `
CREATE TRIGGER after_support_response_insert
AFTER INSERT ON support_responses
FOR EACH ROW
BEGIN
    DECLARE notification_id VARCHAR(255);
    DECLARE notification_title VARCHAR(255);
    DECLARE notification_message TEXT;
    DECLARE notification_data JSON;
    DECLARE ticket_subject VARCHAR(500);
    DECLARE ticket_user_email VARCHAR(255);
    
    -- Get ticket information
    SELECT subject, user_email INTO ticket_subject, ticket_user_email
    FROM support_tickets
    WHERE id = NEW.ticket_id;
    
    -- Only create notification for non-internal responses
    IF NEW.is_internal = 0 OR NEW.is_internal = FALSE THEN
        SET notification_id = CONCAT('supportResponse_', UNIX_TIMESTAMP(NOW()), '_', SUBSTRING(MD5(RAND()), 1, 9));
        SET notification_title = 'New Response to Your Support Ticket';
        SET notification_message = CONCAT('You have received a new response to your ticket: "', ticket_subject, '"');
        
        SET notification_data = JSON_OBJECT(
            'type', 'supportResponse',
            'ticketId', NEW.ticket_id,
            'responseId', NEW.id,
            'adminEmail', NEW.admin_email,
            'adminName', NEW.admin_name,
            'subject', ticket_subject
        );
        
        INSERT INTO notifications (
            id, user_email, type, title, message, data, \`read\`, created_at
        ) VALUES (
            notification_id, ticket_user_email, 'supportResponse',
            notification_title, notification_message, notification_data, 0, NOW()
        );
    END IF;
END`;
                        
                        db.query(triggerSQL, (err) => {
                            if (err) {
                                console.error('❌ Error creating trigger:', err);
                                db.end();
                                return;
                            }
                            
                            console.log('✓ Trigger recreated\n');
                            
                            // Step 4: Create a fresh test response
                            console.log('Step 4: Creating fresh test response...');
                            
                            db.query(
                                'SELECT id, subject FROM support_tickets WHERE user_email = ? ORDER BY created_at DESC LIMIT 1',
                                [userEmail],
                                (err, tickets) => {
                                    if (err || tickets.length === 0) {
                                        console.error('No ticket found');
                                        db.end();
                                        return;
                                    }
                                    
                                    const ticket = tickets[0];
                                    const responseId = `response_fresh_${Date.now()}`;
                                    
                                    console.log(`Creating response for ticket: "${ticket.subject}"`);
                                    
                                    db.query(
                                        `INSERT INTO support_responses (
                                            id, ticket_id, admin_email, admin_name, 
                                            response_text, is_internal, created_at
                                        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                                        [
                                            responseId,
                                            ticket.id,
                                            'admin@cspc.edu.ph',
                                            'Support Team',
                                            'We have reviewed your ticket and are working on a solution. Thank you for your patience!',
                                            0  // PUBLIC response
                                        ],
                                        (err) => {
                                            if (err) {
                                                console.error('❌ Error creating response:', err);
                                                db.end();
                                                return;
                                            }
                                            
                                            console.log('✓ Response created!\n');
                                            
                                            // Wait and check for notification
                                            setTimeout(() => {
                                                db.query(
                                                    `SELECT * FROM notifications 
                                                     WHERE type = 'supportResponse' 
                                                     AND user_email = ?
                                                     ORDER BY created_at DESC 
                                                     LIMIT 1`,
                                                    [userEmail],
                                                    (err, notifs) => {
                                                        if (err) {
                                                            console.error('Error:', err);
                                                        } else if (notifs.length > 0) {
                                                            console.log('✅✅✅ SUCCESS! NOTIFICATION CREATED! ✅✅✅\n');
                                                            console.table(notifs.map(n => ({
                                                                type: n.type,
                                                                title: n.title,
                                                                message: n.message.substring(0, 60) + '...',
                                                                created: n.created_at
                                                            })));
                                                            console.log('\n📱 CHECK YOUR APP NOW!');
                                                            console.log('You should see a blue chat bubble notification');
                                                        } else {
                                                            console.log('❌ STILL NOT WORKING - Notification not created');
                                                            console.log('\nDebugging: Check if trigger fired by examining MySQL error log');
                                                        }
                                                        db.end();
                                                    }
                                                );
                                            }, 1000);
                                        }
                                    );
                                }
                            );
                        });
                    });
                }
            );
        }
    );
});
