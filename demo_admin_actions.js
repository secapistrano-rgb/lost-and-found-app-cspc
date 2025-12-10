const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'lost_and_found'
});

console.log('===========================================');
console.log('DEMONSTRATION: Admin Response + Status Change');
console.log('===========================================\n');

const testEmail = 'secapistrano@my.cspc.edu.ph'; // Your email
const existingTicketId = 'TICKET_1759337273440_u34vrbjv'; // Your ticket

db.connect((err) => {
    if (err) {
        console.error('Connection error:', err);
        process.exit(1);
    }
    
    console.log('Using your existing ticket: "Tuberculosis happen boi hahahaha"\n');
    
    console.log('SIMULATING ADMIN ACTIONS:\n');
    
    // Step 1: Admin creates a response
    console.log('1. Admin writes response: "Your issue has been resolved..."');
    const responseId = `RESPONSE_${Date.now()}_demo`;
    const responseData = {
        id: responseId,
        ticket_id: existingTicketId,
        admin_email: 'admin@cspc.edu.ph',
        admin_name: 'CSPC Support Team',
        response_text: 'Thank you for contacting support. Your issue has been resolved. If you need further assistance, please create a new ticket.',
        is_internal: 0
    };
    
    db.query('INSERT INTO support_responses SET ?', responseData, (err) => {
        if (err) {
            console.error('Error creating response:', err);
            db.end();
            return;
        }
        
        console.log('   ✓ Response created!\n');
        
        // Step 2: Admin changes status
        console.log('2. Admin changes status: closed → resolved');
        db.query(
            'UPDATE support_tickets SET status = ? WHERE id = ?',
            ['resolved', existingTicketId],
            (err) => {
                if (err) {
                    console.error('Error updating status:', err);
                    cleanup();
                    return;
                }
                
                console.log('   ✓ Status updated!\n');
                
                // Wait for triggers
                setTimeout(() => {
                    console.log('===========================================');
                    console.log('CHECKING YOUR NOTIFICATIONS:');
                    console.log('===========================================\n');
                    
                    db.query(
                        `SELECT * FROM notifications 
                         WHERE user_email = ? 
                         AND type IN ('supportStatus', 'supportResponse')
                         ORDER BY created_at DESC 
                         LIMIT 5`,
                        [testEmail],
                        (err, notifications) => {
                            if (err) {
                                console.error('Error:', err);
                                cleanup();
                                return;
                            }
                            
                            console.log(`You now have ${notifications.length} notification(s):\n`);
                            
                            notifications.forEach((notif, i) => {
                                console.log(`${i + 1}. ${notif.type === 'supportStatus' ? '🔵' : '💬'} ${notif.title}`);
                                console.log(`   "${notif.message}"`);
                                console.log(`   Time: ${notif.created_at}\n`);
                            });
                            
                            const hasStatus = notifications.some(n => n.type === 'supportStatus');
                            const hasResponse = notifications.some(n => n.type === 'supportResponse');
                            
                            console.log('===========================================');
                            if (hasStatus && hasResponse) {
                                console.log('✅ SUCCESS! You now see BOTH notifications!');
                            } else if (hasStatus && !hasResponse) {
                                console.log('⚠️  Only status notification (response trigger may not have fired)');
                            } else if (!hasStatus && hasResponse) {
                                console.log('⚠️  Only response notification (status didn\'t change)');
                            }
                            console.log('===========================================\n');
                            
                            console.log('Now check your phone - you should see 2 new notifications! 📱📱\n');
                            
                            console.log('Would you like to clean up the test data? (y/n)');
                            console.log('Test response ID:', responseId);
                            console.log('\nTo keep: Just close this');
                            console.log('To remove: Run cleanup script\n');
                            
                            db.end();
                        }
                    );
                }, 1000);
            }
        );
    });
});

function cleanup() {
    db.end();
}
