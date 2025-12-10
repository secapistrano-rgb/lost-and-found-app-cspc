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
    console.log('Adding attachment_url column to feedback table...\n');
    
    // Add attachment_url column
    const addColumnQuery = `
        ALTER TABLE feedback 
        ADD COLUMN attachment_url TEXT NULL AFTER user_photo_url
    `;
    
    db.query(addColumnQuery, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('✓ Column attachment_url already exists\n');
            } else {
                console.error('Error adding column:', err);
                db.end();
                return;
            }
        } else {
            console.log('✓ Column attachment_url added successfully\n');
        }
        
        // Add index for attachment filtering
        const addIndexQuery = `
            ALTER TABLE feedback 
            ADD INDEX idx_has_attachment ((attachment_url IS NOT NULL))
        `;
        
        db.query(addIndexQuery, (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_KEYNAME') {
                    console.log('✓ Index idx_has_attachment already exists\n');
                } else {
                    console.error('Error adding index:', err);
                }
            } else {
                console.log('✓ Index idx_has_attachment added successfully\n');
            }
            
            // Show updated table structure
            db.query('DESCRIBE feedback', (err, results) => {
                if (err) {
                    console.error('Error describing table:', err);
                } else {
                    console.log('=== UPDATED FEEDBACK TABLE STRUCTURE ===');
                    console.table(results);
                }
                
                db.end();
                console.log('\n✅ Database migration completed!');
            });
        });
    });
});
