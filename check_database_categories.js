const mysql = require('mysql2');

// Database connection
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
  
  // Get the most recent items to check categories
  const itemsQuery = `
    SELECT id, title, category, type, status, 
           DATE_FORMAT(date_reported, '%Y-%m-%d %H:%i:%s') as date_reported
    FROM items 
    WHERE status = 'active'
    ORDER BY date_reported DESC 
    LIMIT 10
  `;
  
  db.query(itemsQuery, (err, items) => {
    if (err) {
      console.error('Error fetching items:', err);
      db.end();
      return;
    }
    
    console.log('=== RECENT ACTIVE ITEMS ===\n');
    items.forEach(item => {
      console.log(`ID: ${item.id}`);
      console.log(`Title: ${item.title}`);
      console.log(`Category: "${item.category}"`);
      console.log(`Type: ${item.type}`);
      console.log(`Date: ${item.date_reported}`);
      console.log('---');
    });
    
    // Get the most recent matches
    const matchesQuery = `
      SELECT id, 
             lost_item_id, lost_item_title, lost_item_category,
             found_item_id, found_item_title, found_item_category,
             score, status,
             DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
      FROM matches 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    db.query(matchesQuery, (err, matches) => {
      if (err) {
        console.error('Error fetching matches:', err);
        db.end();
        return;
      }
      
      console.log('\n=== RECENT MATCHES ===\n');
      matches.forEach(match => {
        console.log(`Match ID: ${match.id}`);
        console.log(`Lost: "${match.lost_item_title}" (Category: "${match.lost_item_category}")`);
        console.log(`Found: "${match.found_item_title}" (Category: "${match.found_item_category}")`);
        console.log(`Score: ${(match.score * 100).toFixed(1)}%`);
        console.log(`Status: ${match.status}`);
        console.log(`Created: ${match.created_at}`);
        
        // Check if categories match
        if (match.lost_item_category !== match.found_item_category) {
          console.log('⚠️  WARNING: CATEGORY MISMATCH! This should not happen!');
        }
        console.log('---');
      });
      
      db.end();
      console.log('\nDatabase connection closed.');
    });
  });
});
