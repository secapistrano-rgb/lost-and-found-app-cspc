/**
 * Check and Auto-Reject Expired Claims
 * 
 * This script checks for approved claims that have passed their 7-day deadline
 * and automatically rejects them with a notification to the user.
 * 
 * Run this script periodically (e.g., via cron job) or integrate into server startup
 */

const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

async function checkExpiredClaims() {
    return new Promise((resolve, reject) => {
        console.log('=== CHECKING FOR EXPIRED CLAIMS ===');
        console.log('Current time:', new Date().toISOString());
        
        // Find approved claims past their deadline
        const findExpiredQuery = `
            SELECT c.id, c.google_user_id, c.item_id, c.claim_deadline, c.approved_at,
                   i.title as item_title
            FROM claims c
            LEFT JOIN items i ON c.item_id = i.id
            WHERE c.status = 'approved' 
            AND c.claim_deadline IS NOT NULL
            AND c.claim_deadline < NOW()
        `;
        
        connection.query(findExpiredQuery, (err, expiredClaims) => {
            if (err) {
                console.error('❌ Error finding expired claims:', err);
                return reject(err);
            }
            
            if (expiredClaims.length === 0) {
                console.log('✅ No expired claims found');
                return resolve({ processedCount: 0 });
            }
            
            console.log(`⚠️ Found ${expiredClaims.length} expired claim(s)`);
            
            let processedCount = 0;
            const promises = [];
            
            expiredClaims.forEach(claim => {
                const promise = new Promise((res, rej) => {
                    const itemTitle = claim.item_title || 'Item';
                    const rejectionReason = `Claim expired: Item was not collected within 7 days of approval (approved on ${new Date(claim.approved_at).toLocaleDateString()}, deadline was ${new Date(claim.claim_deadline).toLocaleDateString()}). Please submit a new claim request if you still need the item.`;
                    
                    console.log(`\n⏰ Expiring claim ${claim.id}:`);
                    console.log(`   Item: ${itemTitle}`);
                    console.log(`   User: ${claim.google_user_id}`);
                    console.log(`   Approved: ${new Date(claim.approved_at).toLocaleString()}`);
                    console.log(`   Deadline: ${new Date(claim.claim_deadline).toLocaleString()}`);
                    
                    // Update claim status to rejected
                    const updateQuery = `
                        UPDATE claims 
                        SET status = 'rejected',
                            rejection_reason = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `;
                    
                    connection.query(updateQuery, [rejectionReason, claim.id], (updateErr) => {
                        if (updateErr) {
                            console.error(`   ❌ Error updating claim ${claim.id}:`, updateErr);
                            return rej(updateErr);
                        }
                        
                        // Create notification for the user
                        const notificationId = `claimExpired_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        const notificationTitle = 'Claim Expired - Action Required';
                        const notificationMessage = `Your approved claim for "${itemTitle}" has expired because it was not collected within 7 days. You may submit a new claim request if the item is still available.`;
                        const notificationData = JSON.stringify({
                            type: 'claimExpired',
                            claimId: claim.id,
                            itemId: claim.item_id,
                            itemTitle: itemTitle,
                            expiredAt: new Date().toISOString()
                        });
                        
                        const insertNotificationQuery = `
                            INSERT INTO notifications (id, type, title, message, data, \`read\`, created_at, user_email)
                            VALUES (?, 'claimExpired', ?, ?, ?, 0, NOW(), ?)
                        `;
                        
                        connection.query(insertNotificationQuery, [
                            notificationId,
                            notificationTitle,
                            notificationMessage,
                            notificationData,
                            claim.google_user_id
                        ], (notifErr) => {
                            if (notifErr) {
                                console.error(`   ❌ Error creating notification for claim ${claim.id}:`, notifErr);
                            } else {
                                console.log(`   ✅ Notification created for user`);
                            }
                            
                            processedCount++;
                            console.log(`   ✅ Claim ${claim.id} expired and user notified`);
                            res();
                        });
                    });
                });
                
                promises.push(promise);
            });
            
            Promise.all(promises)
                .then(() => {
                    console.log(`\n✅ Processed ${processedCount} expired claim(s)`);
                    resolve({ processedCount });
                })
                .catch(reject);
        });
    });
}

// Main execution
connection.connect(async (err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err);
        process.exit(1);
    }
    
    console.log('✅ Connected to database');
    
    try {
        const result = await checkExpiredClaims();
        console.log('\n=== EXPIRED CLAIMS CHECK COMPLETE ===');
        console.log(`Total expired claims processed: ${result.processedCount}`);
        connection.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error checking expired claims:', error);
        connection.end();
        process.exit(1);
    }
});
