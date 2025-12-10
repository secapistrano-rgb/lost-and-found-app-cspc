# Attachment Upload Implementation for Help & Support

## Overview
This document describes the changes made to enable file attachments in the Help & Support screen to be uploaded to the server and made accessible to the web admin panel (CodeIgniter).

## Problem
Previously, when users attached files to support tickets, the file URI was stored as a local device path (e.g., `file:///data/user/0/.../cache/filename.pdf`). This made the files inaccessible to the web admin panel since they only existed on the user's device.

## Solution
Implemented a complete file upload flow that:
1. Uploads the file to the server before submitting the ticket
2. Stores the public web URL in the database
3. Makes the file accessible via HTTP to the admin panel

## Changes Made

### 1. Backend Changes (server.js)

#### Added General File Upload Configuration
```javascript
const fileUpload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|xls|xlsx|csv|zip|rar/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        
        if (extname) {
            return cb(null, true);
        } else {
            cb(new Error('File type not allowed...'));
        }
    }
});
```

#### Added File Upload Endpoint
**Endpoint:** `POST /api/upload/file`

```javascript
app.post('/api/upload/file', fileUpload.single('file'), (req, res) => {
    // Uploads file and returns public URL
    // Example response:
    {
        success: true,
        fileUrl: "http://192.168.254.106:3000/uploads/1234567890_abc123.pdf",
        filename: "1234567890_abc123.pdf",
        originalName: "user_document.pdf",
        size: 150000,
        mimetype: "application/pdf"
    }
});
```

**Supported File Types:**
- Images: jpg, jpeg, png, gif, webp
- Documents: pdf, doc, docx, txt
- Spreadsheets: xls, xlsx, csv
- Archives: zip, rar

**File Size Limit:** 10MB

### 2. API Configuration Changes (apiConfig.js)

#### Added Upload File Endpoint
```javascript
ENDPOINTS: {
    ...
    UPLOAD_FILE: '/api/upload/file',
    ...
}
```

#### Added Upload File Function
```javascript
export const uploadFile = async (fileInfo) => {
    // Creates FormData with file
    // Uploads to server
    // Returns response with public URL
}
```

**Usage:**
```javascript
const result = await uploadFile({
    uri: 'file:///path/to/file.pdf',
    name: 'document.pdf',
    type: 'application/pdf'
});
// Returns: { success: true, fileUrl: 'http://...', ... }
```

### 3. Frontend Changes (HelpSupportScreen.js)

#### Updated Imports
```javascript
import { submitSupportTicket, uploadFile } from '../../../config/apiConfig';
```

#### Enhanced File Selection Validation
Added client-side validation for:
- File size (10MB limit)
- File type (only allowed extensions)
- User feedback with clear messages

#### Modified Ticket Submission Flow
**New Process:**
1. User fills out ticket form and selects attachment
2. When submitting:
   - File is uploaded to server first
   - Server returns public URL
   - Ticket is submitted with the public URL
   - File is now accessible via web

**Code Flow:**
```javascript
// 1. Upload file first
const uploadResult = await uploadFile({
    uri: ticketForm.attachment,
    name: ticketForm.attachmentName,
    type: mimeType
});

// 2. Get public URL
const uploadedFileUrl = uploadResult.fileUrl;

// 3. Submit ticket with public URL
const ticketData = {
    ...
    attachment_url: uploadedFileUrl,
    attachment_filename: ticketForm.attachmentName
};

await submitSupportTicket(ticketData);
```

## Database Schema
The `support_tickets` table stores:
- `attachment_url`: Public web URL (e.g., `http://192.168.254.106:3000/uploads/1234567890_abc123.pdf`)
- `attachment_filename`: Original filename (e.g., `user_document.pdf`)

## Admin Panel Integration

### Accessing Uploaded Files
Files are now accessible via HTTP at:
```
http://192.168.254.106:3000/uploads/{filename}
```

