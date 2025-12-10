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
    console.log('=== DETAILED NOTIFICATION ANALYSIS ===\n');
    
    // Get user email first
    const userEmail = 'secapistrano@my.cspc.edu.ph';
    
    // Get ALL notifications for this user
    db.query(
        `SELECT id, type, title, message, data, \`read\`, created_at 
         FROM notifications 
         WHERE user_email = ?
         ORDER BY created_at DESC`,
        [userEmail],
        (err, allNotifs) => {
            if (err) {
                console.error('Error:', err);
                db.end();
                return;
            }
            
            console.log('=== ALL NOTIFICATIONS FOR USER ===');
            console.table(allNotifs.map(n => ({
                id: n.id.substring(0, 20) + '...',
                type: n.type,
                title: n.title.substring(0, 30),
                read: n.read,
                created: n.created_at
            })));
            
            // Get support-specific notifications
            const supportNotifs = allNotifs.filter(n => 
                n.type === 'supportStatusUpdate' || n.type === 'supportResponse'
            );
            
            console.log('\n=== SUPPORT NOTIFICATIONS ONLY ===');
            supportNotifs.forEach(n => {
                console.log(`\n${n.type === 'supportResponse' ? '💬' : '🔧'} ${n.type}`);
                console.log(`   ID: ${n.id}`);
                console.log(`   Title: ${n.title}`);
                console.log(`   Message: ${n.message.substring(0, 80)}...`);
                console.log(`   Read: ${n.read}`);
                console.log(`   Created: ${n.created_at}`);
                
                try {
                    const data = JSON.parse(n.data);
                    console.log(`   Data:`, JSON.stringify(data, null, 2));
                } catch (e) {
                    console.log(`   Data: ${n.data}`);
                }
            });
            
            console.log('\n=== NOTIFICATION COUNTS ===');
            console.log(`Total notifications: ${allNotifs.length}`);
            console.log(`Support notifications: ${supportNotifs.length}`);
            console.log(`  - Status updates: ${supportNotifs.filter(n => n.type === 'supportStatusUpdate').length}`);
            console.log(`  - Responses: ${supportNotifs.filter(n => n.type === 'supportResponse').length}`);
            
            // Check if there are responses in the database
            db.query(
                `SELECT sr.*, st.subject, st.user_email
                 FROM support_responses sr
                 LEFT JOIN support_tickets st ON sr.ticket_id = st.id
                 WHERE st.user_email = ?
                 ORDER BY sr.created_at DESC`,
                [userEmail],
                (err, responses) => {
                    if (err) {
                        console.error('Error:', err);
                    } else {
                        console.log('\n=== SUPPORT RESPONSES ===');
                        console.table(responses.map(r => ({
                            id: r.id.substring(0, 20),
                            ticket_subject: r.subject,
                            admin: r.admin_name,
                            is_internal: r.is_internal,
                            created: r.created_at
                        })));
                        
                        console.log('\n=== DIAGNOSIS ===');
                        
                        const responseNotifs = supportNotifs.filter(n => n.type === 'supportResponse');
                        const publicResponses = responses.filter(r => r.is_internal === 0);
                        
                        console.log(`Public responses in DB: ${publicResponses.length}`);
                        console.log(`Response notifications: ${responseNotifs.length}`);
                        
                        if (publicResponses.length > responseNotifs.length) {
                            console.log('\n❌ PROBLEM: Missing response notifications!');
                            console.log(`   ${publicResponses.length - responseNotifs.length} response(s) did not create notifications`);
                            console.log('\n🔍 Checking trigger...');
                            
                            db.query(
                                'SHOW CREATE TRIGGER after_support_response_insert',
                                (err, trigger) => {
                                    if (err) {
                                        console.error('❌ Trigger does not exist or error:', err.message);
                                    } else {
                                        console.log('✅ Trigger exists');
                                        // Show first 200 chars of trigger
                                        const sql = trigger[0]['SQL Original Statement'];
                                        console.log('Trigger (first 200 chars):', sql.substring(0, 200) + '...');
                                    }
                                    db.end();
                                }
                            );
                        } else if (publicResponses.length === responseNotifs.length && responseNotifs.length > 0) {
                            console.log('\n✅ All response notifications are in database');
                            console.log('📱 Problem might be in the app not displaying them');
                            console.log('\n💡 Check NotificationsScreen.js:');
                            console.log('   - Is supportResponse type handled in renderItem?');
                            console.log('   - Is the icon showing correctly?');
                            db.end();
                        } else {
                            console.log('\n⚠️  No responses have been created yet by admin');
                            db.end();
                        }
                    }
                }
            );
        }
    );
});
