-- Add attachment column to feedback table
-- This allows users to upload files (images, PDFs, documents) with their feedback
-- The admin can access these files via web URL from CodeIgniter

ALTER TABLE feedback 
ADD COLUMN attachment_url TEXT NULL AFTER user_photo_url;

-- Add index for faster queries that filter by attachment presence
ALTER TABLE feedback 
ADD INDEX idx_has_attachment ((attachment_url IS NOT NULL));

-- Display updated structure
DESCRIBE feedback;
