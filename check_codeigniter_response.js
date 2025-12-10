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
    
    console.log('=== CHECKING CODEIGNITER RESPONSE ===\n');
    
    // Check all responses with detailed info
    db.query(`
        SELECT 
            sr.id,
            sr.ticket_id,
            sr.admin_email,
            sr.admin_name,
            sr.is_internal,
            sr.created_at,
            st.user_email,
            st.subject,
            CASE 
                WHEN sr.is_internal IS NULL THEN 'NULL'
                WHEN sr.is_internal = 0 THEN '0 (FALSE)'
                WHEN sr.is_internal = 1 THEN '1 (TRUE)'
                ELSE CONCAT('OTHER: ', sr.is_internal)
            END as is_internal_display
        FROM support_responses sr
        JOIN support_tickets st ON sr.ticket_id = st.id
        ORDER BY sr.created_at DESC
    `, (err, responses) => {
        if (err) {
            console.error('Error:', err);
            db.end();
            return;
        }
        
        console.log(`Found ${responses.length} response(s):\n`);
        
        responses.forEach((r, i) => {
            console.log(`Response ${i + 1}:`);
            console.log(`  ID: ${r.id}`);
            console.log(`  Ticket: ${r.subject}`);
            console.log(`  Admin: ${r.admin_name} (${r.admin_email})`);
            console.log(`  User Email: ${r.user_email}`);
            console.log(`  is_internal: ${r.is_internal_display}`);
            console.log(`  Created: ${r.created_at}`);
            console.log('');
        });
        
        // Check for matching notifications
        console.log('=== CHECKING FOR NOTIFICATIONS ===\n');
        
        db.query(`
            SELECT 
                n.id,
                n.type,
                n.title,
                n.user_email,
                n.created_at,
                JSON_EXTRACT(n.data, '$.responseId') as response_id
            FROM notifications n
            WHERE n.type = 'supportResponse'
            ORDER BY n.created_at DESC
        `, (err, notifs) => {
            if (err) {
                console.error('Error:', err);
            } else {
                console.log(`Found ${notifs.length} response notification(s)\n`);
                if (notifs.length > 0) {
                    console.table(notifs);
                } else {
                    console.log('❌ NO RESPONSE NOTIFICATIONS FOUND!\n');
                }
            }
            
            // Now check if trigger exists and show it
            console.log('\n=== CHECKING TRIGGER ===\n');
            db.query('SHOW CREATE TRIGGER after_support_response_insert', (err, triggers) => {
                if (err) {
                    console.error('❌ Trigger does not exist!', err.message);
                } else {
                    console.log('✓ Trigger exists\n');
                    console.log('Trigger SQL:');
                    console.log(triggers[0]['SQL Original Statement']);
                }
                db.end();
            });
        });
    });
});
