/**
 * Migration Script: Add Claim Deadline Fields
 * 
 * Purpose: Add deadline tracking fields to claims table for automatic rejection
 * after 7 days if not collected
 * 
 * Fields Added:
 * - approved_at: Timestamp when claim was approved
 * - claim_deadline: 7 days after approval for item collection
 * - rejection_reason: Text field for automatic rejection reason
 */

const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
});

connection.connect((err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err);
        process.exit(1);
    }
    console.log('✅ Connected to database');
    
    // Read and execute SQL file
    const fs = require('fs');
    const sql = fs.readFileSync('./add_claim_deadline_fields.sql', 'utf8');
    
    connection.query(sql, (error, results) => {
        if (error) {
            console.error('❌ Error executing migration:', error);
            connection.end();
            process.exit(1);
        }
        
        console.log('✅ Migration completed successfully');
        console.log('\nFields Added:');
        console.log('• approved_at - Tracks when claim was approved');
        console.log('• claim_deadline - 7-day deadline for collection');
        console.log('• rejection_reason - Reason for automatic rejection');
        console.log('\nIndex Created:');
        console.log('• idx_claim_deadline - For efficient deadline checking');
        
        connection.end();
        process.exit(0);
    });
});
