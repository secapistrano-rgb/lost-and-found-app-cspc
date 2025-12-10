# 🚀 Quick Deployment Guide - Hostinger VPS

## What You Need to Upload

Upload these 2 files to your VPS server:

1. **`src/shared/api/server.js`** → `/var/www/api/server.js`
2. **`src/shared/api/matchingService.js`** → `/var/www/api/matchingService.js`

---

## Step-by-Step Deployment

### Option 1: Using FileZilla/SFTP (Easiest)

1. **Connect to your VPS:**
   - Host: `srv1052705.xtream-cloud.com`
   - Username: `root`
   - Password: [your password]
   - Port: 22

2. **Upload files:**
   - Navigate to `/var/www/api/`
   - Upload `server.js` (replace existing)
   - Upload `matchingService.js` (replace existing)

3. **Restart Node.js:**
   ```bash
   # Open terminal/SSH
   ssh root@srv1052705.xtream-cloud.com
   
   # Restart the server
   pm2 restart all
   # OR
   killall node && cd /var/www/api && node server.js &
   ```

---

### Option 2: Using SCP Command (From Your Computer)

```powershell
# Open PowerShell on your Windows computer
# Navigate to your project folder
cd C:\Users\CAPISTRANO\Pictures\lost-and-found

# Upload server.js
scp src/shared/api/server.js root@srv1052705.xtream-cloud.com:/var/www/api/server.js

# Upload matchingService.js
scp src/shared/api/matchingService.js root@srv1052705.xtream-cloud.com:/var/www/api/matchingService.js

# SSH into server and restart
ssh root@srv1052705.xtream-cloud.com
pm2 restart all
```

---

### Option 3: Copy-Paste via SSH (Quick but Manual)

1. **SSH into your server:**
   ```bash
   ssh root@srv1052705.xtream-cloud.com
   ```

2. **Backup current files:**
   ```bash
   cd /var/www/api
   cp server.js server.js.backup
   cp matchingService.js matchingService.js.backup
   ```

3. **Edit server.js:**
   ```bash
   nano server.js
   ```
   - Find line ~99: `db.on('connection', function (connection) {`
   - Add the timezone setting code (see below)
   - Press `Ctrl+X`, then `Y`, then `Enter` to save

4. **Edit matchingService.js:**
   ```bash
   nano matchingService.js
   ```
   - Add the `convertToMySQLDatetime` function at the top
   - Update the `values` array in `createMatchRecords`
   - Press `Ctrl+X`, then `Y`, then `Enter` to save

5. **Restart server:**
   ```bash
   pm2 restart all
   ```

---

## Code to Add (If Using Option 3)

### In `server.js` (after line 99):

```javascript
db.on('connection', function (connection) {
    console.log('New connection established as id ' + connection.threadId);
    
    // Set timezone to Philippine Time (UTC+8) for this connection
    connection.query("SET time_zone = '+08:00'", (err) => {
        if (err) {
            console.error('❌ Error setting MySQL timezone for connection ' + connection.threadId + ':', err);
        } else {
            console.log('✅ MySQL timezone set to Philippine Time (UTC+8) for connection ' + connection.threadId);
        }
    });
});
```

### In `matchingService.js` (after the db connection, around line 14):

```javascript
/**
 * Convert ISO date to MySQL DATETIME format
 * @param {string|Date} date - Date in any format
 * @returns {string|null} - MySQL datetime string or null
 */
function convertToMySQLDatetime(date) {
  if (!date) return null;
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return null;
    
    // Format: YYYY-MM-DD HH:MM:SS
    return dateObj.toISOString().slice(0, 19).replace('T', ' ');
  } catch (error) {
    console.error('Error converting date to MySQL format:', error);
    return null;
  }
}
```

Then update the `values` array in `createMatchRecords` function (around line 446) to use:
```javascript
convertToMySQLDatetime(match.lostItem.date_reported),
convertToMySQLDatetime(match.lostItem.date_lost_found),
convertToMySQLDatetime(match.foundItem.date_reported),
convertToMySQLDatetime(match.foundItem.date_lost_found),
```

---

## Verification

After deployment, check the logs:

```bash
# View server logs
pm2 logs

# OR if running directly
tail -f /var/log/syslog | grep node
```

**Look for:**
```
✅ MySQL timezone set to Philippine Time (UTC+8) for connection 123
```

**Test:**
1. Create a new item from your app
2. Create feedback
3. Check if times now show Philippine Time (not UTC)
4. Verify no more date format errors

---

## Rollback (If Something Goes Wrong)

```bash
# SSH into server
ssh root@srv1052705.xtream-cloud.com

# Restore backup
cd /var/www/api
cp server.js.backup server.js
cp matchingService.js.backup matchingService.js

# Restart
pm2 restart all
```

---

## ✅ Success Checklist

- [ ] Files uploaded to VPS
- [ ] Node.js server restarted
- [ ] Logs show "✅ MySQL timezone set to Philippine Time"
- [ ] Create item test - NO errors
- [ ] Update item test - NO errors
- [ ] Feedback test - Times show Philippine Time
- [ ] Matching test - NO date format errors

---

## 🆘 Need Help?

If you encounter any issues:

1. Check logs: `pm2 logs` or `tail -f /var/log/syslog`
2. Verify Node.js is running: `pm2 status` or `ps aux | grep node`
3. Test database connection: `mysql -u root -p` then `USE lost_and_found;`
4. Restore backup if needed (see Rollback section)

---

**Ready to deploy! 🚀**
