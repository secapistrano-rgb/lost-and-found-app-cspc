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
  
  console.log('Connected to database\n');
  
  // Get the most recent items
  const query = `
    SELECT id, title, category, type, detected_categories, detected_objects, date_reported
    FROM items 
    ORDER BY date_reported DESC 
    LIMIT 10
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching items:', err);
      db.end();
      process.exit(1);
    }
    
    console.log('=== RECENT ITEMS ===\n');
    
    results.forEach(item => {
      console.log(`${item.type.toUpperCase()}: ${item.title}`);
      console.log(`  Category: "${item.category}"`);
      console.log(`  Detected Categories: ${item.detected_categories}`);
      console.log(`  Detected Objects: ${item.detected_objects}`);
      console.log(`  Date: ${item.date_reported}`);
      console.log('---');
    });
    
    db.end();
    console.log('\nDatabase connection closed.');
  });
});
