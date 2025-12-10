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
    console.log('=== TIMELINE ANALYSIS ===\n');
    
    // Check when trigger was created vs when response was created
    db.query('SHOW TRIGGERS WHERE `Table` = "support_responses"', (err, triggers) => {
        if (err) {
            console.error('Error:', err);
            db.end();
            return;
        }
        
        const responseTrigger = triggers.find(t => t.Trigger === 'after_support_response_insert');
        
        db.query(
            'SELECT id, created_at FROM support_responses ORDER BY created_at',
            (err, responses) => {
                if (err) {
                    console.error('Error:', err);
                    db.end();
                    return;
                }
                
                console.log('=== TIMELINE ===');
                if (responseTrigger) {
                    console.log(`Trigger created: ${responseTrigger.Created}`);
                }
                
                responses.forEach((r, i) => {
                    console.log(`Response ${i + 1} created: ${r.created_at}`);
                    
                    const triggerDate = new Date(responseTrigger.Created);
                    const responseDate = new Date(r.created_at);
                    
                    if (responseDate < triggerDate) {
                        console.log(`  ⚠️  This response was created BEFORE the trigger (no notification)`);
                    } else {
                        console.log(`  ✅ This response was created AFTER the trigger (should have notification)`);
                    }
                });
                
                console.log('\n=== SOLUTION ===');
                console.log('Creating a NEW response now to test current trigger...\n');
                
                // Get the latest ticket
                db.query(
                    'SELECT id, user_email, subject FROM support_tickets ORDER BY created_at DESC LIMIT 1',
                    (err, tickets) => {
                        if (err || tickets.length === 0) {
                            console.error('No tickets found');
                            db.end();
                            return;
                        }
                        
                        const ticket = tickets[0];
                        const newResponseId = `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        
                        console.log(`Creating new response for ticket: ${ticket.subject}`);
                        
                        db.query(
                            `INSERT INTO support_responses (
                                id, ticket_id, admin_email, admin_name, 
                                response_text, is_internal, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                            [
                                newResponseId,
                                ticket.id,
                                'admin@cspc.edu.ph',
                                'Support Team',
                                'We have further investigated your issue. Our team is preparing a comprehensive solution. Thank you for your patience.',
                                0
                            ],
                            (err) => {
                                if (err) {
                                    console.error('Error creating response:', err);
                                    db.end();
                                    return;
                                }
                                
                                console.log('✅ New response created!\n');
                                
                                setTimeout(() => {
                                    // Check for new notification
                                    db.query(
                                        `SELECT * FROM notifications 
                                         WHERE type = 'supportResponse' 
                                         ORDER BY created_at DESC 
                                         LIMIT 1`,
                                        (err, notifs) => {
                                            if (err) {
                                                console.error('Error:', err);
                                            } else if (notifs.length > 0) {
                                                console.log('✅✅✅ SUCCESS! NOTIFICATION CREATED! ✅✅✅\n');
                                                console.table(notifs);
                                                console.log('\n📱 NOW CHECK YOUR APP!');
                                                console.log('You should see BOTH:');
                                                console.log('  🔧 Orange wrench - Status changed to "in_progress"');
                                                console.log('  💬 Blue chat bubbles - Admin response notification');
                                            } else {
                                                console.log('❌ No notification created - trigger issue!');
                                            }
                                            db.end();
                                        }
                                    );
                                }, 1000);
                            }
                        );
                    }
                );
            }
        );
    });
});
