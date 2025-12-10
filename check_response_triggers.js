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
    
    console.log('Checking triggers on support_responses table...\n');
    
    db.query('SHOW TRIGGERS WHERE `Table` = "support_responses"', (err, results) => {
        if (err) {
            console.error('Error:', err);
            db.end();
            return;
        }
        
        console.log('=== TRIGGERS ON support_responses ===');
        console.table(results.map(t => ({
            Trigger: t.Trigger,
            Event: t.Event,
            Timing: t.Timing,
            Statement: t.Statement.substring(0, 100) + '...'
        })));
        
        console.log(`\nFound ${results.length} trigger(s)\n`);
        
        if (results.length > 1) {
            console.log('⚠️  WARNING: Multiple triggers detected!');
            console.log('This will create duplicate notifications.\n');
            console.log('Triggers found:');
            results.forEach(t => {
                console.log(`  - ${t.Trigger}`);
            });
            console.log('\nRecommendation: Keep only "create_support_response_notification"');
            console.log('Drop old trigger: DROP TRIGGER IF EXISTS after_support_response_insert;\n');
        }
        
        db.end();
    });
});
