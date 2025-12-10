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
    console.log('=== TESTING SUPPORT RESPONSE NOTIFICATION ===\n');
    
    // Use the actual ticket from your database
    const realTicketId = 'TICKET_1759330325443_n59f7kyn';
    const realUserEmail = 'secapistrano@my.cspc.edu.ph';
    
    console.log(`Testing with real ticket: ${realTicketId}`);
    console.log(`User email: ${realUserEmail}\n`);
    
    // Create a real admin response
    const responseId = `response_admin_${Date.now()}`;
    const createResponseQuery = `
        INSERT INTO support_responses (
            id, ticket_id, admin_email, admin_name, 
            response_text, is_internal, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    
    const responseValues = [
        responseId,
        realTicketId,
        'admin@cspc.edu.ph',
        'Admin Support',
        'Hello! We have reviewed your support ticket. We are working on resolving your issue. Please let us know if you need any additional assistance.',
        false  // This is PUBLIC response, will trigger notification
    ];
    
    console.log('Creating admin response to trigger notification...\n');
    
    db.query(createResponseQuery, responseValues, (err, result) => {
        if (err) {
            console.error('❌ Error creating response:', err);
            db.end();
            return;
        }
        
        console.log('✅ Admin response created successfully!');
        console.log(`Response ID: ${responseId}\n`);
        
        // Wait a moment for trigger to fire
        setTimeout(() => {
            // Check if notification was created
            console.log('Checking if notification was created by trigger...\n');
            db.query(
                `SELECT id, type, title, message, user_email, \`read\`, created_at 
                 FROM notifications 
                 WHERE type = 'supportResponse' 
                 AND user_email = ?
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [realUserEmail],
                (err, notifications) => {
                    if (err) {
                        console.error('Error checking notifications:', err);
                    } else {
                        console.log('=== NOTIFICATION CREATED ===');
                        console.table(notifications);
                        
                        if (notifications.length > 0) {
                            console.log('\n✅ SUCCESS! Notification was created by trigger!');
                            console.log('📱 User should see this notification in their app within 2-3 seconds');
                            
                            // Parse the data field
                            db.query(
                                'SELECT data FROM notifications WHERE id = ?',
                                [notifications[0].id],
                                (err, dataResults) => {
                                    if (!err && dataResults.length > 0) {
                                        console.log('\n=== NOTIFICATION DATA ===');
                                        try {
                                            const data = JSON.parse(dataResults[0].data);
                                            console.log(JSON.stringify(data, null, 2));
                                        } catch (e) {
                                            console.log(dataResults[0].data);
                                        }
                                    }
                                    
                                    // Show the response we created
                                    db.query(
                                        'SELECT * FROM support_responses WHERE id = ?',
                                        [responseId],
                                        (err, responses) => {
                                            if (!err && responses.length > 0) {
                                                console.log('\n=== RESPONSE DETAILS ===');
                                                console.table(responses);
                                            }
                                            
                                            db.end();
                                            console.log('\n=== TEST COMPLETE ===');
                                            console.log('\n📝 NEXT STEPS:');
                                            console.log('1. Open your app');
                                            console.log('2. Go to Notifications screen');
                                            console.log('3. You should see a blue chat bubble notification');
                                            console.log('4. Tap it to view the response');
                                            console.log('\n⚠️  NOTE: Your CodeIgniter admin panel needs to INSERT');
                                            console.log('   into the support_responses table when admin replies.');
                                        }
                                    );
                                }
                            );
                        } else {
                            console.log('\n❌ PROBLEM: Notification was NOT created!');
                            console.log('This means the trigger did not fire properly.');
                        }
                    }
                }
            );
        }, 500);
    });
});
