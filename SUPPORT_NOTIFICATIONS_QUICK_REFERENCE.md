# 📋 Quick Reference: Support Notifications

## For Admins (Using CodeIgniter)

### To Notify User of Status Change:
```
1. Open ticket in CodeIgniter panel
2. Change status dropdown (open/in_progress/pending_user/resolved/closed)
3. Click Save
✅ User gets notification automatically within 2-3 seconds
```

### To Notify User of Your Response:
```
1. Open ticket in CodeIgniter panel
2. Write your response
3. Make sure "Internal Note" is UNCHECKED ❌
4. Click Submit
✅ User gets notification automatically within 2-3 seconds
```

### To Add Internal Note (No Notification):
```
1. Open ticket in CodeIgniter panel
2. Write your note
3. CHECK "Internal Note" ✅
4. Click Submit
❌ User does NOT get notification (admin-only note)
```

---

## For Developers

### Test Notifications:
```bash
node test_support_notifications.js
```

### View Triggers:
```sql
SHOW TRIGGERS WHERE `Table` IN ('support_tickets', 'support_responses');
```

### Manual Test Status Change:
```sql
UPDATE support_tickets 
SET status = 'resolved' 
WHERE id = 'your_ticket_id';
```

### Manual Test Response:
```sql
INSERT INTO support_responses (
  id, ticket_id, admin_email, admin_name, 
  response_text, is_internal
) VALUES (
  'response_test_123', 'ticket_id', 
  'admin@example.com', 'Admin', 
  'Test response', FALSE
);
```

---

## Notification Types

| Type | Trigger | Icon | Color | Navigation |
|------|---------|------|-------|------------|
| **supportStatusUpdate** | Status changed | 🔧 construct | Orange | HelpSupport |
| **supportResponse** | Admin responded | 💬 chatbubbles | Blue | HelpSupport |

---

## Status Messages

| Status | Message to User |
|--------|----------------|
| `open` | "Your support ticket is now open and awaiting review" |
| `in_progress` | "Your support ticket is being worked on by our team" |
| `pending_user` | "Your support ticket needs more information from you" |
| `resolved` | "Your support ticket has been resolved. Please check the response" |
| `closed` | "Your support ticket has been closed" |

---

## Troubleshooting

### Notification not appearing?
1. Check trigger exists: `SHOW TRIGGERS WHERE \`Table\` = 'support_tickets';`
2. Check notification created: `SELECT * FROM notifications WHERE type = 'supportStatusUpdate' ORDER BY created_at DESC LIMIT 5;`
3. Wait 2-3 seconds (app polls every 2-3s)

### Trigger not firing?
```bash
# Recreate triggers
node create_support_triggers.js
```

### Test complete flow:
```bash
# Run comprehensive test
node test_support_notifications.js
```

---

## Key Files

| File | Purpose |
|------|---------|
| `create_support_triggers.js` | Creates both triggers |
| `test_support_notifications.js` | Tests end-to-end flow |
| `NotificationsScreen.js` | Handles navigation |
| `HelpSupportScreen.js` | Shows highlighted ticket |

---

## Performance

- **Trigger execution**: Instant (0ms)
- **App polling**: Every 2-3 seconds
- **Total delay**: 2-3 seconds from admin action to user notification

---

## 🎉 That's It!

Everything is automated. Admins just use CodeIgniter normally, users get notified automatically!
