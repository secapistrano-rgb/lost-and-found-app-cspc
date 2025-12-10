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
    console.log('=== CHECKING ALL SUPPORT NOTIFICATIONS ===\n');
    
    // Get all support notifications
    db.query(
        `SELECT id, type, title, LEFT(message, 60) as message_preview, user_email, \`read\`, created_at 
         FROM notifications 
         WHERE type IN ('supportStatusUpdate', 'supportResponse')
         ORDER BY created_at DESC`,
        (err, notifications) => {
            if (err) {
                console.error('Error fetching notifications:', err);
                db.end();
                return;
            }
            
            console.log('=== ALL SUPPORT NOTIFICATIONS ===');
            console.table(notifications);
            
            // Group by type
            const statusNotifs = notifications.filter(n => n.type === 'supportStatusUpdate');
            const responseNotifs = notifications.filter(n => n.type === 'supportResponse');
            
            console.log('\n=== SUMMARY ===');
            console.log(`Total support notifications: ${notifications.length}`);
            console.log(`Status updates: ${statusNotifs.length}`);
            console.log(`Responses: ${responseNotifs.length}`);
            console.log(`Unread: ${notifications.filter(n => n.read === 0).length}`);
            console.log(`Read: ${notifications.filter(n => n.read === 1).length}`);
            
            // Check recent ticket activity
            db.query(
                `SELECT id, subject, status, created_at, updated_at 
                 FROM support_tickets 
                 ORDER BY updated_at DESC 
                 LIMIT 5`,
                (err, tickets) => {
                    if (err) {
                        console.error('Error fetching tickets:', err);
                    } else {
                        console.log('\n=== RECENT TICKETS ===');
                        console.table(tickets);
                    }
                    
                    // Check recent responses
                    db.query(
                        `SELECT sr.id, sr.ticket_id, sr.admin_name, sr.is_internal, sr.created_at,
                                st.subject
                         FROM support_responses sr
                         LEFT JOIN support_tickets st ON sr.ticket_id = st.id
                         ORDER BY sr.created_at DESC
                         LIMIT 5`,
                        (err, responses) => {
                            if (err) {
                                console.error('Error fetching responses:', err);
                            } else {
                                console.log('\n=== RECENT RESPONSES ===');
                                console.table(responses);
                            }
                            
                            db.end();
                            
                            console.log('\n=== ANALYSIS ===');
                            if (responseNotifs.length > 0) {
                                console.log('✅ Response notifications ARE being created');
                                console.log('📱 They should appear in the app with blue chat bubble icon');
                            } else {
                                console.log('⚠️  No response notifications found');
                            }
                            
                            if (statusNotifs.length > 0) {
                                console.log('✅ Status notifications ARE being created');
                                console.log('📱 They should appear in the app with orange wrench icon');
                            } else {
                                console.log('⚠️  No status notifications found');
                            }
                            
                            console.log('\n💡 Both types should show in notifications screen:');
                            console.log('   🔧 Orange wrench = Status changed');
                            console.log('   💬 Blue chat bubbles = Admin replied');
                        }
                    );
                }
            );
        }
    );
});
