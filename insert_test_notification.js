const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'lost_and_found'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
  console.log('Connected to database');
  
  // Test by directly inserting a claim notification
  const testNotification = {
    id: `claimTest_${Date.now()}`,
    type: 'claimRequest',
    title: 'Test Claim Request Approved',
    message: 'Your claim request for "Test Item" has been approved!',
    data: JSON.stringify({ 
      type: 'claimRequest', 
      claimId: 'test-claim-123',
      status: 'approved'
    }),
    read: 0,
    created_at: new Date().toISOString(),
    user_email: 'secapistrano@my.cspc.edu.ph' // Use an existing user email
  };
  
  console.log('Inserting test claim notification...');
  
  const insertQuery = `
    INSERT INTO notifications (id, type, title, message, data, \`read\`, created_at, user_email) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.query(insertQuery, [
    testNotification.id,
    testNotification.type,
    testNotification.title,
    testNotification.message,
    testNotification.data,
    testNotification.read,
    testNotification.created_at,
    testNotification.user_email
  ], (err, result) => {
    if (err) {
      console.error('Error inserting notification:', err);
    } else {
      console.log('✅ Test claim notification inserted successfully');
      console.log('Notification ID:', testNotification.id);
      console.log('User email:', testNotification.user_email);
      
      // Verify it was inserted
      db.query('SELECT * FROM notifications WHERE id = ?', [testNotification.id], (err, results) => {
        if (err) {
          console.error('Error checking notification:', err);
        } else {
          console.log('Verification - notification found:', results.length > 0);
          if (results.length > 0) {
            console.log('Notification data:', results[0]);
          }
        }
        
        // Check total claim notifications
        db.query(`SELECT COUNT(*) as count FROM notifications WHERE type = 'claimRequest'`, (err, countResult) => {
          if (err) {
            console.error('Error counting notifications:', err);
          } else {
            console.log('Total claimRequest notifications in database:', countResult[0].count);
          }
          
          console.log('\n📱 To see this notification in the app:');
          console.log('1. Open the lost-and-found app');
          console.log('2. Login as secapistrano@my.cspc.edu.ph');
          console.log('3. Navigate to the Notifications screen');
          console.log('4. You should see the test claim notification');
          
          db.end();
        });
      });
    }
  });
});