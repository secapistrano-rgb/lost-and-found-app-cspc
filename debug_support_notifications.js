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
    console.log('=== DEBUGGING SUPPORT NOTIFICATIONS ===\n');
    
    // Check 1: Do we have any support tickets?
    db.query('SELECT id, user_email, subject, status FROM support_tickets ORDER BY created_at DESC LIMIT 5', (err, tickets) => {
        if (err) {
            console.error('Error fetching tickets:', err);
        } else {
            console.log('=== RECENT SUPPORT TICKETS ===');
            console.table(tickets);
        }
        
        // Check 2: Do we have any support responses?
        db.query('SELECT id, ticket_id, admin_email, admin_name, response_text, is_internal, created_at FROM support_responses ORDER BY created_at DESC LIMIT 5', (err, responses) => {
            if (err) {
                console.error('Error fetching responses:', err);
            } else {
                console.log('\n=== RECENT SUPPORT RESPONSES ===');
                console.table(responses);
            }
            
            // Check 3: Do we have notifications for support?
            db.query(
                `SELECT id, type, title, message, user_email, \`read\`, created_at 
                 FROM notifications 
                 WHERE type IN ('supportStatusUpdate', 'supportResponse')
                 ORDER BY created_at DESC 
                 LIMIT 10`,
                (err, notifications) => {
                    if (err) {
                        console.error('Error fetching notifications:', err);
                    } else {
                        console.log('\n=== SUPPORT NOTIFICATIONS ===');
                        console.table(notifications);
                    }
                    
                    // Check 4: Verify triggers exist
                    db.query(
                        `SHOW TRIGGERS WHERE \`Table\` IN ('support_tickets', 'support_responses')`,
                        (err, triggers) => {
                            if (err) {
                                console.error('Error fetching triggers:', err);
                            } else {
                                console.log('\n=== ACTIVE TRIGGERS ===');
                                console.table(triggers.map(t => ({
                                    Trigger: t.Trigger,
                                    Event: t.Event,
                                    Table: t.Table,
                                    Timing: t.Timing,
                                    Created: t.Created
                                })));
                            }
                            
                            // Check 5: Test if we can find matching ticket for latest response
                            db.query(
                                `SELECT sr.id as response_id, sr.ticket_id, sr.admin_email, sr.is_internal,
                                        st.user_email, st.subject
                                 FROM support_responses sr
                                 LEFT JOIN support_tickets st ON sr.ticket_id = st.id
                                 ORDER BY sr.created_at DESC
                                 LIMIT 5`,
                                (err, joined) => {
                                    if (err) {
                                        console.error('Error in joined query:', err);
                                    } else {
                                        console.log('\n=== RESPONSES WITH TICKET INFO ===');
                                        console.table(joined);
                                        
                                        // Analysis
                                        console.log('\n=== ANALYSIS ===');
                                        if (responses && responses.length > 0) {
                                            const publicResponses = responses.filter(r => r.is_internal === 0 || r.is_internal === false);
                                            console.log(`Total responses: ${responses.length}`);
                                            console.log(`Public responses: ${publicResponses.length}`);
                                            console.log(`Internal responses: ${responses.length - publicResponses.length}`);
                                        } else {
                                            console.log('⚠️  NO RESPONSES FOUND - Admin has not responded to any tickets yet');
                                        }
                                        
                                        if (notifications && notifications.length > 0) {
                                            const responseNotifs = notifications.filter(n => n.type === 'supportResponse');
                                            const statusNotifs = notifications.filter(n => n.type === 'supportStatusUpdate');
                                            console.log(`\nResponse notifications: ${responseNotifs.length}`);
                                            console.log(`Status notifications: ${statusNotifs.length}`);
                                        } else {
                                            console.log('\n⚠️  NO SUPPORT NOTIFICATIONS FOUND');
                                        }
                                    }
                                    
                                    db.end();
                                    console.log('\n=== DEBUG COMPLETE ===');
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});
