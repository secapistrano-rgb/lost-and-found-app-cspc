require('./env');
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { runAutoMatching, runMatchingForItems } = require('./matchingService');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const bcrypt = require('bcryptjs');
// Import notification service to ensure table creation
const { ensureNotificationsTable } = require('./notificationService');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// CONFIGURATION - Set these based on your environment
const UPLOADS_DIR = '/var/www/api/uploads'; // Absolute path to uploads
const BASE_URL = 'https://api.lostfound.systems'; // Your production domain
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log(`Created uploads directory at: ${UPLOADS_DIR}`);
}

// Serve static files from uploads directory
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp and random string
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 10);
        const extension = path.extname(file.originalname);
        cb(null, `${timestamp}_${randomString}${extension}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check file type
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});
// Helper function to generate file URL
function getFileUrl(filename) {
    return `${BASE_URL}/uploads/${filename}`;
}

// Configure multer for general file uploads (for attachments, documents, etc.)
const fileUpload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        // Allow common file types for support attachments
        const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|xls|xlsx|csv|zip|rar/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        
        if (extname) {
            return cb(null, true);
        } else {
            cb(new Error('File type not allowed. Allowed: images, PDFs, documents, spreadsheets, text files, and archives.'));
        }
    }
});

// Create a connection pool to the database
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5,
    connectTimeout: 10000,
    queueTimeout: 5000,
    charset: 'utf8mb4',
});

// Handle pool connection errors
db.on('connection', function (connection) {
    console.log('New connection established as id ' + connection.threadId);
});

db.on('error', function(err) {
    console.error('Database error: ', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Database connection lost, attempting to reconnect...');
    } else {
        throw err;
    }
});

// Reusable function to execute queries with retry logic for connection errors
const executeQueryWithRetry = (query, values = [], maxRetries = 3) => {
    return new Promise((resolve, reject) => {
        const attemptQuery = (attempt) => {
            // Set a timeout for the query
            const queryTimeout = setTimeout(() => {
                console.error(`Query timeout on attempt ${attempt}`);
                if (attempt < maxRetries) {
                    setTimeout(() => attemptQuery(attempt + 1), 2000);
                } else {
                    reject(new Error('Database query timeout'));
                }
            }, 8000); // 8 second timeout per query
            
            db.query(query, values, (err, result) => {
                clearTimeout(queryTimeout);
                
                if (err) {
                    console.error(`Database query error (attempt ${attempt}):`, err.message, err.code);
                    
                    // Handle various connection errors with retry
                    const retryableCodes = ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
                    if ((retryableCodes.includes(err.code) || err.fatal) && attempt < maxRetries) {
                        console.log(`Retryable error detected, retrying... (${attempt}/${maxRetries})`);
                        setTimeout(() => attemptQuery(attempt + 1), 2000 * attempt);
                        return;
                    }
                    
                    return reject(err);
                }
                resolve(result);
            });
        };
        attemptQuery(1);
    });
};



// Upload endpoint for single image
app.post('/api/upload/image', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No image file provided' 
            });
        }

        res.json({
            success: true,
            imageUrl: getFileUrl(req.file.filename),
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to upload image' 
        });
    }
});

// Upload endpoint for multiple images
app.post('/api/upload/images', upload.array('images', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No image files provided' 
            });
        }

        // Generate URLs for all uploaded images
        const imageUrls = req.files.map(file => ({
            imageUrl: `http://192.168.1.2:${port}/uploads/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size
        }));
        
        res.json({
            success: true,
            images: imageUrls,
            count: req.files.length
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to upload images' 
        });
    }
});

// Upload endpoint for general files (documents, PDFs, etc.)
app.post('/api/upload/file', fileUpload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file provided' 
            });
        }

        res.json({
            success: true,
            fileUrl: getFileUrl(req.file.filename),
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to upload file' 
        });
    }
});

// RESTful API Routes for Items

// GET /api/items - Get all items with optional filtering
app.get('/api/items', (req, res) => {
    const { 
        type, 
        status, 
        category, 
        reporter_email, 
        location, 
        brand, 
        color, 
        size, 
        material,
        date_from,
        date_to,
        limit = 50, 
        offset = 0 
    } = req.query;
    
    let query = `SELECT * FROM items WHERE 1=1`;
    const queryParams = [];
    
    // Add filters
    if (type && ['lost', 'found'].includes(type)) {
        query += ' AND type = ?';
        queryParams.push(type);
    }
    
    if (status && ['active', 'inactive', 'claimed', 'returned', 'resolved'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    if (category) {
        query += ' AND category = ?';
        queryParams.push(category);
    }
    
    if (reporter_email) {
        query += ' AND reporter_email = ?';
        queryParams.push(reporter_email);
    }
    
    if (location) {
        query += ' AND location LIKE ?';
        queryParams.push(`%${location}%`);
    }
    
    if (brand) {
        query += ' AND brand LIKE ?';
        queryParams.push(`%${brand}%`);
    }
    
    if (color) {
        query += ' AND color LIKE ?';
        queryParams.push(`%${color}%`);
    }
    
    if (size) {
        query += ' AND size = ?';
        queryParams.push(size);
    }
    
    if (material) {
        query += ' AND material LIKE ?';
        queryParams.push(`%${material}%`);
    }
    
    if (date_from) {
        query += ' AND date_reported >= ?';
        queryParams.push(date_from);
    }
    
    if (date_to) {
        query += ' AND date_reported <= ?';
        queryParams.push(date_to);
    }
    
    // Add ordering and pagination
    query += ' ORDER BY date_reported DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching items:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Parse JSON fields
        const processedResults = results.map(item => ({
            ...item,
            images: item.images ? JSON.parse(item.images) : []
        }));
        
        res.json(processedResults);
    });
});

// GET /api/items/search - Full-text search items
app.get('/api/items/search', (req, res) => {
    const { q, type, status, category, limit = 20 } = req.query;
    
    if (!q) {
        return res.status(400).json({ error: 'Search query parameter "q" is required' });
    }
    
    let query = `SELECT *, MATCH(title, description, distinctive_features, detected_objects, detected_categories) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance 
                 FROM items 
                 WHERE MATCH(title, description, distinctive_features, detected_objects, detected_categories) AGAINST(? IN NATURAL LANGUAGE MODE)`;
    
    let queryParams = [q, q];
    
    // Add optional filters
    if (type && ['lost', 'found'].includes(type)) {
        query += ' AND type = ?';
        queryParams.push(type);
    }
    
    if (status && ['active', 'inactive', 'claimed', 'returned'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    if (category) {
        query += ' AND category = ?';
        queryParams.push(category);
    }
    
    query += ' ORDER BY relevance DESC, date_reported DESC LIMIT ?';
    queryParams.push(parseInt(limit));
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error searching items:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Parse JSON fields
        const processedResults = results.map(item => ({
            ...item,
            images: item.images ? JSON.parse(item.images) : []
        }));
        
        res.json(processedResults);
    });
});

// GET /api/items/stats - Get statistics about items
app.get('/api/items/stats', (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as total_items,
            SUM(CASE WHEN type = 'lost' THEN 1 ELSE 0 END) as lost_items,
            SUM(CASE WHEN type = 'found' THEN 1 ELSE 0 END) as found_items,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_items,
            SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimed_items,
            SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned_items,
            COUNT(DISTINCT category) as total_categories,
            COUNT(DISTINCT reporter_email) as unique_reporters
        FROM items
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching stats:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json(results[0]);
    });
});

