require('../env');
const mysql = require('mysql2');

// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

console.log('========================================');
console.log('Adding Turn-In Tracking Fields to Items Table');
console.log('========================================\n');

db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
  
  console.log('✓ Connected to database\n');
  
  // Step 1: Add new columns
  console.log('Step 1: Adding new columns...');
  const addColumnsQuery = `
    ALTER TABLE items
    ADD COLUMN IF NOT EXISTS turnin_deadline DATETIME NULL COMMENT '12-hour deadline for found items to be turned in to SSC Office',
    ADD COLUMN IF NOT EXISTS turnin_status ENUM('pending', 'confirmed', 'expired') NULL COMMENT 'Status of turn-in: pending, confirmed by SSC, or expired',
    ADD COLUMN IF NOT EXISTS turnin_confirmed_at DATETIME NULL COMMENT 'When SSC Office confirmed receiving the item',
    ADD COLUMN IF NOT EXISTS turnin_confirmed_by VARCHAR(255) NULL COMMENT 'Email of SSC admin who confirmed turn-in'
  `;
  
  db.query(addColumnsQuery, (err) => {
    if (err) {
      console.error('❌ Error adding columns:', err.message);
      // Continue anyway - columns might already exist
    } else {
      console.log('✓ New columns added successfully\n');
    }
    
    // Step 2: Update status enum
    console.log('Step 2: Updating status enum...');
    const updateStatusQuery = `
      ALTER TABLE items
      MODIFY COLUMN status ENUM('active', 'inactive', 'claimed', 'returned', 'resolved', 'pending_turnin', 'fake_report') DEFAULT 'active'
    `;
    
    db.query(updateStatusQuery, (err) => {
      if (err) {
        console.error('❌ Error updating status enum:', err.message);
      } else {
        console.log('✓ Status enum updated successfully\n');
      }
      
      // Step 3: Add indexes
      console.log('Step 3: Adding indexes...');
      
      // Check if index exists first
      db.query("SHOW INDEX FROM items WHERE Key_name = 'idx_turnin_deadline'", (err, results) => {
        if (err) {
          console.error('❌ Error checking indexes:', err);
          db.end();
          return;
        }
        
        if (results.length === 0) {
          const addIndexQuery = 'CREATE INDEX idx_turnin_deadline ON items(turnin_deadline, status, type)';
          db.query(addIndexQuery, (err) => {
            if (err) {
              console.error('❌ Error adding turnin_deadline index:', err.message);
            } else {
              console.log('✓ Index idx_turnin_deadline created\n');
            }
            
            // Add second index
            db.query("SHOW INDEX FROM items WHERE Key_name = 'idx_turnin_status'", (err, results) => {
              if (results.length === 0) {
                const addIndex2Query = 'CREATE INDEX idx_turnin_status ON items(turnin_status)';
                db.query(addIndex2Query, (err) => {
                  if (err) {
                    console.error('❌ Error adding turnin_status index:', err.message);
                  } else {
                    console.log('✓ Index idx_turnin_status created\n');
                  }
                  
                  verifyChanges();
                });
              } else {
                console.log('✓ Index idx_turnin_status already exists\n');
                verifyChanges();
              }
            });
          });
        } else {
          console.log('✓ Index idx_turnin_deadline already exists\n');
          
          db.query("SHOW INDEX FROM items WHERE Key_name = 'idx_turnin_status'", (err, results) => {
            if (results.length === 0) {
              const addIndex2Query = 'CREATE INDEX idx_turnin_status ON items(turnin_status)';
              db.query(addIndex2Query, (err) => {
                if (err) {
                  console.error('❌ Error adding turnin_status index:', err.message);
                } else {
                  console.log('✓ Index idx_turnin_status created\n');
                }
                verifyChanges();
              });
            } else {
              console.log('✓ Index idx_turnin_status already exists\n');
              verifyChanges();
            }
          });
        }
      });
    });
  });
});

function verifyChanges() {
  console.log('Step 4: Verifying changes...');
  
  db.query('DESCRIBE items', (err, results) => {
    if (err) {
      console.error('❌ Error verifying changes:', err);
      db.end();
      return;
    }
    
    console.log('\n✓ Items table structure:');
    
    const newFields = results.filter(field => 
      ['turnin_deadline', 'turnin_status', 'turnin_confirmed_at', 'turnin_confirmed_by', 'status'].includes(field.Field)
    );
    
    console.table(newFields.map(field => ({
      Field: field.Field,
      Type: field.Type,
      Null: field.Null,
      Default: field.Default
    })));
    
    console.log('\n========================================');
    console.log('✅ Migration completed successfully!');
    console.log('========================================\n');
    console.log('New features enabled:');
    console.log('• Found items require 12-hour turn-in to SSC Office');
    console.log('• Items start with "pending_turnin" status');
    console.log('• Auto-flagged as fake if not turned in within 12 hours');
    console.log('• SSC Admin can confirm turn-in via API');
    console.log('\n');
    
    db.end();
  });
}
