# CodeIgniter Integration Guide for Support Ticket Notifications

## Problem
When you reply to a support ticket in the CodeIgniter admin panel, the notification is not appearing in the mobile app.

## Root Cause
The "Send Reply" button in CodeIgniter is not inserting into the `support_responses` table, so the database trigger never fires to create the notification.

## Solution

### Step 1: Modify Your CodeIgniter Support Ticket Reply Controller

Find the controller method that handles the "Send Reply" button (likely in `application/controllers/Support.php` or `application/controllers/Admin/Support.php`).

**Current code probably looks like:**
```php
public function reply_ticket() {
    $ticket_id = $this->input->post('ticket_id');
    $reply_message = $this->input->post('reply_message');
    $status = $this->input->post('status');
    $is_internal = $this->input->post('internal_note_only') ? 1 : 0;
    
    // Update ticket status
    $this->db->where('id', $ticket_id);
    $this->db->update('support_tickets', [
        'status' => $status,
        'updated_at' => date('Y-m-d H:i:s')
    ]);
    
    // Maybe sends email here...
    
    $this->session->set_flashdata('success', 'Reply sent successfully');
    redirect('admin/support/view/' . $ticket_id);
}
```

**Change it to:**
```php
public function reply_ticket() {
    $ticket_id = $this->input->post('ticket_id');
    $reply_message = $this->input->post('reply_message');
    $status = $this->input->post('status');
    $is_internal = $this->input->post('internal_note_only') ? 1 : 0;
    
    // Get admin info (adjust based on your session structure)
    $admin_email = $this->session->userdata('email') ?: 'admin@cspc.edu.ph';
    $admin_name = $this->session->userdata('name') ?: 'Admin';
    
    // *** ADD THIS: Insert into support_responses table ***
    if (!empty($reply_message)) {
        $response_id = 'response_' . time() . '_' . substr(md5(uniqid()), 0, 8);
        
        $response_data = [
            'id' => $response_id,
            'ticket_id' => $ticket_id,
            'admin_email' => $admin_email,
            'admin_name' => $admin_name,
            'response_text' => $reply_message,
            'is_internal' => $is_internal,
            'created_at' => date('Y-m-d H:i:s')
        ];
        
        $this->db->insert('support_responses', $response_data);
        // *** This INSERT will trigger the notification automatically! ***
    }
    
    // Update ticket status (if changed)
    $this->db->where('id', $ticket_id);
    $this->db->update('support_tickets', [
        'status' => $status,
        'updated_at' => date('Y-m-d H:i:s')
    ]);
    // *** This UPDATE will also trigger a status notification! ***
    
    $this->session->set_flashdata('success', 'Reply sent successfully');
    redirect('admin/support/view/' . $ticket_id);
}
```

### Step 2: Verify the Form Fields

Make sure your form has these fields with the correct names:
- `reply_message` - The textarea for the reply
- `status` - The status dropdown
- `internal_note_only` - The checkbox for internal notes

### Step 3: Test the Integration

1. Go to your CodeIgniter admin panel
2. Open a support ticket
3. Write a reply message
4. Uncheck "Internal Note Only" (if checked)
5. Click "Send Reply"
6. **Check the mobile app** - You should see BOTH notifications:
   - 🔧 Orange wrench: Status update notification
   - 💬 Blue chat bubbles: Reply notification

## Database Triggers (Already Set Up)

These triggers are already in your database and will automatically create notifications:

1. **`after_support_status_update`** - Fires when `support_tickets.status` changes
2. **`after_support_response_insert`** - Fires when a row is inserted into `support_responses`

## Important Notes

- ✅ If **"Internal Note Only"** is checked, NO notification will be sent (as expected)
- ✅ If unchecked, users will receive notifications in their app
- ✅ Status changes will ALWAYS create notifications (even without a reply message)
- ✅ The trigger automatically gets the user's email from the ticket

## Troubleshooting

If notifications still don't appear:

1. Check if the insert is working:
   ```sql
   SELECT * FROM support_responses ORDER BY created_at DESC LIMIT 5;
   ```

2. Check if notifications were created:
   ```sql
   SELECT * FROM notifications 
   WHERE type IN ('supportResponse', 'supportStatusUpdate') 
   ORDER BY created_at DESC LIMIT 5;
   ```

3. Check trigger status:
   ```sql
   SHOW TRIGGERS LIKE 'support_responses';
   SHOW TRIGGERS LIKE 'support_tickets';
   ```

## Questions?

Run the verification script to test:
```bash
node verify_codeigniter_integration.js
```