### CodeIgniter Implementation Example
```php
// In your CodeIgniter controller/view
<?php if (!empty($ticket['attachment_url'])): ?>
    <div class="attachment">
        <a href="<?= $ticket['attachment_url'] ?>" target="_blank" download>
            <i class="fa fa-paperclip"></i>
            <?= $ticket['attachment_filename'] ?>
        </a>
    </div>
<?php endif; ?>
```

### Display Options
1. **Direct Link:** Link to download/view the file
2. **Inline Preview:** For images and PDFs, display inline
3. **Download Button:** Styled button to download attachment

### Example Admin Panel HTML
```html
<div class="ticket-details">
    <h3>Ticket #<?= $ticket['id'] ?></h3>
    <p><strong>Subject:</strong> <?= $ticket['subject'] ?></p>
    <p><strong>Description:</strong> <?= $ticket['description'] ?></p>
    
    <?php if ($ticket['attachment_url']): ?>
        <div class="attachment-section">
            <h4>Attachment:</h4>
            <a href="<?= $ticket['attachment_url'] ?>" 
               class="btn btn-primary" 
               target="_blank" 
               download="<?= $ticket['attachment_filename'] ?>">
                <i class="fa fa-download"></i> 
                Download <?= $ticket['attachment_filename'] ?>
            </a>
            
            <!-- For images, show preview -->
            <?php if (preg_match('/\.(jpg|jpeg|png|gif)$/i', $ticket['attachment_filename'])): ?>
                <img src="<?= $ticket['attachment_url'] ?>" 
                     alt="Attachment" 
                     style="max-width: 100%; margin-top: 10px;">
            <?php endif; ?>
        </div>
    <?php endif; ?>
</div>
```

## Security Considerations

### Implemented
- File type validation (client and server)
- File size limits (10MB)
- Unique filename generation to prevent conflicts
- Proper error handling

### Recommended Additional Security
1. **Authentication:** Ensure only authenticated admins can access `/uploads/` directory
2. **File Scanning:** Implement virus/malware scanning for uploaded files
3. **Access Control:** Consider adding token-based access to sensitive files
4. **HTTPS:** Use HTTPS in production for secure file transmission

## Testing

### Test Cases
1. ✅ Upload PDF file
2. ✅ Upload image file (JPG, PNG)
3. ✅ Upload Word document
4. ✅ Upload Excel spreadsheet
5. ✅ Test file size limit (over 10MB should fail)
6. ✅ Test invalid file type (should fail)
7. ✅ Submit ticket without attachment (should work)
8. ✅ Verify file accessible from web browser
9. ✅ Verify file accessible from admin panel

### Manual Testing Steps
1. Open the app
2. Navigate to Help & Support
3. Fill out a support ticket
4. Attach a file (PDF, image, or document)
5. Submit the ticket
6. Check the database for the `attachment_url` field
7. Open the URL in a web browser
8. Verify the file downloads/displays correctly
9. Access the admin panel and verify the attachment is visible/downloadable

## Troubleshooting

### File Not Accessible
- Check server is running: `http://192.168.254.106:3000`
- Verify uploads directory exists and has proper permissions
- Check file was actually uploaded to `/uploads/` directory

### Upload Fails
- Check file size (must be under 10MB)
- Verify file type is allowed
- Check network connection
- Review server logs for errors

### Admin Panel Can't Access Files
- Ensure admin panel can reach the server URL
- Check CORS settings if accessing from different domain
- Verify the URL is correctly stored in database

## Future Enhancements
1. Add progress indicator for large file uploads
2. Implement thumbnail generation for images
3. Add file preview in the app before submission
4. Support multiple file attachments
5. Implement file compression for large files
6. Add admin file management interface

## Deployment Notes

### Production Checklist
- [ ] Update server URL in `apiConfig.js` to production domain
- [ ] Update server URL in `server.js` file upload endpoint
- [ ] Configure production server to serve `/uploads/` directory
- [ ] Set up proper file permissions on server
- [ ] Implement HTTPS for secure file transmission
- [ ] Configure proper CORS settings
- [ ] Set up file backup strategy
- [ ] Implement file cleanup for old/deleted tickets

## Support
For issues or questions, contact the development team.