// GET /api/items/:id - Get a specific item by ID
app.get('/api/items/:id', (req, res) => {
    const itemId = req.params.id;
    const query = 'SELECT * FROM items WHERE id = ?';
    
    db.query(query, [itemId], (err, results) => {
        if (err) {
            console.error('Error fetching item:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const item = results[0];
        item.images = item.images ? JSON.parse(item.images) : [];
        
        res.json(item);
    });
});

// GET /api/items/reporter/:email - Get items by reporter email
app.get('/api/items/reporter/:email', (req, res) => {
    const reporterEmail = req.params.email;
    const { type, status, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM items WHERE reporter_email = ?';
    let queryParams = [reporterEmail];
    
    // Add optional filters
    if (type && ['lost', 'found'].includes(type)) {
        query += ' AND type = ?';
        queryParams.push(type);
    }
    
    if (status && ['active', 'inactive', 'claimed', 'returned'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    query += ' ORDER BY date_reported DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching items by reporter:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Parse JSON fields
        const processedResults = results.map(item => ({
            ...item,
            images: item.images ? JSON.parse(item.images) : []
        }));
        
        res.json(processedResults);
    });
});

// POST /api/items - Create a new item
app.post('/api/items', (req, res) => {
    const {
        id,
        title,
        description,
        category,
        type,
        status = 'active',
        location,
        latitude,
        longitude,
        date_lost_found,
        turnin_deadline,
        turnin_status,
        reporter_id,
        reporter_name,
        reporter_email,
        reporter_department,
        images = [],
        detected_objects,
        detected_categories
    } = req.body;
    
    // Validate required fields
    if (!id || !title || !type || !reporter_id || !reporter_email) {
        return res.status(400).json({ 
            error: 'Missing required fields: id, title, type, reporter_id, reporter_email' 
        });
    }
    
    // Validate enum values
    if (!['lost', 'found'].includes(type)) {
        return res.status(400).json({ error: 'Type must be either "lost" or "found"' });
    }
    
    if (status && !['active', 'inactive', 'claimed', 'returned', 'resolved', 'pending_turnin', 'fake_report'].includes(status)) {
        return res.status(400).json({ error: 'Status must be one of: active, inactive, claimed, returned, resolved, pending_turnin, fake_report' });
    }
    
    // Validate coordinates if provided
    if ((latitude && !longitude) || (!latitude && longitude)) {
        return res.status(400).json({ error: 'Both latitude and longitude must be provided together' });
    }
    
    if (latitude && (latitude < -90 || latitude > 90)) {
        return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
    }
    
    if (longitude && (longitude < -180 || longitude > 180)) {
        return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
    }
   

    const query = `INSERT INTO items (
        id, title, description, category, type, status, location, latitude, longitude,
        date_lost_found, turnin_deadline, turnin_status, reporter_id, reporter_name, reporter_email, reporter_department,
        images, detected_objects, detected_categories
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, STR_TO_DATE(?, '%Y-%m-%dT%H:%i:%s.%fZ'),
              STR_TO_DATE(?, '%Y-%m-%dT%H:%i:%s.%fZ'), ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
        id, title, description, category, type, status, location, latitude, longitude,
        date_lost_found, turnin_deadline, turnin_status, reporter_id, reporter_name, reporter_email, reporter_department, JSON.stringify(images),
        detected_objects, detected_categories
    ];
    
    // Execute query with retry logic
    executeQueryWithRetry(query, values)
        .then(async (result) => {
        
        // Item created successfully, now run auto-matching
        const newItem = {
            id, title, description, category, type, status, location, latitude, longitude,
            date_lost_found, reporter_id, reporter_name, reporter_email, reporter_department,
            images: JSON.parse(JSON.stringify(images)), detected_objects, detected_categories,
            date_reported: new Date().toISOString()
        };
        
        // Run auto-matching in the background (don't wait for it to complete)
        runAutoMatching(newItem)
            .then(matchResult => {
                if (matchResult.success && matchResult.matchesFound > 0) {
                    console.log(`Auto-matching completed: ${matchResult.matchesFound} matches found for item ${id}`);
                    if (matchResult.highScoreMatches.length > 0) {
                        console.log(`High-confidence matches found: ${matchResult.highScoreMatches.length}`);
                    }
                } else {
                    console.log(`Auto-matching completed: No matches found for item ${id}`);
                }
            })
            .catch(error => {
                console.error('Auto-matching failed:', error);
            });
        
            res.status(201).json({ 
                message: 'Item created successfully', 
                itemId: id 
            });
        })
        .catch((error) => {
            console.error('Failed to create item after retries:', error);
            
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Item with this ID already exists' });
            }
            
            return res.status(500).json({ error: 'Internal server error' });
        });
});

// PUT /api/items/:id - Update an item
app.put('/api/items/:id', (req, res) => {
    const itemId = req.params.id;
    
    console.log('=== UPDATE ITEM BACKEND ===');
    console.log('Item ID:', itemId);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const {
        title,
        description,
        category,
        categories,
        type,
        status,
        location,
        latitude,
        longitude,
        date_lost_found,
        date_occurred,
        reporter_name,
        images,
        detected_objects,
        detected_categories,
        coordinates,
        geotagged
    } = req.body;

    if (date_lost_found) req.body.date_lost_found = date_lost_found.replace('T', ' ').replace('Z', '');

    
    const updateFields = [];
    const values = [];
    
    // Build dynamic update query
    if (title !== undefined) {
        updateFields.push('title = ?');
        values.push(title);
    }
    
    if (description !== undefined) {
        updateFields.push('description = ?');
        values.push(description);
    }
    
    // Handle categories (prioritize categories array over single category)
    if (categories !== undefined) {
        updateFields.push('category = ?');
        values.push(JSON.stringify(categories));
    } else if (category !== undefined) {
        updateFields.push('category = ?');
        values.push(category);
    }
    
    if (type !== undefined) {
        if (!['lost', 'found'].includes(type)) {
            return res.status(400).json({ error: 'Type must be either "lost" or "found"' });
        }
        updateFields.push('type = ?');
        values.push(type);
    }
    
    if (status !== undefined) {
        if (!['active', 'inactive', 'claimed', 'returned', 'resolved', 'pending_turnin', 'fake_report'].includes(status)) {
            return res.status(400).json({ error: 'Status must be one of: active, inactive, claimed, returned, resolved, pending_turnin, fake_report' });
        }
        updateFields.push('status = ?');
        values.push(status);
    }
    
    if (location !== undefined) {
        updateFields.push('location = ?');
        values.push(location);
    }
    
    if (latitude !== undefined) {
        if (latitude < -90 || latitude > 90) {
            return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
        }
        updateFields.push('latitude = ?');
        values.push(latitude);
    }
    
    if (longitude !== undefined) {
        if (longitude < -180 || longitude > 180) {
            return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
        }
        updateFields.push('longitude = ?');
        values.push(longitude);
    }
    
    if (date_lost_found !== undefined) {
        updateFields.push('date_lost_found = ?');
        values.push(date_lost_found);
    }
    
    if (date_occurred !== undefined) {
        updateFields.push('date_lost_found = ?');
        values.push(date_occurred);
    }
    
    if (coordinates !== undefined) {
        if (coordinates && coordinates.latitude !== undefined) {
            updateFields.push('latitude = ?');
            values.push(coordinates.latitude);
        }
        if (coordinates && coordinates.longitude !== undefined) {
            updateFields.push('longitude = ?');
            values.push(coordinates.longitude);
        }
    }
    
    if (geotagged !== undefined) {
        // Handle geotagged flag - if false, clear coordinates
        if (!geotagged) {
            updateFields.push('latitude = NULL, longitude = NULL');
        }
    }
    
    if (reporter_name !== undefined) {
        updateFields.push('reporter_name = ?');
        values.push(reporter_name);
    }
    
    if (images !== undefined) {
        updateFields.push('images = ?');
        values.push(JSON.stringify(images));
    }
    
    if (detected_objects !== undefined) {
        updateFields.push('detected_objects = ?');
        values.push(detected_objects);
    }
    
    if (detected_categories !== undefined) {
        updateFields.push('detected_categories = ?');
        values.push(detected_categories);
    }
    
    if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Add updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(itemId);
    
    const query = `UPDATE items SET ${updateFields.join(', ')} WHERE id = ?`;
    
    console.log('Update fields:', updateFields);
    console.log('Update values:', values);
    console.log('Final query:', query);
    
    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error updating item:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        res.json({ message: 'Item updated successfully' });
    });
});

// PATCH /api/items/:id/status - Update item status
app.patch('/api/items/:id/status', (req, res) => {
    const itemId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['active', 'inactive', 'claimed', 'returned', 'resolved', 'pending_turnin', 'fake_report'].includes(status)) {
        return res.status(400).json({ 
            error: 'Status must be one of: active, inactive, claimed, returned, resolved, pending_turnin, fake_report' 
        });
    }
    
    const query = 'UPDATE items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    db.query(query, [status, itemId], (err, result) => {
        if (err) {
            console.error('Error updating item status:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        res.json({ message: `Item status updated to ${status} successfully` });
    });
});

// DELETE /api/items/:id - Delete an item (only by the reporter)
app.delete('/api/items/:id', (req, res) => {
    const itemId = req.params.id;
    const { userEmail } = req.body;
    
    // Validate that userEmail is provided
    if (!userEmail) {
        return res.status(400).json({ error: 'User email is required for authorization' });
    }
    
    // First, check if the item exists and if the user is the reporter
    const checkQuery = 'SELECT reporter_id FROM items WHERE id = ?';
    
    db.query(checkQuery, [itemId], (err, results) => {
        if (err) {
            console.error('Error checking item ownership:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const item = results[0];
        
        // Check if the current user is the reporter of this item
        if (item.reporter_id !== userEmail) {
            return res.status(403).json({ error: 'You can only delete items that you reported' });
        }
        
        // If authorized, proceed with deletion
        const deleteQuery = 'DELETE FROM items WHERE id = ?';
        
        db.query(deleteQuery, [itemId], (deleteErr, deleteResult) => {
            if (deleteErr) {
                console.error('Error deleting item:', deleteErr);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            res.json({ message: 'Item deleted successfully' });
        });
    });
});

// GET /api/items/nearby - Get items within a certain radius (requires coordinates)
app.get('/api/items/nearby', (req, res) => {
    const { lat, lng, radius = 5, type, status, category, limit = 20 } = req.query;
    
    if (!lat || !lng) {
        return res.status(400).json({ 
            error: 'Latitude and longitude parameters are required' 
        });
    }
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius);
    
    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
        return res.status(400).json({ 
            error: 'Invalid latitude, longitude, or radius values' 
        });
    }
    
    let query = `
        SELECT *, 
        (
            6371 * acos(
                cos(radians(?)) * 
                cos(radians(latitude)) * 
                cos(radians(longitude) - radians(?)) + 
                sin(radians(?)) * 
                sin(radians(latitude))
            )
        ) AS distance
        FROM items 
        WHERE latitude IS NOT NULL 
        AND longitude IS NOT NULL
    `;
    
    let queryParams = [latitude, longitude, latitude];
    
    // Add optional filters
    if (type && ['lost', 'found'].includes(type)) {
        query += ' AND type = ?';
        queryParams.push(type);
    }
    
    if (status && ['active', 'inactive', 'claimed', 'returned'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    if (category) {
        query += ' AND category = ?';
        queryParams.push(category);
    }
    
    query += ' HAVING distance <= ? ORDER BY distance ASC LIMIT ?';
    queryParams.push(radiusKm, parseInt(limit));
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching nearby items:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Parse JSON fields
        const processedResults = results.map(item => ({
            ...item,
            images: item.images ? JSON.parse(item.images) : []
        }));
        
        res.json(processedResults);
    });
});

// GET /api/items/categories - Get all unique categories
app.get('/api/items/categories', (req, res) => {
    const query = 'SELECT DISTINCT category FROM items WHERE category IS NOT NULL ORDER BY category';
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching categories:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        const categories = results.map(row => row.category);
        res.json(categories);
    });
});

// Connect to the database
// Test the database connection
db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
    connection.release();
});

// Handle connection errors
db.on('connection', function (connection) {
    console.log('New connection established as id ' + connection.threadId);
});

db.on('error', function(err) {
    console.error('Database error:', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Database connection was closed.');
    }
    if(err.code === 'ER_CON_COUNT_ERROR') {
        console.log('Database has too many connections.');
    }
    if(err.code === 'ECONNREFUSED') {
        console.log('Database connection was refused.');
    }
});



// RESTful API Routes for Users

// GET /api/users - Get all users
app.get('/api/users', (req, res) => {
    const query = 'SELECT id, google_id, email, full_name, profile_image, department, status, created_at, updated_at, last_login_at FROM users';
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});

// GET /api/users/search - Search users by email or name
app.get('/api/users/search', (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({ error: 'Search query parameter "q" is required' });
    }
    
    const query = `SELECT id, google_id, email, full_name, profile_image, department, status, created_at, updated_at, last_login_at, two_factor_enabled, suspended_until, suspension_reason, suspended_by 
                   FROM users 
                   WHERE email LIKE ? OR full_name LIKE ?`;
    
    const searchTerm = `%${q}%`;
    
    db.query(query, [searchTerm, searchTerm], (err, results) => {
        if (err) {
            console.error('Error searching users:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json(results);
    });
});

// GET /api/users/:id - Get a specific user by ID
app.get('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    const query = 'SELECT id, google_id, email, full_name, profile_image, department, status, created_at, updated_at, last_login_at, two_factor_enabled, suspended_until, suspension_reason, suspended_by FROM users WHERE id = ?';
    
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(results[0]);
    });
});

// POST /api/users - Create a new user
app.post('/api/users', async (req, res) => {
    const { google_id, email, password, full_name, profile_image, department, status, two_factor_enabled } = req.body;
    
    // Validate required fields
    if (!google_id || !email) {
        return res.status(400).json({ error: 'google_id and email are required' });
    }
    
    try {
        // Hash password if provided
        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }
        
        const query = `INSERT INTO users (google_id, email, password, full_name, profile_image, department, status) 
                       VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        const values = [
            google_id,
            email,
            hashedPassword,
            full_name || null,
            profile_image || null,
            department || null,
            status || 'Online'
        ];
        
        db.query(query, values, (err, result) => {
            if (err) {
                console.error('Error creating user:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'User with this email or google_id already exists' });
                }
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            res.status(201).json({ 
                message: 'User created successfully', 
                userId: result.insertId 
            });
        });
    } catch (error) {
        console.error('Error hashing password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/users/:id - Update a user
app.put('/api/users/:id', async (req, res) => {
    const userId = req.params.id;
    const { google_id, email, password, full_name, profile_image, department, status, two_factor_enabled } = req.body;
    
    try {
        // Build dynamic update query
        let updateFields = [];
        let values = [];
        
        if (google_id !== undefined) {
            updateFields.push('google_id = ?');
            values.push(google_id);
        }
        if (email !== undefined) {
            updateFields.push('email = ?');
            values.push(email);
        }
        if (password !== undefined && password !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push('password = ?');
            values.push(hashedPassword);
        }
        if (full_name !== undefined) {
            updateFields.push('full_name = ?');
            values.push(full_name);
        }
        if (profile_image !== undefined) {
            updateFields.push('profile_image = ?');
            values.push(profile_image);
        }
        if (department !== undefined) {
            updateFields.push('department = ?');
            values.push(department);
        }
        if (status !== undefined) {
            updateFields.push('status = ?');
            values.push(status);
        }
        if (two_factor_enabled !== undefined) {
            updateFields.push('two_factor_enabled = ?');
            values.push(two_factor_enabled);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        // Add updated_at timestamp
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(userId);
        
        const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        
        db.query(query, values, (err, result) => {
            if (err) {
                console.error('Error updating user:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'User with this email or google_id already exists' });
                }
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            res.json({ message: 'User updated successfully' });
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/users/:id/login - Update last login timestamp
app.patch('/api/users/:id/login', (req, res) => {
    const userId = req.params.id;
    const query = 'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error updating last login:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'Last login updated successfully' });
    });
});

// PATCH /api/users/:id/status - Update user status (Online/Offline)
app.patch('/api/users/:id/status', (req, res) => {
    const userId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['Online', 'Offline'].includes(status)) {
        return res.status(400).json({ error: 'Status must be either "Online" or "Offline"' });
    }
    
    const query = 'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    db.query(query, [status, userId], (err, result) => {
        if (err) {
            console.error('Error updating user status:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: `User status updated to ${status} successfully` });
    });
});

// DELETE /api/users/:id - Delete a user
app.delete('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    const query = 'DELETE FROM users WHERE id = ?';
    
    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error deleting user:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'User deleted successfully' });
    });
});

// RESTful API Routes for User Settings

// GET /api/users/:email/settings - Get user settings by email
app.get('/api/users/:email/settings', (req, res) => {
    const email = req.params.email;
    
    // First verify user exists
    const userQuery = 'SELECT id FROM users WHERE email = ?';
    
    db.query(userQuery, [email], (err, userResults) => {
        if (err) {
            console.error('Error checking user:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (userResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userId = userResults[0].id;
        
        // Get user settings
        const settingsQuery = 'SELECT * FROM user_settings WHERE user_id = ?';
        
        db.query(settingsQuery, [userId], (err, settingsResults) => {
            if (err) {
                console.error('Error fetching user settings:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            if (settingsResults.length === 0) {
                // Return default settings if none exist
                const defaultSettings = {
                    notifications: true,
                    emailAlerts: true,
                    saveImageToGallery: false
                };
                return res.json(defaultSettings);
            }
            
            const settings = settingsResults[0];
            res.json({
                notifications: Boolean(settings.notifications),
                emailAlerts: Boolean(settings.email_alerts),
                saveImageToGallery: Boolean(settings.save_image_to_gallery),
                updatedAt: settings.updated_at
            });
        });
    });
});

// PUT /api/users/:email/settings - Update user settings
app.put('/api/users/:email/settings', (req, res) => {
    const email = req.params.email;
    const { notifications, emailAlerts, saveImageToGallery } = req.body;
    
    // Validate input
    if (typeof notifications !== 'boolean' || 
        typeof emailAlerts !== 'boolean' || 
        typeof saveImageToGallery !== 'boolean') {
        return res.status(400).json({ 
            error: 'Invalid settings format. All settings must be boolean values.' 
        });
    }
    
    // First verify user exists
    const userQuery = 'SELECT id FROM users WHERE email = ?';
    
    db.query(userQuery, [email], (err, userResults) => {
        if (err) {
            console.error('Error checking user:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (userResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userId = userResults[0].id;
        
        // Check if settings already exist
        const checkQuery = 'SELECT id FROM user_settings WHERE user_id = ?';
        
        db.query(checkQuery, [userId], (err, existingSettings) => {
            if (err) {
                console.error('Error checking existing settings:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            if (existingSettings.length > 0) {
                // Update existing settings
                const updateQuery = `
                    UPDATE user_settings 
                    SET notifications = ?, email_alerts = ?, save_image_to_gallery = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                `;
                
                db.query(updateQuery, [notifications, emailAlerts, saveImageToGallery, userId], (err, result) => {
                    if (err) {
                        console.error('Error updating user settings:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }
                    
                    res.json({ 
                        message: 'Settings updated successfully',
                        settings: { notifications, emailAlerts, saveImageToGallery }
                    });
                });
            } else {
                // Create new settings
                const insertQuery = `
                    INSERT INTO user_settings (user_id, notifications, email_alerts, save_image_to_gallery) 
                    VALUES (?, ?, ?, ?)
                `;
                
                db.query(insertQuery, [userId, notifications, emailAlerts, saveImageToGallery], (err, result) => {
                    if (err) {
                        console.error('Error creating user settings:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }
                    
                    res.json({ 
                        message: 'Settings created successfully',
                        settings: { notifications, emailAlerts, saveImageToGallery }
                    });
                });
            }
        });
    });
});

// DELETE /api/users/:email/delete-all-data - Delete all user data (destructive operation)
app.delete('/api/users/:email/delete-all-data', async (req, res) => {
    const email = req.params.email;
    
    try {
        // First verify user exists and get user ID
        const userQuery = 'SELECT id FROM users WHERE email = ?';
        const userResults = await executeQueryWithRetry(userQuery, [email]);
        
        if (userResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userId = userResults[0].id;
        
        console.log(`Starting deletion of all data for user: ${email} (ID: ${userId})`);
        
        // Delete in order to respect foreign key constraints
        // 1. Delete feedback responses
        await executeQueryWithRetry('DELETE FROM feedback_responses WHERE feedback_id IN (SELECT id FROM feedback WHERE user_email = ?)', [email]);
        console.log('Deleted feedback responses');
        
        // 2. Delete feedback
        await executeQueryWithRetry('DELETE FROM feedback WHERE user_email = ?', [email]);
        console.log('Deleted feedback');
        
        // 3. Delete support ticket responses
        await executeQueryWithRetry('DELETE FROM support_ticket_responses WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_email = ?)', [email]);
        console.log('Deleted support ticket responses');
        
        // 4. Delete support tickets
        await executeQueryWithRetry('DELETE FROM support_tickets WHERE user_email = ?', [email]);
        console.log('Deleted support tickets');
        
        // 5. Delete notifications
        await executeQueryWithRetry('DELETE FROM notifications WHERE user_email = ?', [email]);
        console.log('Deleted notifications');
        
        // 6. Delete claims (using google_user_id which stores the email)
        await executeQueryWithRetry('DELETE FROM claims WHERE google_user_id = ?', [email]);
        console.log('Deleted claims');
        
        // 7. Delete matches where user is involved
        await executeQueryWithRetry(
            'DELETE FROM matches WHERE lost_item_id IN (SELECT id FROM items WHERE reporter_email = ?) OR found_item_id IN (SELECT id FROM items WHERE reporter_email = ?)',
            [email, email]
        );
        console.log('Deleted matches');
        
        // 8. Delete items reported by user
        await executeQueryWithRetry('DELETE FROM items WHERE reporter_email = ?', [email]);
        console.log('Deleted items');
        
        // 9. Delete user settings (if table exists)
        try {
            await executeQueryWithRetry('DELETE FROM user_settings WHERE user_id = ?', [userId]);
            console.log('Deleted user settings');
        } catch (err) {
            if (err.code === 'ER_NO_SUCH_TABLE') {
                console.log('user_settings table does not exist, skipping...');
            } else {
                throw err;
            }
        }
        
        // 10. Delete user violations (if table exists)
        try {
            await executeQueryWithRetry('DELETE FROM user_violations WHERE user_id = ?', [userId]);
            console.log('Deleted user violations');
        } catch (err) {
            if (err.code === 'ER_NO_SUCH_TABLE') {
                console.log('user_violations table does not exist, skipping...');
            } else {
                throw err;
            }
        }
        
        // 11. Finally delete the user
        await executeQueryWithRetry('DELETE FROM users WHERE id = ?', [userId]);
        console.log('Deleted user account');
        
        res.json({ 
            success: true,
            message: 'All user data has been permanently deleted',
            deletedFor: email
        });
        
    } catch (err) {
        console.error('Error deleting user data:', err);
        res.status(500).json({ 
            error: 'Failed to delete user data',
            details: err.message 
        });
    }
});

// RESTful API Routes for Matches

// GET /api/matches - Get all matches with optional filtering
app.get('/api/matches', (req, res) => {
    const { 
        status, 
        lost_item_id, 
        found_item_id, 
        user_email,
        min_score,
        max_score,
        limit = 50, 
        offset = 0 
    } = req.query;
    
    let query = `SELECT * FROM matches WHERE 1=1`;
    const queryParams = [];
    
    // Add filters
    if (status && ['pending', 'accepted', 'rejected', 'resolved'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    if (lost_item_id) {
        query += ' AND lost_item_id = ?';
        queryParams.push(lost_item_id);
    }
    
    if (found_item_id) {
        query += ' AND found_item_id = ?';
        queryParams.push(found_item_id);
    }
    
    if (user_email) {
        query += ' AND (lost_item_reporter_email = ? OR found_item_reporter_email = ?)';
        queryParams.push(user_email, user_email);
    }
    
    if (min_score) {
        query += ' AND score >= ?';
        queryParams.push(parseFloat(min_score));
    }
    
    if (max_score) {
        query += ' AND score <= ?';
        queryParams.push(parseFloat(max_score));
    }
    
    // Add ordering and pagination
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching matches:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});

// GET /api/matches/test - Test route
app.get('/api/matches/test', (req, res) => {
    res.json({ message: 'Test route working', timestamp: new Date().toISOString() });
});

// GET /api/matches/stats - Get match statistics
app.get('/api/matches/stats', (req, res) => {
    console.log('STATS ROUTE HIT - URL:', req.url, 'Params:', req.params);
    const { user_email } = req.query;
    
    let query = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
            AVG(score) as average_score
        FROM matches
    `;
    
    const queryParams = [];
    
    if (user_email) {
        query += ' WHERE (lost_item_reporter_email = ? OR found_item_reporter_email = ?)';
        queryParams.push(user_email, user_email);
    }
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching match statistics:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        const stats = results[0];
        res.json({
            total: stats.total || 0,
            pending: stats.pending || 0,
            accepted: stats.accepted || 0,
            rejected: stats.rejected || 0,
            resolved: stats.resolved || 0,
            average_score: (stats.average_score != null && typeof stats.average_score === 'number') ? parseFloat(stats.average_score.toFixed(2)) : 0
        });
    });
});

// GET /api/matches/user/:email - Get matches for a specific user
app.get('/api/matches/user/:email', (req, res) => {
    const userEmail = req.params.email;
    const { status, limit = 50, offset = 0 } = req.query;
    
    // Include image fields for proper image display
    let query = `SELECT 
        id, created_at, updated_at, status, score,
        lost_item_id, lost_item_title, lost_item_description, lost_item_category,
        lost_item_location, lost_item_latitude, lost_item_longitude,
        lost_item_date_reported, lost_item_date_lost_found, lost_item_reporter_name,
        lost_item_reporter_email, lost_item_reporter_department, lost_item_images,
        lost_item_detected_objects, lost_item_detected_categories,
        found_item_id, found_item_title, found_item_description, found_item_category,
        found_item_location, found_item_latitude, found_item_longitude,
        found_item_date_reported, found_item_date_lost_found, found_item_reporter_name,
        found_item_reporter_email, found_item_reporter_department, found_item_images,
        found_item_detected_objects, found_item_detected_categories
    FROM matches WHERE (lost_item_reporter_email = ? OR found_item_reporter_email = ?)`;
    const queryParams = [userEmail, userEmail];
    
    if (status && ['pending', 'accepted', 'rejected', 'resolved'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching user matches:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(results);
    });
});

// GET /api/matches/:id - Get a specific match by ID
app.get('/api/matches/:id', (req, res) => {
    const matchId = req.params.id;
    const query = 'SELECT * FROM matches WHERE id = ?';
    
    db.query(query, [matchId], (err, results) => {
        if (err) {
            console.error('Error fetching match:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        res.json(results[0]);
    });
});



// POST /api/matches - Create a new match
app.post('/api/matches', (req, res) => {
    const {
        id,
        status = 'pending',
        score,
        lost_item_id,
        lost_item_title,
        lost_item_description,
        lost_item_category,
        lost_item_location,
        lost_item_latitude,
        lost_item_longitude,
        lost_item_date_reported,
        lost_item_date_lost_found,
        lost_item_reporter_name,
        lost_item_reporter_email,
        lost_item_reporter_department,
        lost_item_images,
        lost_item_detected_objects,
        lost_item_detected_categories,
        found_item_id,
        found_item_title,
        found_item_description,
        found_item_category,
        found_item_location,
        found_item_latitude,
        found_item_longitude,
        found_item_date_reported,
        found_item_date_lost_found,
        found_item_reporter_name,
        found_item_reporter_email,
        found_item_reporter_department,
        found_item_images,
        found_item_detected_objects,
        found_item_detected_categories
    } = req.body;
    
    // Validate required fields
    if (!id || !score || !lost_item_id || !found_item_id) {
        return res.status(400).json({ error: 'Missing required fields: id, score, lost_item_id, found_item_id' });
    }
    
    if (!['pending', 'accepted', 'rejected', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be: pending, accepted, rejected, or resolved' });
    }
    
    const query = `
        INSERT INTO matches (
            id, status, score, lost_item_id, lost_item_title, lost_item_description,
            lost_item_category, lost_item_location, lost_item_latitude, lost_item_longitude,
            lost_item_date_reported, lost_item_date_lost_found, lost_item_reporter_name,
            lost_item_reporter_email, lost_item_reporter_department, lost_item_images,
            lost_item_detected_objects, lost_item_detected_categories, found_item_id,
            found_item_title, found_item_description, found_item_category, found_item_location,
            found_item_latitude, found_item_longitude, found_item_date_reported,
            found_item_date_lost_found, found_item_reporter_name, found_item_reporter_email,
            found_item_reporter_department, found_item_images, found_item_detected_objects,
            found_item_detected_categories
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        id, status, score, lost_item_id, lost_item_title, lost_item_description,
        lost_item_category, lost_item_location, lost_item_latitude, lost_item_longitude,
        lost_item_date_reported, lost_item_date_lost_found, lost_item_reporter_name,
        lost_item_reporter_email, lost_item_reporter_department, lost_item_images,
        lost_item_detected_objects, lost_item_detected_categories, found_item_id,
        found_item_title, found_item_description, found_item_category, found_item_location,
        found_item_latitude, found_item_longitude, found_item_date_reported,
        found_item_date_lost_found, found_item_reporter_name, found_item_reporter_email,
        found_item_reporter_department, found_item_images, found_item_detected_objects,
        found_item_detected_categories
    ];
    
    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error creating match:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Match already exists for these items' });
            }
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.status(201).json({ 
            message: 'Match created successfully', 
            matchId: id 
        });
    });
});

// PUT /api/matches/:id - Update a match completely
app.put('/api/matches/:id', (req, res) => {
    const matchId = req.params.id;
    const {
        status,
        score,
        lost_item_title,
        lost_item_description,
        lost_item_category,
        lost_item_location,
        lost_item_latitude,
        lost_item_longitude,
        lost_item_date_reported,
        lost_item_date_lost_found,
        lost_item_reporter_name,
        lost_item_reporter_email,
        lost_item_reporter_department,
        lost_item_images,
        lost_item_detected_objects,
        lost_item_detected_categories,
        found_item_title,
        found_item_description,
        found_item_category,
        found_item_location,
        found_item_latitude,
        found_item_longitude,
        found_item_date_reported,
        found_item_date_lost_found,
        found_item_reporter_name,
        found_item_reporter_email,
        found_item_reporter_department,
        found_item_images,
        found_item_detected_objects,
        found_item_detected_categories
    } = req.body;
    
    if (status && !['pending', 'accepted', 'rejected', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be: pending, accepted, rejected, or resolved' });
    }
    
    const query = `
        UPDATE matches SET 
            status = COALESCE(?, status),
            score = COALESCE(?, score),
            lost_item_title = COALESCE(?, lost_item_title),
            lost_item_description = COALESCE(?, lost_item_description),
            lost_item_category = COALESCE(?, lost_item_category),
            lost_item_location = COALESCE(?, lost_item_location),
            lost_item_latitude = COALESCE(?, lost_item_latitude),
            lost_item_longitude = COALESCE(?, lost_item_longitude),
            lost_item_date_reported = COALESCE(?, lost_item_date_reported),
            lost_item_date_lost_found = COALESCE(?, lost_item_date_lost_found),
            lost_item_reporter_name = COALESCE(?, lost_item_reporter_name),
            lost_item_reporter_email = COALESCE(?, lost_item_reporter_email),
            lost_item_reporter_department = COALESCE(?, lost_item_reporter_department),
            lost_item_images = COALESCE(?, lost_item_images),
            lost_item_detected_objects = COALESCE(?, lost_item_detected_objects),
            lost_item_detected_categories = COALESCE(?, lost_item_detected_categories),
            found_item_title = COALESCE(?, found_item_title),
            found_item_description = COALESCE(?, found_item_description),
            found_item_category = COALESCE(?, found_item_category),
            found_item_location = COALESCE(?, found_item_location),
            found_item_latitude = COALESCE(?, found_item_latitude),
            found_item_longitude = COALESCE(?, found_item_longitude),
            found_item_date_reported = COALESCE(?, found_item_date_reported),
            found_item_date_lost_found = COALESCE(?, found_item_date_lost_found),
            found_item_reporter_name = COALESCE(?, found_item_reporter_name),
            found_item_reporter_email = COALESCE(?, found_item_reporter_email),
            found_item_reporter_department = COALESCE(?, found_item_reporter_department),
            found_item_images = COALESCE(?, found_item_images),
            found_item_detected_objects = COALESCE(?, found_item_detected_objects),
            found_item_detected_categories = COALESCE(?, found_item_detected_categories),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    
    const values = [
        status, score, lost_item_title, lost_item_description, lost_item_category,
        lost_item_location, lost_item_latitude, lost_item_longitude, lost_item_date_reported,
        lost_item_date_lost_found, lost_item_reporter_name, lost_item_reporter_email,
        lost_item_reporter_department, lost_item_images, lost_item_detected_objects,
        lost_item_detected_categories, found_item_title, found_item_description,
        found_item_category, found_item_location, found_item_latitude, found_item_longitude,
        found_item_date_reported, found_item_date_lost_found, found_item_reporter_name,
        found_item_reporter_email, found_item_reporter_department, found_item_images,
        found_item_detected_objects, found_item_detected_categories, matchId
    ];
    
    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error updating match:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        res.json({ message: 'Match updated successfully' });
    });
});

// PATCH /api/matches/:id/status - Update match status only
app.patch('/api/matches/:id/status', (req, res) => {
    const matchId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['pending', 'accepted', 'rejected', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'Status must be: pending, accepted, rejected, or resolved' });
    }
    
    const query = 'UPDATE matches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    db.query(query, [status, matchId], (err, result) => {
        if (err) {
            console.error('Error updating match status:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        res.json({ message: `Match status updated to ${status} successfully` });
    });
});

// DELETE /api/matches/:id - Delete a match
app.delete('/api/matches/:id', async (req, res) => {
    const matchId = req.params.id;
    
    try {
        // First, get the match details before deleting
        const getMatchQuery = 'SELECT * FROM matches WHERE id = ?';
        const matchResults = await executeQueryWithRetry(getMatchQuery, [matchId]);
        
        if (matchResults.length === 0) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        const deletedMatch = matchResults[0];
        
        // Delete the match
        const deleteQuery = 'DELETE FROM matches WHERE id = ?';
        await executeQueryWithRetry(deleteQuery, [matchId]);
        
        // Return match details so we can trigger re-matching
        res.json({ 
            message: 'Match deleted successfully',
            deletedMatch: {
                id: deletedMatch.id,
                lostItemId: deletedMatch.lost_item_id,
                foundItemId: deletedMatch.found_item_id,
                score: deletedMatch.score
            }
        });
    } catch (err) {
        console.error('Error deleting match:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/matches - Delete multiple matches
app.delete('/api/matches', async (req, res) => {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Please provide an array of match IDs to delete' });
    }
    
    try {
        // First, get all matches details before deleting
        const placeholders = ids.map(() => '?').join(',');
        const getMatchesQuery = `SELECT * FROM matches WHERE id IN (${placeholders})`;
        const matchResults = await executeQueryWithRetry(getMatchesQuery, ids);
        
        // Store deleted matches info for re-matching
        const deletedMatches = matchResults.map(match => ({
            id: match.id,
            lostItemId: match.lost_item_id,
            foundItemId: match.found_item_id,
            score: match.score
        }));
        
        // Delete the matches
        const deleteQuery = `DELETE FROM matches WHERE id IN (${placeholders})`;
        const result = await executeQueryWithRetry(deleteQuery, ids);
        
        res.json({ 
            message: `${result.affectedRows} match(es) deleted successfully`,
            deletedCount: result.affectedRows,
            deletedMatches: deletedMatches
        });
    } catch (err) {
        console.error('Error deleting matches:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/matches/rematch - Run matching for specific items after deletion
app.post('/api/matches/rematch', async (req, res) => {
    const { lostItemIds, foundItemIds } = req.body;
    
    if (!lostItemIds || !foundItemIds || !Array.isArray(lostItemIds) || !Array.isArray(foundItemIds)) {
        return res.status(400).json({ error: 'Please provide arrays of lost and found item IDs' });
    }
    
    if (lostItemIds.length === 0 || foundItemIds.length === 0) {
        return res.json({
            success: true,
            matchesFound: 0,
            message: 'No items provided for re-matching'
        });
    }
    
    try {
        // Fetch lost items
        const lostItemsPlaceholders = lostItemIds.map(() => '?').join(',');
        const lostItemsQuery = `SELECT * FROM items WHERE id IN (${lostItemsPlaceholders}) AND type = 'lost' AND status = 'active'`;
        const lostItems = await executeQueryWithRetry(lostItemsQuery, lostItemIds);
        
        // Fetch found items
        const foundItemsPlaceholders = foundItemIds.map(() => '?').join(',');
        const foundItemsQuery = `SELECT * FROM items WHERE id IN (${foundItemsPlaceholders}) AND type = 'found' AND status = 'active'`;
        const foundItems = await executeQueryWithRetry(foundItemsQuery, foundItemIds);
        
        if (lostItems.length === 0 || foundItems.length === 0) {
            return res.json({
                success: true,
                matchesFound: 0,
                message: 'No active items found for re-matching'
            });
        }
        
        console.log(`Re-matching ${lostItems.length} lost items with ${foundItems.length} found items`);
        
        // Run matching for these specific items
        const matchingResult = await runMatchingForItems(lostItems, foundItems);
        
        res.json({
            success: matchingResult.success,
            matchesFound: matchingResult.matchesFound,
            highScoreMatches: matchingResult.highScoreMatches?.length || 0,
            message: `Found ${matchingResult.matchesFound} new potential matches`
        });
        
    } catch (err) {
        console.error('Error in re-matching:', err);
        return res.status(500).json({ 
            success: false,
            error: 'Internal server error during re-matching',
            message: err.message 
        });
    }
});



// RESTful API Routes for Claims

// GET /api/claims - Get all claims with optional filtering
app.get('/api/claims', (req, res) => {
    const { 
        item_id, 
        match_id, 
        claimant_id, 
        claim_type, 
        status, 
        google_user_id,

        date_from,
        date_to,
        limit = 50, 
        offset = 0 
    } = req.query;
    
    let query = `SELECT * FROM claims WHERE 1=1`;
    const queryParams = [];
    
    // Add filters
    if (item_id) {
        query += ' AND item_id = ?';
        queryParams.push(item_id);
    }
    
    if (match_id) {
        query += ' AND match_id = ?';
        queryParams.push(match_id);
    }
    
    if (claimant_id) {
        query += ' AND claimant_id = ?';
        queryParams.push(claimant_id);
    }
    
    if (claim_type && ['ownership', 'finder'].includes(claim_type)) {
        query += ' AND claim_type = ?';
        queryParams.push(claim_type);
    }
    
    if (status && ['pending', 'approved', 'rejected', 'resolved'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    if (google_user_id) {
        query += ' AND google_user_id = ?';
        queryParams.push(google_user_id);
    }
    

    
    if (date_from) {
        query += ' AND created_at >= ?';
        queryParams.push(date_from);
    }
    
    if (date_to) {
        query += ' AND created_at <= ?';
        queryParams.push(date_to);
    }
    
    // Add ordering and pagination
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching claims:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json(results);
    });
});

// GET /api/claims/stats - Get claim statistics
app.get('/api/claims/stats', (req, res) => {
    const statsQuery = `
        SELECT 
            COUNT(*) as total_claims,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_claims,
            COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_claims,
            COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_claims,
            COUNT(CASE WHEN claim_type = 'ownership' THEN 1 END) as ownership_claims,
            COUNT(CASE WHEN claim_type = 'finder' THEN 1 END) as finder_claims,
            COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_claims,
            COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as week_claims,
            COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as month_claims
        FROM claims
    `;
    
    db.query(statsQuery, (err, results) => {
        if (err) {
            console.error('Error fetching claim statistics:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json(results[0]);
    });
});

// GET /api/claims/:id - Get a specific claim by ID
app.get('/api/claims/:id', (req, res) => {
    const claimId = req.params.id;
    const query = 'SELECT * FROM claims WHERE id = ?';
    
    db.query(query, [claimId], (err, results) => {
        if (err) {
            console.error('Error fetching claim:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Claim not found' });
        }
        
        res.json(results[0]);
    });
});

// GET /api/claims/claimant/:claimant_id - Get claims by claimant ID
app.get('/api/claims/claimant/:claimant_id', (req, res) => {
    const claimantId = req.params.claimant_id;
    const { status, claim_type, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM claims WHERE claimant_id = ?';
    let queryParams = [claimantId];
    
    if (status && ['pending', 'approved', 'rejected', 'resolved'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    if (claim_type && ['ownership', 'finder'].includes(claim_type)) {
        query += ' AND claim_type = ?';
        queryParams.push(claim_type);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    executeQueryWithRetry(query, queryParams)
        .then((results) => {
            res.json(results);
        })
        .catch((err) => {
            console.error('Error fetching claims by claimant:', err);
            return res.status(500).json({ error: 'Internal server error' });
        });
});

// GET /api/claims/item/:item_id - Get claims by item ID
app.get('/api/claims/item/:item_id', (req, res) => {
    const itemId = req.params.item_id;
    const { status, claim_type, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM claims WHERE item_id = ?';
    let queryParams = [itemId];
    
    if (status && ['pending', 'approved', 'rejected', 'resolved'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    if (claim_type && ['ownership', 'finder'].includes(claim_type)) {
        query += ' AND claim_type = ?';
        queryParams.push(claim_type);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching claims by item:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json(results);
    });
});

// GET /api/claims/match/:match_id - Get claims by match ID
app.get('/api/claims/match/:match_id', (req, res) => {
    const matchId = req.params.match_id;
    const { status, claim_type, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM claims WHERE match_id = ?';
    let queryParams = [matchId];
    
    if (status && ['pending', 'approved', 'rejected', 'resolved'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    if (claim_type && ['ownership', 'finder'].includes(claim_type)) {
        query += ' AND claim_type = ?';
        queryParams.push(claim_type);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching claims by match:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json(results);
    });
});

// POST /api/claims - Create a new claim
app.post('/api/claims', (req, res) => {
    const {
        id,
        item_id,
        match_id,
        claimant_id,
        claim_type = 'ownership',
        status = 'pending',
        proof_of_ownership,
        image,
        google_user_id
    } = req.body;
    
    // Validation
    if (!claimant_id) {
        return res.status(400).json({ error: 'claimant_id is required' });
    }
    
    if (!item_id && !match_id) {
        return res.status(400).json({ error: 'Either item_id or match_id is required' });
    }
    
    if (claim_type && !['ownership', 'finder'].includes(claim_type)) {
        return res.status(400).json({ error: 'claim_type must be either "ownership" or "finder"' });
    }
    
    if (status && !['pending', 'approved', 'rejected', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'status must be: pending, approved, rejected, or resolved' });
    }
    
    const claimId = id || require('crypto').randomUUID();
    
    const query = `
        INSERT INTO claims (
            id, item_id, match_id, claimant_id, claim_type, status, 
            proof_of_ownership, image, google_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        claimId, item_id, match_id, claimant_id, claim_type, status,
        proof_of_ownership, image, google_user_id
    ];
    
    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error creating claim:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Claim with this ID already exists' });
            }
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Create notification for claim submission
        try {
            console.log('Creating notification for new claim submission...');
            
            // Get item title for notification
            const getItemTitleQuery = `
                SELECT COALESCE(li.title, fi.title, 'Item') as item_title
                FROM claims c 
                LEFT JOIN matches m ON c.match_id = m.id
                LEFT JOIN items li ON m.lost_item_id = li.id OR c.item_id = li.id
                LEFT JOIN items fi ON m.found_item_id = fi.id OR c.item_id = fi.id
                WHERE c.id = ?
            `;
            
            db.query(getItemTitleQuery, [claimId], (err, itemResult) => {
                if (err) {
                    console.error('Error fetching item title for claim notification:', err);
                } else {
                    const itemTitle = (itemResult.length > 0 && itemResult[0].item_title) ? itemResult[0].item_title : 'Item';
                    
                    console.log('Creating notification for claimant:', claimant_id);
                    console.log('Item title:', itemTitle);
                    
                    // Create notification for claim submission
                    const savedNotification = {
                        id: `claimSubmitted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        type: 'claimRequest',
                        title: getNotificationTitle('pending'),
                        message: getNotificationMessage('pending', itemTitle),
                        data: JSON.stringify({ 
                            type: 'claimRequest', 
                            claimId: claimId,
                            status: 'pending'
                        }),
                        read: 0, // 0 = false in MySQL
                        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
                        userEmail: claimant_id // claimant_id is the email address
                    };
                    
                    console.log('Saving claim submission notification to database:', savedNotification);
                    
                    // Insert notification into database
                    const insertNotificationQuery = `
                        INSERT INTO notifications (id, type, title, message, data, \`read\`, created_at, user_email) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    db.query(insertNotificationQuery, [
                        savedNotification.id,
                        savedNotification.type,
                        savedNotification.title,
                        savedNotification.message,
                        savedNotification.data,
                        savedNotification.read,
                        savedNotification.createdAt,
                        savedNotification.userEmail
                    ], (err, notificationResult) => {
                        if (err) {
                            console.error('Error saving claim submission notification:', err);
                        } else {
                            console.log('✅ Claim submission notification saved to database for user:', claimant_id);
                        }
                    });
                }
            });
        } catch (notificationError) {
            console.error('❌ Error creating claim submission notification:', notificationError);
        }
        
        res.status(201).json({ 
            message: 'Claim created successfully', 
            claimId: claimId 
        });
    });
});

// PUT /api/claims/:id - Update a claim completely
app.put('/api/claims/:id', (req, res) => {
    const claimId = req.params.id;
    const {
        item_id,
        match_id,
        claimant_id,
        claim_type,
        status,
        proof_of_ownership,
        image,
        google_user_id
    } = req.body;
    
    // Validation
    if (!claimant_id) {
        return res.status(400).json({ error: 'claimant_id is required' });
    }
    
    if (claim_type && !['ownership', 'finder'].includes(claim_type)) {
        return res.status(400).json({ error: 'claim_type must be either "ownership" or "finder"' });
    }
    
    if (status && !['pending', 'approved', 'rejected', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'status must be: pending, approved, rejected, or resolved' });
    }
    
    const query = `
        UPDATE claims SET 
            item_id = COALESCE(?, item_id),
            match_id = COALESCE(?, match_id),
            claimant_id = ?,
            claim_type = COALESCE(?, claim_type),
            status = COALESCE(?, status),
            proof_of_ownership = COALESCE(?, proof_of_ownership),
            image = COALESCE(?, image),

            google_user_id = COALESCE(?, google_user_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    
    const values = [
        item_id, match_id, claimant_id, claim_type, status,
        proof_of_ownership, image, google_user_id, claimId
    ];
    
    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error updating claim:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Claim not found' });
        }
        
        res.json({ message: 'Claim updated successfully' });
    });
});

// PATCH /api/claims/:id/status - Update claim status only
app.patch('/api/claims/:id/status', async (req, res) => {
    const claimId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['pending', 'approved', 'rejected', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'status must be: pending, approved, rejected, or resolved' });
    }
    
    // First, get the full claim data including user info and item details
    const getClaimQuery = `
        SELECT c.*, m.lost_item_id, m.found_item_id, 
               li.title as lost_item_title, fi.title as found_item_title,
               u.email as user_email
        FROM claims c 
        LEFT JOIN matches m ON c.match_id = m.id
        LEFT JOIN items li ON m.lost_item_id = li.id
        LEFT JOIN items fi ON m.found_item_id = fi.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
    `;
    // First, get the claim data
    const getClaimDataQuery = 'SELECT * FROM claims WHERE id = ?';
    
    db.query(getClaimDataQuery, [claimId], async (err, claimResult) => {
        if (err) {
            console.error('Error fetching claim:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (claimResult.length === 0) {
            return res.status(404).json({ error: 'Claim not found' });
        }
        
        const claimData = claimResult[0];
        const matchId = claimData.match_id;
        
        console.log('=== CLAIM STATUS UPDATE DEBUG ===');
        console.log('Claim ID:', claimId);
        console.log('New Status:', status);
        console.log('Claim Data:', claimData);
        
        // Update the claim status
        const updateClaimQuery = 'UPDATE claims SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        
        db.query(updateClaimQuery, [status, claimId], async (err, result) => {
            if (err) {
                console.error('Error updating claim status:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Claim not found' });
            }
            
            // Map claim status to match status
            let matchStatus;
            switch (status) {
                case 'approved':
                    matchStatus = 'accepted';
                    break;
                case 'rejected':
                    matchStatus = 'rejected';
                    break;
                case 'resolved':
                    matchStatus = 'resolved';
                    break;
                case 'pending':
                default:
                    matchStatus = 'pending';
                    break;
            }
            
            // Update the related match status if match_id exists
            if (matchId) {
                const updateMatchQuery = 'UPDATE matches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
                
                db.query(updateMatchQuery, [matchStatus, matchId], (err, matchResult) => {
                    if (err) {
                        console.error('Error updating match status:', err);
                        // Don't fail the request if match update fails, just log the error
                        console.log('Claim status updated successfully, but match status update failed');
                    } else {
                        console.log(`Match ${matchId} status updated to ${matchStatus} due to claim ${claimId} status change to ${status}`);
                    }
                });
            }
            
            // Send notification for claim status update
            try {
                console.log('Sending claim status notification...');
                
                // Get user email and item title from claim data
                const getUserEmailQuery = `
                    SELECT c.claimant_id as user_email,
                           COALESCE(li.title, fi.title, 'Item') as item_title
                    FROM claims c 
                    LEFT JOIN matches m ON c.match_id = m.id
                    LEFT JOIN items li ON m.lost_item_id = li.id OR c.item_id = li.id
                    LEFT JOIN items fi ON m.found_item_id = fi.id OR c.item_id = fi.id
                    WHERE c.id = ?
                `;
                
                db.query(getUserEmailQuery, [claimId], (err, userResult) => {
                    if (err) {
                        console.error('Error fetching user email for claim notification:', err);
                    } else if (userResult.length > 0) {
                        const userEmail = userResult[0].user_email;
                        const itemTitle = userResult[0].item_title || 'Item';
                        
                        console.log('Found user email for notification:', userEmail);
                        console.log('Item title:', itemTitle);
                        
                        // Only proceed if we have a valid email
                        if (userEmail) {
                            // Since we can't import React Native notification service from server,
                            // we'll save the notification directly to the database for in-app display
                            const savedNotification = {
                                id: `claimStatus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                type: 'claimRequest',
                                title: getNotificationTitle(status),
                                message: getNotificationMessage(status, itemTitle),
                                data: JSON.stringify({ 
                                    type: 'claimRequest', 
                                    claimId: claimId,
                                    status: status
                                }),
                                read: 0, // 0 = false in MySQL
                                createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
                                userEmail: userEmail
                            };
                            
                            console.log('Saving notification to database:', savedNotification);
                            
                            // Insert notification into database with user_email
                            const insertNotificationQuery = `
                                INSERT INTO notifications (id, type, title, message, data, \`read\`, created_at, user_email) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            `;
                            
                            db.query(insertNotificationQuery, [
                                savedNotification.id,
                                savedNotification.type,
                                savedNotification.title,
                                savedNotification.message,
                                savedNotification.data,
                                savedNotification.read,
                                savedNotification.createdAt,
                                savedNotification.userEmail
                            ], (err, notificationResult) => {
                                if (err) {
                                    console.error('Error saving claim notification:', err);
                                } else {
                                    console.log('✅ Claim status notification saved to database with user email:', userEmail);
                                }
                            });
                        } else {
                            console.log('No valid email found for claim notification');
                        }
                    } else {
                        console.log('No user found for claim ID:', claimId);
                    }
                });
                
                console.log('✅ Claim status notification processing completed');
                
                res.json({ 
                    message: `Claim status updated to ${status} successfully`,
                    matchStatusUpdated: matchId ? true : false,
                    matchStatus: matchId ? matchStatus : null,
                    notificationSent: true
                });
                
            } catch (notificationError) {
                console.error('❌ Error sending claim status notification:', notificationError);
                
                // Don't fail the request if notification fails, just log the error
                res.json({ 
                    message: `Claim status updated to ${status} successfully`,
                    matchStatusUpdated: matchId ? true : false,
                    matchStatus: matchId ? matchStatus : null,
                    notificationSent: false,
                    notificationError: notificationError.message
                });
            }
        });
    });
});

// Helper functions for claim status notifications
function getNotificationTitle(status) {
    switch (status) {
        case 'approved':
            return 'Claim Request Approved';
        case 'rejected':
            return 'Claim Request Rejected';
        case 'resolved':
            return 'Claim Request Resolved';
        case 'pending':
            return 'Claim Request Received';
        default:
            return 'Claim Request Updated';
    }
}

function getNotificationMessage(status, itemTitle) {
    switch (status) {
        case 'approved':
            return `Your claim request for "${itemTitle}" has been approved! Please check your gmail account for more details from SCC admin, Thank you!!`;
        case 'rejected':
            return `Your claim request for "${itemTitle}" has been rejected. Sorry we did'nt accept you claim request for some reasons.`;
        case 'resolved':
            return `Your claim request for "${itemTitle}" has been resolved! The item has been returned to you. Thank you for using the Lost and Found system!`;
        case 'pending':
            return `Your claim request for "${itemTitle}" has been received and is pending review. Please wait for the approval, and the SSC support staff will email you. Thank you!!`;
        default:
            return `Your claim request for "${itemTitle}" has been updated. Please check your gmail account for more details from SCC support staff, Thank you!!`;
    }
}

// DELETE /api/claims/:id - Delete a claim
app.delete('/api/claims/:id', (req, res) => {
    const claimId = req.params.id;
    const query = 'DELETE FROM claims WHERE id = ?';
    
    db.query(query, [claimId], (err, result) => {
        if (err) {
            console.error('Error deleting claim:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Claim not found' });
        }
        
        res.json({ message: 'Claim deleted successfully' });
    });
});

// DELETE /api/claims - Delete multiple claims
app.delete('/api/claims', (req, res) => {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Please provide an array of claim IDs to delete' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM claims WHERE id IN (${placeholders})`;
    
    db.query(query, ids, (err, result) => {
        if (err) {
            console.error('Error deleting claims:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json({ 
            message: `${result.affectedRows} claim(s) deleted successfully`,
            deletedCount: result.affectedRows
        });
    });
});

// RESTful API Routes for Feedback

// GET /api/feedback - Get all feedback with optional filtering
app.get('/api/feedback', (req, res) => {
    const { 
        user_email, 
        type, 
        status, 
        rating,
        date_from,
        date_to,
        limit = 50, 
        offset = 0 
    } = req.query;
    
    let query = `SELECT * FROM feedback WHERE 1=1`;
    const queryParams = [];
    
    // Add filters
    if (user_email) {
        query += ' AND user_email = ?';
        queryParams.push(user_email);
    }
    
    if (type && ['suggestion', 'bug', 'rating'].includes(type)) {
        query += ' AND type = ?';
        queryParams.push(type);
    }
    
    if (status && ['pending', 'reviewed', 'addressed'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    if (rating && rating >= 1 && rating <= 5) {
        query += ' AND rating = ?';
        queryParams.push(parseInt(rating));
    }
    
    if (date_from) {
        query += ' AND created_at >= ?';
        queryParams.push(date_from);
    }
    
    if (date_to) {
        query += ' AND created_at <= ?';
        queryParams.push(date_to);
    }
    
    // Add ordering and pagination
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching feedback:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json({ data: results });
    });
});

// GET /api/feedback/stats - Get feedback statistics
app.get('/api/feedback/stats', (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as total_feedback,
            SUM(CASE WHEN type = 'suggestion' THEN 1 ELSE 0 END) as suggestions,
            SUM(CASE WHEN type = 'bug' THEN 1 ELSE 0 END) as bugs,
            SUM(CASE WHEN type = 'rating' THEN 1 ELSE 0 END) as ratings,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
            SUM(CASE WHEN status = 'addressed' THEN 1 ELSE 0 END) as addressed,
            AVG(CASE WHEN rating IS NOT NULL THEN rating END) as average_rating,
            COUNT(DISTINCT user_email) as unique_users
        FROM feedback
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching feedback stats:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json(results[0]);
    });
});

// GET /api/feedback/:id - Get a specific feedback by ID with responses
app.get('/api/feedback/:id', (req, res) => {
    const feedbackId = req.params.id;
    const feedbackQuery = 'SELECT * FROM feedback WHERE id = ?';
    
    db.query(feedbackQuery, [feedbackId], (err, feedbackResults) => {
        if (err) {
            console.error('Error fetching feedback:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (feedbackResults.length === 0) {
            return res.status(404).json({ error: 'Feedback not found' });
        }
        
        const feedback = feedbackResults[0];
        
        // Get responses for this feedback
        const responsesQuery = 'SELECT * FROM feedback_responses WHERE feedback_id = ? ORDER BY created_at ASC';
        
        db.query(responsesQuery, [feedbackId], (err, responsesResults) => {
            if (err) {
                console.error('Error fetching feedback responses:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            feedback.responses = responsesResults;
            res.json(feedback);
        });
    });
});

// GET /api/feedback/user/:email - Get feedback by user email with responses
app.get('/api/feedback/user/:email', (req, res) => {
    const userEmail = req.params.email;
    const { type, status, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM feedback WHERE user_email = ?';
    let queryParams = [userEmail];
    
    // Add optional filters
    if (type && ['suggestion', 'bug', 'rating'].includes(type)) {
        query += ' AND type = ?';
        queryParams.push(type);
    }
    
    if (status && ['pending', 'reviewed', 'addressed'].includes(status)) {
        query += ' AND status = ?';
        queryParams.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    db.query(query, queryParams, (err, feedbackResults) => {
        if (err) {
            console.error('Error fetching feedback by user:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (feedbackResults.length === 0) {
            return res.json({ data: [] });
        }
        
        // Get responses for each feedback
        const feedbackIds = feedbackResults.map(f => f.id);
        const placeholders = feedbackIds.map(() => '?').join(',');
        const responsesQuery = `SELECT * FROM feedback_responses WHERE feedback_id IN (${placeholders}) ORDER BY feedback_id, created_at ASC`;
        
        db.query(responsesQuery, feedbackIds, (err, responsesResults) => {
            if (err) {
                console.error('Error fetching feedback responses:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            // Group responses by feedback_id
            const responsesByFeedback = {};
            responsesResults.forEach(response => {
                if (!responsesByFeedback[response.feedback_id]) {
                    responsesByFeedback[response.feedback_id] = [];
                }
                responsesByFeedback[response.feedback_id].push(response);
            });
            
            // Add responses to each feedback
            feedbackResults.forEach(feedback => {
                feedback.responses = responsesByFeedback[feedback.id] || [];
            });
            
            res.json({ data: feedbackResults });
        });
    });
});

// POST /api/feedback - Create new feedback
app.post('/api/feedback', (req, res) => {
    const {
        id,
        user_email,
        type,
        rating,
        text,
        status,
        user_name,
        user_photo_url
    } = req.body;
    
    // Set default status to 'pending' if not provided or empty
    const finalStatus = (status && status.trim() !== '') ? status : 'pending';
    
    // Validate required fields
    if (!id || !user_email || !type || !text) {
        return res.status(400).json({ 
            error: 'Missing required fields: id, user_email, type, text' 
        });
    }
    
    // Validate enum values
    if (!['suggestion', 'bug', 'rating'].includes(type)) {
        return res.status(400).json({ error: 'Type must be one of: suggestion, bug, rating' });
    }
    
    if (!['pending', 'reviewed', 'addressed'].includes(finalStatus)) {
        return res.status(400).json({ error: 'Status must be one of: pending, reviewed, addressed' });
    }
    
    // Validate rating if provided
    if (rating !== null && rating !== undefined) {
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
        }
    }
    
    // For rating type, rating is required
    if (type === 'rating' && (rating === null || rating === undefined)) {
        return res.status(400).json({ error: 'Rating is required when type is "rating"' });
    }
    
    const query = `INSERT INTO feedback (
        id, user_email, type, rating, text, status, user_name, user_photo_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [
        id, user_email, type, rating, text, finalStatus, user_name, user_photo_url
    ];
    
    db.query(query, values, async (err, result) => {
        if (err) {
            console.error('Error creating feedback:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Feedback with this ID already exists' });
            }
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Trigger feedback notification for submission
        try {
            const feedbackData = {
                id,
                user_email,
                type,
                rating,
                text,
                status: finalStatus,
                subject: `${type.charAt(0).toUpperCase() + type.slice(1)} Feedback`
            };
            
            // Import and call notification function (dynamic import to avoid circular dependency)
            const { sendFeedbackNotification } = require('../services/notificationService');
            await sendFeedbackNotification(feedbackData, 'submitted');
        } catch (notificationError) {
            console.error('Error sending feedback notification:', notificationError);
            // Don't fail the request if notification fails
        }
        
        res.status(201).json({ 
            message: 'Feedback created successfully', 
            feedbackId: id 
        });
    });
});

// PUT /api/feedback/:id - Update feedback completely
app.put('/api/feedback/:id', (req, res) => {
    const feedbackId = req.params.id;
    const {
        user_email,
        type,
        rating,
        text,
        status,
        user_name,
        user_photo_url
    } = req.body;
    
    // Validate required fields
    if (!user_email || !type || !text) {
        return res.status(400).json({ 
            error: 'Missing required fields: user_email, type, text' 
        });
    }
    
    // Validate enum values
    if (!['suggestion', 'bug', 'rating'].includes(type)) {
        return res.status(400).json({ error: 'Type must be one of: suggestion, bug, rating' });
    }
    
    if (status && !['pending', 'reviewed', 'addressed'].includes(status)) {
        return res.status(400).json({ error: 'Status must be one of: pending, reviewed, addressed' });
    }
    
    // Validate rating if provided
    if (rating !== null && rating !== undefined) {
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
        }
    }
    
    const query = `UPDATE feedback SET 
        user_email = ?, type = ?, rating = ?, text = ?, status = ?, user_name = ?, 
        user_photo_url = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
    
    const values = [
        user_email, type, rating, text, status, user_name, user_photo_url,
        feedbackId
    ];
    
    db.query(query, values, async (err, result) => {
        if (err) {
            console.error('Error updating feedback:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Feedback not found' });
        }
        
        // Trigger feedback notification for status update
        try {
            const feedbackData = {
                id: feedbackId,
                user_email,
                type,
                rating,
                text,
                status,
                subject: `${type.charAt(0).toUpperCase() + type.slice(1)} Feedback`
            };
            
            // Determine notification action based on status
            let action = 'updated';
            if (status === 'reviewed') action = 'under_review';
            if (status === 'addressed') action = 'processed';
            
            // Import and call notification function
            const { sendFeedbackNotification } = require('../services/notificationService');
            await sendFeedbackNotification(feedbackData, action);
        } catch (notificationError) {
            console.error('Error sending feedback update notification:', notificationError);
            // Don't fail the request if notification fails
        }
        
        res.json({ message: 'Feedback updated successfully' });
    });
});

// PATCH /api/feedback/:id/status - Update feedback status only
app.patch('/api/feedback/:id/status', (req, res) => {
    const feedbackId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['pending', 'reviewed', 'addressed'].includes(status)) {
        return res.status(400).json({ error: 'Status must be one of: pending, reviewed, addressed' });
    }
    
    const query = 'UPDATE feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    db.query(query, [status, feedbackId], async (err, result) => {
        if (err) {
            console.error('Error updating feedback status:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Feedback not found' });
        }
        
        // Get feedback data for notification
        try {
            const feedbackQuery = 'SELECT * FROM feedback WHERE id = ?';
            db.query(feedbackQuery, [feedbackId], async (fetchErr, feedbackResults) => {
                if (!fetchErr && feedbackResults.length > 0) {
                    const feedbackData = feedbackResults[0];
                    
                    // Determine notification action based on status
                    let action = 'updated';
                    if (status === 'reviewed') action = 'under_review';
                    if (status === 'addressed') action = 'processed';
                    
                    // Import and call notification function
                    const { sendFeedbackNotification } = require('../services/notificationService');
                    await sendFeedbackNotification(feedbackData, action);
                }
            });
        } catch (notificationError) {
            console.error('Error sending feedback status notification:', notificationError);
            // Don't fail the request if notification fails
        }
        
        res.json({ 
            message: `Feedback status updated to ${status} successfully`
        });
    });
});

// DELETE /api/feedback/:id - Delete feedback
app.delete('/api/feedback/:id', (req, res) => {
    const feedbackId = req.params.id;
    const query = 'DELETE FROM feedback WHERE id = ?';
    
    db.query(query, [feedbackId], (err, result) => {
        if (err) {
            console.error('Error deleting feedback:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Feedback not found' });
        }
        
        res.json({ message: 'Feedback deleted successfully' });
    });
});

// DELETE /api/feedback - Delete multiple feedback entries
app.delete('/api/feedback', (req, res) => {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Please provide an array of feedback IDs to delete' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM feedback WHERE id IN (${placeholders})`;
    
    db.query(query, ids, (err, result) => {
        if (err) {
            console.error('Error deleting feedback entries:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json({ 
            message: `${result.affectedRows} feedback entry(ies) deleted successfully`,
            deletedCount: result.affectedRows
        });
    });
});

// RESTful API Routes for Feedback Responses

// GET /api/feedback/:feedbackId/responses - Get all responses for a specific feedback
app.get('/api/feedback/:feedbackId/responses', (req, res) => {
    const feedbackId = req.params.feedbackId;
    const { limit = 50, offset = 0 } = req.query;
    
    const query = `SELECT * FROM feedback_responses 
                   WHERE feedback_id = ? 
                   ORDER BY created_at ASC 
                   LIMIT ? OFFSET ?`;
    
    db.query(query, [feedbackId, parseInt(limit), parseInt(offset)], (err, results) => {
        if (err) {
            console.error('Error fetching feedback responses:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json({ data: results });
    });
});

// POST /api/feedback/:feedbackId/responses - Create a new response to feedback
app.post('/api/feedback/:feedbackId/responses', (req, res) => {
    const feedbackId = req.params.feedbackId;
    const {
        id,
        admin_email,
        admin_name,
        response_text
    } = req.body;
    
    // Validate required fields
    if (!id || !admin_email || !response_text) {
        return res.status(400).json({ 
            error: 'Missing required fields: id, admin_email, response_text' 
        });
    }
    
    // First check if the feedback exists
    const checkFeedbackQuery = 'SELECT id FROM feedback WHERE id = ?';
    
    db.query(checkFeedbackQuery, [feedbackId], (err, feedbackResults) => {
        if (err) {
            console.error('Error checking feedback existence:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (feedbackResults.length === 0) {
            return res.status(404).json({ error: 'Feedback not found' });
        }
        
        // Insert the response
        const insertQuery = `INSERT INTO feedback_responses (
            id, feedback_id, admin_email, admin_name, response_text
        ) VALUES (?, ?, ?, ?, ?)`;
        
        const values = [id, feedbackId, admin_email, admin_name, response_text];
        
        db.query(insertQuery, values, async (err, result) => {
            if (err) {
                console.error('Error creating feedback response:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Response with this ID already exists' });
                }
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            // Send push notification to the user who submitted the feedback
            try {
                // Get the original feedback data for the notification
                const feedbackQuery = 'SELECT * FROM feedback WHERE id = ?';
                db.query(feedbackQuery, [feedbackId], async (feedbackErr, feedbackResults) => {
                    if (feedbackErr) {
                        console.error('Error fetching feedback for notification:', feedbackErr);
                    } else if (feedbackResults.length > 0) {
                        const feedbackData = feedbackResults[0];
                        const responseData = {
                            id,
                            feedback_id: feedbackId,
                            admin_email,
                            admin_name,
                            response_text,
                            created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                        };
                        
                        try {
                            // Import notification service dynamically
                            const notificationService = await import('../services/notificationService.js');
                            console.log('Sending feedback response notification...');
                            await notificationService.sendFeedbackResponseNotification(feedbackData, responseData);
                            console.log('Feedback response notification sent successfully');
                        } catch (notificationError) {
                            console.error('Error sending feedback response notification:', notificationError);
                            console.error('Notification error stack:', notificationError.stack);
                            // Don't fail the response creation if notification fails
                        }
                    }
                });
            } catch (notificationError) {
                console.error('Error in notification process:', notificationError);
                // Don't fail the response creation if notification fails
            }
            
            res.status(201).json({ 
                message: 'Feedback response created successfully', 
                responseId: id 
            });
        });
    });
});

// GET /api/feedback-responses/:id - Get a specific feedback response by ID
app.get('/api/feedback-responses/:id', (req, res) => {
    const responseId = req.params.id;
    const query = 'SELECT * FROM feedback_responses WHERE id = ?';
    
    db.query(query, [responseId], (err, results) => {
        if (err) {
            console.error('Error fetching feedback response:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Feedback response not found' });
        }
        
        res.json(results[0]);
    });
});

// PUT /api/feedback-responses/:id - Update a feedback response
app.put('/api/feedback-responses/:id', (req, res) => {
    const responseId = req.params.id;
    const {
        admin_email,
        admin_name,
        response_text
    } = req.body;
    
    // Validate required fields
    if (!admin_email || !response_text) {
        return res.status(400).json({ 
            error: 'Missing required fields: admin_email, response_text' 
        });
    }
    
    const query = `UPDATE feedback_responses SET 
                   admin_email = ?, admin_name = ?, response_text = ?
                   WHERE id = ?`;
    
    const values = [admin_email, admin_name, response_text, responseId];
    
    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error updating feedback response:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Feedback response not found' });
        }
        
        res.json({ message: 'Feedback response updated successfully' });
    });
});

// DELETE /api/feedback-responses/:id - Delete a feedback response
app.delete('/api/feedback-responses/:id', (req, res) => {
    const responseId = req.params.id;
    const query = 'DELETE FROM feedback_responses WHERE id = ?';
    
    db.query(query, [responseId], (err, result) => {
        if (err) {
            console.error('Error deleting feedback response:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Feedback response not found' });
        }
        
        res.json({ message: 'Feedback response deleted successfully' });
    });
});

// ===== SUPPORT TICKET ENDPOINTS =====

// GET /api/support-tickets - Get all support tickets (with pagination and filtering)
app.get('/api/support-tickets', async (req, res) => {
    try {
        const { page = 1, limit = 20, status, category, priority, user_email } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                id, user_id, user_email, user_name, user_department,
                subject, description, category, priority, status,
                attachment_url, attachment_filename,
                assigned_to, assigned_by, resolved_at, resolved_by,
                last_response_at, response_count, created_at, updated_at
            FROM support_tickets
            WHERE 1=1
        `;
        const queryParams = [];
        
        if (status) {
            query += ' AND status = ?';
            queryParams.push(status);
        }
        if (category) {
            query += ' AND category = ?';
            queryParams.push(category);
        }
        if (priority) {
            query += ' AND priority = ?';
            queryParams.push(priority);
        }
        if (user_email) {
            query += ' AND user_email = ?';
            queryParams.push(user_email);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        queryParams.push(parseInt(limit), parseInt(offset));
        
        const tickets = await executeQueryWithRetry(query, queryParams);
        
        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM support_tickets WHERE 1=1';
        const countParams = [];
        
        if (status) {
            countQuery += ' AND status = ?';
            countParams.push(status);
        }
        if (category) {
            countQuery += ' AND category = ?';
            countParams.push(category);
        }
        if (priority) {
            countQuery += ' AND priority = ?';
            countParams.push(priority);
        }
        if (user_email) {
            countQuery += ' AND user_email = ?';
            countParams.push(user_email);
        }
        
        const countResult = await executeQueryWithRetry(countQuery, countParams);
        const total = countResult[0].total;
        
        res.json({
            tickets,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/support-tickets/:id - Get specific support ticket with responses
app.get('/api/support-tickets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get ticket details
        const ticketQuery = `
            SELECT 
                id, user_id, user_email, user_name, user_department,
                subject, description, category, priority, status,
                attachment_url, attachment_filename,
                assigned_to, assigned_by, resolved_at, resolved_by,
                last_response_at, response_count, created_at, updated_at
            FROM support_tickets 
            WHERE id = ?
        `;
        
        const tickets = await executeQueryWithRetry(ticketQuery, [id]);
        
        if (tickets.length === 0) {
            return res.status(404).json({ error: 'Support ticket not found' });
        }
        
        const ticket = tickets[0];
        
        // Get responses
        const responsesQuery = `
            SELECT 
                id, responder_email, responder_name, responder_type,
                message, attachment_url, attachment_filename,
                is_internal, created_at
            FROM support_ticket_responses 
            WHERE ticket_id = ?
            ORDER BY created_at ASC
        `;
        
        const responses = await executeQueryWithRetry(responsesQuery, [id]);
        
        res.json({
            ticket,
            responses
        });
    } catch (error) {
        console.error('Error fetching support ticket:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/support-tickets - Create new support ticket
app.post('/api/support-tickets', async (req, res) => {
    try {
        const {
            user_id = 'unknown',
            user_email,
            user_name,
            user_department,
            subject,
            description,
            category = 'other',
            priority = 'medium',
            attachment_url,
            attachment_filename
        } = req.body;
        
        // Validate required fields
        if (!user_email || !subject || !description) {
            return res.status(400).json({ 
                error: 'Missing required fields: user_email, subject, and description are required' 
            });
        }
        
        // Generate unique ticket ID
        const ticketId = `TICKET_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        const query = `
            INSERT INTO support_tickets (
                id, user_id, user_email, user_name, user_department,
                subject, description, category, priority, status,
                attachment_url, attachment_filename, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, NOW(), NOW())
        `;
        
        const values = [
            ticketId,
            user_id,
            user_email,
            user_name,
            user_department,
            subject,
            description,
            category,
            priority,
            attachment_url,
            attachment_filename
        ];
        
        await executeQueryWithRetry(query, values);
        
        // Return the created ticket
        const newTicket = await executeQueryWithRetry(
            'SELECT * FROM support_tickets WHERE id = ?',
            [ticketId]
        );
        
        // Trigger support ticket notification for creation
        try {
            const ticketData = newTicket[0];
            
            // Import and call notification function
            const { sendSupportTicketNotification } = require('../services/notificationService');
            await sendSupportTicketNotification(ticketData, 'created');
        } catch (notificationError) {
            console.error('Error sending support ticket creation notification:', notificationError);
            // Don't fail the request if notification fails
        }
        
        res.status(201).json({
            message: 'Support ticket created successfully',
            ticket: newTicket[0]
        });
    } catch (error) {
        console.error('Error creating support ticket:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/support-tickets/:id - Update support ticket
app.put('/api/support-tickets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            subject,
            description,
            category,
            priority,
            status,
            assigned_to,
            assigned_by,
            resolved_by,
            attachment_url,
            attachment_filename
        } = req.body;
        
        // Check if ticket exists
        const existingTicket = await executeQueryWithRetry(
            'SELECT * FROM support_tickets WHERE id = ?',
            [id]
        );
        
        if (existingTicket.length === 0) {
            return res.status(404).json({ error: 'Support ticket not found' });
        }
        
        // Build dynamic update query
        const updateFields = [];
        const updateValues = [];
        
        if (subject !== undefined) {
            updateFields.push('subject = ?');
            updateValues.push(subject);
        }
        if (description !== undefined) {
            updateFields.push('description = ?');
            updateValues.push(description);
        }
        if (category !== undefined) {
            updateFields.push('category = ?');
            updateValues.push(category);
        }
        if (priority !== undefined) {
            updateFields.push('priority = ?');
            updateValues.push(priority);
        }
        if (status !== undefined) {
            updateFields.push('status = ?');
            updateValues.push(status);
            
            // If status is resolved or closed, set resolved_at and resolved_by
            if ((status === 'resolved' || status === 'closed') && resolved_by) {
                updateFields.push('resolved_at = NOW()');
                updateFields.push('resolved_by = ?');
                updateValues.push(resolved_by);
            }
        }
        if (assigned_to !== undefined) {
            updateFields.push('assigned_to = ?');
            updateValues.push(assigned_to);
        }
        if (assigned_by !== undefined) {
            updateFields.push('assigned_by = ?');
            updateValues.push(assigned_by);
        }
        if (attachment_url !== undefined) {
            updateFields.push('attachment_url = ?');
            updateValues.push(attachment_url);
        }
        if (attachment_filename !== undefined) {
            updateFields.push('attachment_filename = ?');
            updateValues.push(attachment_filename);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updateFields.push('updated_at = NOW()');
        updateValues.push(id);
        
        const query = `UPDATE support_tickets SET ${updateFields.join(', ')} WHERE id = ?`;
        
        await executeQueryWithRetry(query, updateValues);
        
        // Return updated ticket
        const updatedTicket = await executeQueryWithRetry(
            'SELECT * FROM support_tickets WHERE id = ?',
            [id]
        );
        
        // Trigger support ticket notification for updates
        try {
            const ticketData = updatedTicket[0];
            const originalStatus = existingTicket[0].status;
            
            // Determine notification action based on status change
            let action = 'updated';
            if (status && status !== originalStatus) {
                if (status === 'resolved' || status === 'closed') {
                    action = 'resolved';
                } else {
                    action = 'updated';
                }
            }
            
            // Import and call notification function
            const { sendSupportTicketNotification } = require('../services/notificationService');
            await sendSupportTicketNotification(ticketData, action);
        } catch (notificationError) {
            console.error('Error sending support ticket update notification:', notificationError);
            // Don't fail the request if notification fails
        }
        
        res.json({
            message: 'Support ticket updated successfully',
            ticket: updatedTicket[0]
        });
    } catch (error) {
        console.error('Error updating support ticket:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/support-tickets/:id - Delete support ticket
app.delete('/api/support-tickets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // First delete all responses
        await executeQueryWithRetry(
            'DELETE FROM support_ticket_responses WHERE ticket_id = ?',
            [id]
        );
        
        // Then delete the ticket
        const result = await executeQueryWithRetry(
            'DELETE FROM support_tickets WHERE id = ?',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Support ticket not found' });
        }
        
        res.json({ message: 'Support ticket deleted successfully' });
    } catch (error) {
        console.error('Error deleting support ticket:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== SUPPORT TICKET RESPONSES ENDPOINTS =====

// GET /api/support-tickets/:ticketId/responses - Get responses for a ticket
app.get('/api/support-tickets/:ticketId/responses', async (req, res) => {
    try {
        const { ticketId } = req.params;
        
        // Check if ticket exists
        const ticket = await executeQueryWithRetry(
            'SELECT id FROM support_tickets WHERE id = ?',
            [ticketId]
        );
        
        if (ticket.length === 0) {
            return res.status(404).json({ error: 'Support ticket not found' });
        }
        
        const query = `
            SELECT 
                id, responder_email, responder_name, responder_type,
                message, attachment_url, attachment_filename,
                is_internal, created_at
            FROM support_ticket_responses 
            WHERE ticket_id = ?
            ORDER BY created_at ASC
        `;
        
        const responses = await executeQueryWithRetry(query, [ticketId]);
        
        res.json({ responses });
    } catch (error) {
        console.error('Error fetching ticket responses:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/support-tickets/:ticketId/responses - Add response to ticket
app.post('/api/support-tickets/:ticketId/responses', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const {
            responder_email,
            responder_name,
            responder_type = 'support_staff',
            message,
            attachment_url,
            attachment_filename,
            is_internal = false
        } = req.body;
        
        // Validate required fields
        if (!responder_email || !message) {
            return res.status(400).json({ 
                error: 'Missing required fields: responder_email and message are required' 
            });
        }
        
        // Check if ticket exists
        const ticket = await executeQueryWithRetry(
            'SELECT id FROM support_tickets WHERE id = ?',
            [ticketId]
        );
        
        if (ticket.length === 0) {
            return res.status(404).json({ error: 'Support ticket not found' });
        }
        
        // Generate unique response ID
        const responseId = `RESPONSE_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        const insertQuery = `
            INSERT INTO support_ticket_responses (
                id, ticket_id, responder_email, responder_name, responder_type,
                message, attachment_url, attachment_filename, is_internal, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        
        const insertValues = [
            responseId,
            ticketId,
            responder_email,
            responder_name,
            responder_type,
            message,
            attachment_url,
            attachment_filename,
            is_internal
        ];
        
        await executeQueryWithRetry(insertQuery, insertValues);
        
        // Update ticket's last_response_at and response_count
        const updateTicketQuery = `
            UPDATE support_tickets 
            SET 
                last_response_at = NOW(),
                response_count = response_count + 1,
                updated_at = NOW()
            WHERE id = ?
        `;
        
        await executeQueryWithRetry(updateTicketQuery, [ticketId]);
        
        // Return the created response
        const newResponse = await executeQueryWithRetry(
            'SELECT * FROM support_ticket_responses WHERE id = ?',
            [responseId]
        );
        
        // Trigger support ticket response notification
        try {
            // Get ticket data for notification
            const ticketData = await executeQueryWithRetry(
                'SELECT * FROM support_tickets WHERE id = ?',
                [ticketId]
            );
            
            if (ticketData.length > 0) {
                // Import and call notification function
                const { sendSupportTicketNotification } = require('../services/notificationService');
                await sendSupportTicketNotification(ticketData[0], 'response');
            }
        } catch (notificationError) {
            console.error('Error sending support ticket response notification:', notificationError);
            // Don't fail the request if notification fails
        }
        
        res.status(201).json({
            message: 'Response added successfully',
            response: newResponse[0]
        });
    } catch (error) {
        console.error('Error creating ticket response:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/support-ticket-responses/:id - Update response
app.put('/api/support-ticket-responses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            message,
            attachment_url,
            attachment_filename,
            is_internal
        } = req.body;
        
        // Check if response exists
        const existingResponse = await executeQueryWithRetry(
            'SELECT * FROM support_ticket_responses WHERE id = ?',
            [id]
        );
        
        if (existingResponse.length === 0) {
            return res.status(404).json({ error: 'Response not found' });
        }
        
        // Build dynamic update query
        const updateFields = [];
        const updateValues = [];
        
        if (message !== undefined) {
            updateFields.push('message = ?');
            updateValues.push(message);
        }
        if (attachment_url !== undefined) {
            updateFields.push('attachment_url = ?');
            updateValues.push(attachment_url);
        }
        if (attachment_filename !== undefined) {
            updateFields.push('attachment_filename = ?');
            updateValues.push(attachment_filename);
        }
        if (is_internal !== undefined) {
            updateFields.push('is_internal = ?');
            updateValues.push(is_internal);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        updateValues.push(id);
        
        const query = `UPDATE support_ticket_responses SET ${updateFields.join(', ')} WHERE id = ?`;
        
        await executeQueryWithRetry(query, updateValues);
        
        // Return updated response
        const updatedResponse = await executeQueryWithRetry(
            'SELECT * FROM support_ticket_responses WHERE id = ?',
            [id]
        );
        
        res.json({
            message: 'Response updated successfully',
            response: updatedResponse[0]
        });
    } catch (error) {
        console.error('Error updating response:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/support-ticket-responses/:id - Delete response
app.delete('/api/support-ticket-responses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get response details before deleting
        const response = await executeQueryWithRetry(
            'SELECT ticket_id FROM support_ticket_responses WHERE id = ?',
            [id]
        );
        
        if (response.length === 0) {
            return res.status(404).json({ error: 'Response not found' });
        }
        
        const ticketId = response[0].ticket_id;
        
        // Delete the response
        const deleteResult = await executeQueryWithRetry(
            'DELETE FROM support_ticket_responses WHERE id = ?',
            [id]
        );
        
        // Update ticket's response_count
        await executeQueryWithRetry(
            'UPDATE support_tickets SET response_count = response_count - 1, updated_at = NOW() WHERE id = ?',
            [ticketId]
        );
        
        res.json({ message: 'Response deleted successfully' });
    } catch (error) {
        console.error('Error deleting response:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== NOTIFICATION ENDPOINTS =====

// Get all notifications for a user
app.get('/api/notifications/user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { limit = 50, offset = 0, unread_only = false } = req.query;
        
        let query = `
            SELECT id, type, title, message, data, \`read\`, created_at, user_email
            FROM notifications 
            WHERE user_email = ?
        `;
        
        if (unread_only === 'true') {
            query += ' AND `read` = FALSE';
        }
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        
        const notifications = await executeQueryWithRetry(query, [email, parseInt(limit), parseInt(offset)]);
        
        // Parse JSON data field for each notification
        const processedNotifications = notifications.map(notification => ({
            ...notification,
            data: notification.data ? JSON.parse(notification.data) : null,
            read: Boolean(notification.read)
        }));
        
        res.json(processedNotifications);
    } catch (error) {
        console.error('Error fetching user notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get notification count for a user
app.get('/api/notifications/user/:email/count', async (req, res) => {
    try {
        const { email } = req.params;
        
        const [totalResult] = await executeQueryWithRetry(
            'SELECT COUNT(*) as total FROM notifications WHERE user_email = ?',
            [email]
        );
        
        const [unreadResult] = await executeQueryWithRetry(
            'SELECT COUNT(*) as unread FROM notifications WHERE user_email = ? AND `read` = FALSE',
            [email]
        );
        
        res.json({
            total: totalResult.total,
            unread: unreadResult.unread
        });
    } catch (error) {
        console.error('Error fetching notification count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        
        await executeQueryWithRetry(
            'UPDATE notifications SET `read` = TRUE WHERE id = ?',
            [id]
        );
        
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark all notifications as read for a user
app.patch('/api/notifications/user/:email/read-all', async (req, res) => {
    try {
        const { email } = req.params;
        
        const result = await executeQueryWithRetry(
            'UPDATE notifications SET `read` = TRUE WHERE user_email = ? AND `read` = FALSE',
            [email]
        );
        
        res.json({ 
            message: 'All notifications marked as read',
            updated: result.affectedRows
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a notification
app.delete('/api/notifications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        await executeQueryWithRetry(
            'DELETE FROM notifications WHERE id = ?',
            [id]
        );
        
        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete all notifications for a user
app.delete('/api/notifications/user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        const result = await executeQueryWithRetry(
            'DELETE FROM notifications WHERE user_email = ?',
            [email]
        );
        
        res.json({ 
            message: 'All notifications deleted successfully',
            deleted: result.affectedRows
        });
    } catch (error) {
        console.error('Error deleting all notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific notification
app.get('/api/notifications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const notifications = await executeQueryWithRetry(
            'SELECT id, type, title, message, data, `read`, created_at, user_email FROM notifications WHERE id = ?',
            [id]
        );
        
        if (notifications.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        const notification = notifications[0];
        notification.data = notification.data ? JSON.parse(notification.data) : null;
        notification.read = Boolean(notification.read);
        
        res.json(notification);
    } catch (error) {
        console.error('Error fetching notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test endpoint to create a notification manually
app.post('/api/test/notification', async (req, res) => {
    try {
        const { userEmail, title, message } = req.body;
        
        if (!userEmail || !title || !message) {
            return res.status(400).json({ error: 'Missing required fields: userEmail, title, message' });
        }
        
        const notificationId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const query = `
            INSERT INTO notifications (id, type, title, message, data, \`read\`, created_at, user_email)
            VALUES (?, 'test', ?, ?, '{}', false, NOW(), ?)
        `;
        
        await executeQueryWithRetry(query, [notificationId, title, message, userEmail]);
        
        res.status(201).json({ 
            message: 'Test notification created successfully',
            notificationId: notificationId
        });
    } catch (error) {
        console.error('Error creating test notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test database connection before starting server
async function testDatabaseConnection() {
    try {
        console.log('Testing database connection...');
        await executeQueryWithRetry('SELECT 1 as test');
        console.log('✅ Database connection successful');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Please check your MySQL server is running and credentials are correct');
        return false;
    }
}

// Start the server
app.listen(port, '0.0.0.0', async () => {
    console.log(`Server is running on http://localhost:${port}`);
    
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        console.log('⚠️  Server started but database is not accessible');
    }
    
    console.log('Available API endpoints:');
    console.log('\n--- ITEM ENDPOINTS ---');
    console.log('  GET    /api/items          - Get all items with filtering');
    console.log('  GET    /api/items/search   - Full-text search items');
    console.log('  GET    /api/items/:id      - Get item by ID');
    console.log('  GET    /api/items/reporter/:email - Get items by reporter');
    console.log('  POST   /api/items          - Create new item');
    console.log('  PUT    /api/items/:id      - Update item');
    console.log('  PATCH  /api/items/:id/status - Update item status');
    console.log('  DELETE /api/items/:id      - Delete item');
    console.log('  GET    /api/items/nearby   - Get nearby items');
    console.log('  GET    /api/items/categories - Get all categories');
    console.log('  GET    /api/items/stats    - Get item statistics');
    console.log('\n--- USER ENDPOINTS ---');
    console.log('  GET    /api/users          - Get all users');
    console.log('  GET    /api/users/:id      - Get user by ID');
    console.log('  POST   /api/users          - Create new user');
    console.log('  PUT    /api/users/:id      - Update user');
    console.log('  PATCH  /api/users/:id/login - Update last login');
    console.log('  PATCH  /api/users/:id/status - Update user status');
    console.log('  DELETE /api/users/:id      - Delete user');
    console.log('  GET    /api/users/search?q= - Search users');
    console.log('  GET    /api/users/:email/settings - Get user settings');
    console.log('  PUT    /api/users/:email/settings - Update user settings');
    console.log('\n--- MATCH ENDPOINTS ---');
    console.log('  GET    /api/matches        - Get all matches with filtering');
    console.log('  GET    /api/matches/:id    - Get match by ID');
    console.log('  GET    /api/matches/user/:email - Get matches by user email');
    console.log('  GET    /api/matches/stats  - Get match statistics');
    console.log('  POST   /api/matches        - Create new match');
    console.log('  PUT    /api/matches/:id    - Update match completely');
    console.log('  PATCH  /api/matches/:id/status - Update match status only');
    console.log('  DELETE /api/matches/:id    - Delete match');
    console.log('  DELETE /api/matches        - Delete multiple matches');
    console.log('\n--- CLAIM ENDPOINTS ---');
    console.log('  GET    /api/claims         - Get all claims with filtering');
    console.log('  GET    /api/claims/:id     - Get claim by ID');
    console.log('  GET    /api/claims/claimant/:claimant_id - Get claims by claimant');
    console.log('  GET    /api/claims/item/:item_id - Get claims by item');
    console.log('  GET    /api/claims/match/:match_id - Get claims by match');
    console.log('  GET    /api/claims/stats   - Get claim statistics');
    console.log('  POST   /api/claims         - Create new claim');
    console.log('  PUT    /api/claims/:id     - Update claim completely');
    console.log('  PATCH  /api/claims/:id/status - Update claim status only');
    console.log('  DELETE /api/claims/:id     - Delete claim');
    console.log('  DELETE /api/claims         - Delete multiple claims');
    console.log('\n--- FEEDBACK ENDPOINTS ---');
    console.log('  GET    /api/feedback       - Get all feedback with filtering');
    console.log('  GET    /api/feedback/stats - Get feedback statistics');
    console.log('  GET    /api/feedback/:id   - Get feedback by ID');
    console.log('  GET    /api/feedback/user/:email - Get feedback by user email');
    console.log('  POST   /api/feedback       - Create new feedback');
    console.log('  PUT    /api/feedback/:id   - Update feedback completely');
    console.log('  PATCH  /api/feedback/:id/status - Update feedback status only');
    console.log('  DELETE /api/feedback/:id   - Delete feedback');
    console.log('  DELETE /api/feedback       - Delete multiple feedback entries');
    console.log('\n--- FEEDBACK RESPONSE ENDPOINTS ---');
    console.log('  GET    /api/feedback/:feedbackId/responses - Get responses for feedback');
    console.log('  POST   /api/feedback/:feedbackId/responses - Create response to feedback');
    console.log('  GET    /api/feedback-responses/:id - Get feedback response by ID');
    console.log('  PUT    /api/feedback-responses/:id - Update feedback response');
    console.log('  DELETE /api/feedback-responses/:id - Delete feedback response');
    console.log('\n--- SUPPORT TICKET ENDPOINTS ---');
    console.log('  GET    /api/support-tickets - Get all support tickets (paginated)');
    console.log('  GET    /api/support-tickets/:id - Get specific ticket with responses');
    console.log('  POST   /api/support-tickets - Create new support ticket');
    console.log('  PUT    /api/support-tickets/:id - Update support ticket');
    console.log('  DELETE /api/support-tickets/:id - Delete support ticket');
    console.log('\n--- SUPPORT TICKET RESPONSE ENDPOINTS ---');
    console.log('  GET    /api/support-tickets/:ticketId/responses - Get responses for ticket');
    console.log('  POST   /api/support-tickets/:ticketId/responses - Add response to ticket');
    console.log('  PUT    /api/support-ticket-responses/:id - Update response');
    console.log('  DELETE /api/support-ticket-responses/:id - Delete response');
    console.log('\n--- NOTIFICATION ENDPOINTS ---');
    console.log('  GET    /api/notifications/user/:email - Get notifications for user');
    console.log('  GET    /api/notifications/user/:email/count - Get notification count');
    console.log('  GET    /api/notifications/:id - Get specific notification');
    console.log('  PATCH  /api/notifications/:id/read - Mark notification as read');
    console.log('  PATCH  /api/notifications/user/:email/read-all - Mark all as read');
    console.log('  DELETE /api/notifications/:id - Delete notification');
    console.log('  DELETE /api/notifications/user/:email - Delete all notifications');
    console.log('  POST   /api/test/notification - Create test notification');
});

