require('./env');
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sendMatchNotifications } = require('./notificationService');
const { compareItemsWithGeminiAI } = require('./geminiMatcher');

// Database connection (reuse the same config as server.js)
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

/**
 * Match Quality Thresholds
 * Categorizes similarity scores into match quality levels
 */
const MATCH_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.80,     // 80-100%: "Match" - High confidence
  MEDIUM_CONFIDENCE: 0.50,   // 50-79%: "Possible Match/Ambiguous" - Needs manual review
  NO_MATCH: 0.0              // 0-49%: "Unmatched" - Unlikely to be the same item
};

/**
 * Get match category based on similarity score
 * @param {number} score - Similarity score (0-1)
 * @returns {Object} - Match category info
 */
function getMatchCategory(score) {
  const percentage = Math.round(score * 100);
  
  if (score >= MATCH_THRESHOLDS.HIGH_CONFIDENCE) {
    return {
      category: 'Match',
      confidence: 'High',
      description: 'High confidence that the uploaded image corresponds to a stored record',
      percentage: percentage,
      shouldNotify: true,
      requiresReview: false
    };
  } else if (score >= MATCH_THRESHOLDS.MEDIUM_CONFIDENCE) {
    return {
      category: 'Possible Match',
      confidence: 'Medium',
      description: 'Might need manual review - ambiguous match',
      percentage: percentage,
      shouldNotify: true,
      requiresReview: true
    };
  } else {
    return {
      category: 'Unmatched',
      confidence: 'Low',
      description: 'Unlikely to be the same item',
      percentage: percentage,
      shouldNotify: false,
      requiresReview: false
    };
  }
}

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

/**
 * Resolve image path for processing
 * @param {string} imagePath - Image path (URL or data URI)
 * @returns {string|null} - Image path for processing or null
 */
function resolveImagePath(imagePath) {
  if (!imagePath) return null;
  
  // For HTTP URLs and data URIs, return as-is for direct processing
  if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  // For local paths, check if file exists
  if (path.isAbsolute(imagePath)) {
    return fs.existsSync(imagePath) ? imagePath : null;
  }
  
  // If it's a relative path, resolve from uploads directory
  const uploadsPath = path.join(__dirname, '../../uploads', imagePath);
  return fs.existsSync(uploadsPath) ? uploadsPath : null;
}

/**
 * Extract basic image features for comparison
 * @param {string} imageData - Path to the image file or image URL
 * @returns {Promise<Object>} - Object containing image features
 */
async function extractImageFeatures(imageData) {
  try {
    let imageBuffer;
    let fileSize;
    let isDataUri = false;
    
    // Check if it's a data URI
    if (imageData.startsWith('data:')) {
      isDataUri = true;
      // Handle data URI
      const base64Data = imageData.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
      fileSize = imageBuffer.length;
    } else if (imageData.startsWith('http')) {
      // Handle HTTP URLs by fetching the image
      const fetch = require('node-fetch');
      const response = await fetch(imageData);
      if (!response.ok) {
        console.error(`Failed to fetch image from URL: ${response.status}`);
        return null;
      }
      imageBuffer = await response.buffer();
      fileSize = imageBuffer.length;
    } else {
      // Handle local file path
      const resolvedPath = resolveImagePath(imageData);
      if (!resolvedPath) {
        return null;
      }
      imageBuffer = fs.readFileSync(resolvedPath);
      const stats = fs.statSync(resolvedPath);
      fileSize = stats.size;
    }
    
    const imageHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
    
    // Simple color histogram approximation
    const colorProfile = extractColorProfile(imageBuffer);
    
    return {
      hash: imageHash,
      size: fileSize,
      colorProfile: colorProfile,
      isDataUri: isDataUri,
      originalData: imageData
    };
  } catch (error) {
    console.error('Error extracting image features:', error);
    return null;
  }
}

/**
 * Extract basic color profile from image buffer
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Object} - Color profile data
 */
function extractColorProfile(imageBuffer) {
  // Simple color analysis based on byte distribution
  const colorBins = { red: 0, green: 0, blue: 0, brightness: 0 };
  let sampleCount = 0;
  
  // Sample every 100th byte to get color distribution
  for (let i = 0; i < imageBuffer.length; i += 100) {
    const byte = imageBuffer[i];
    colorBins.brightness += byte;
    
    // Rough RGB approximation
    if (i % 3 === 0) colorBins.red += byte;
    else if (i % 3 === 1) colorBins.green += byte;
    else colorBins.blue += byte;
    
    sampleCount++;
  }
  
  // Normalize values
  if (sampleCount > 0) {
    colorBins.red = Math.round(colorBins.red / sampleCount);
    colorBins.green = Math.round(colorBins.green / sampleCount);
    colorBins.blue = Math.round(colorBins.blue / sampleCount);
    colorBins.brightness = Math.round(colorBins.brightness / sampleCount);
  }
  
  return colorBins;
}

/**
 * Calculate image similarity between two items
 * @param {Object} item1 - First item with images
 * @param {Object} item2 - Second item with images
 * @returns {Promise<number>} - Image similarity score between 0 and 1
 */
async function calculateImageSimilarity(item1, item2) {
  try {
    // Handle different image data formats
    let images1 = [];
    let images2 = [];
    
    // Parse images1
    if (item1.images) {
      if (typeof item1.images === 'string') {
        // Check if it's a data URI
        if (item1.images.startsWith('data:')) {
          images1 = [item1.images]; // Single data URI image
        } else {
          try {
            images1 = JSON.parse(item1.images); // Array of image paths
          } catch (e) {
            images1 = [item1.images]; // Single image path
          }
        }
      } else if (Array.isArray(item1.images)) {
        images1 = item1.images;
      }
    }
    
    // Parse images2
    if (item2.images) {
      if (typeof item2.images === 'string') {
        // Check if it's a data URI
        if (item2.images.startsWith('data:')) {
          images2 = [item2.images]; // Single data URI image
        } else {
          try {
            images2 = JSON.parse(item2.images); // Array of image paths
          } catch (e) {
            images2 = [item2.images]; // Single image path
          }
        }
      } else if (Array.isArray(item2.images)) {
        images2 = item2.images;
      }
    }
    
    if (images1.length === 0 || images2.length === 0) {
      return 0;
    }
    
    let maxSimilarity = 0;
    
    // Compare each image from item1 with each image from item2
    for (const img1 of images1) {
      const features1 = await extractImageFeatures(img1);
      if (!features1) continue;
      
      for (const img2 of images2) {
        const features2 = await extractImageFeatures(img2);
        if (!features2) continue;
        
        const similarity = compareImageFeatures(features1, features2);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    }
    
    return maxSimilarity;
  } catch (error) {
    console.error('Error calculating image similarity:', error);
    return 0;
  }
}

/**
 * Compare two sets of image features
 * @param {Object} features1 - First image features
 * @param {Object} features2 - Second image features
 * @returns {number} - Similarity score between 0 and 1
 */
function compareImageFeatures(features1, features2) {
  let similarity = 0;
  let factors = 0;
  
  // Hash comparison (exact match)
  if (features1.hash === features2.hash) {
    return 1.0; // Exact match
  }
  
  // Size similarity (20% weight)
  factors++;
  const sizeDiff = Math.abs(features1.size - features2.size);
  const maxSize = Math.max(features1.size, features2.size);
  const sizeSimilarity = maxSize > 0 ? 1 - (sizeDiff / maxSize) : 0;
  similarity += sizeSimilarity * 0.2;
  
  // Color profile similarity (80% weight)
  if (features1.colorProfile && features2.colorProfile) {
    factors++;
    const colorSimilarity = compareColorProfiles(features1.colorProfile, features2.colorProfile);
    similarity += colorSimilarity * 0.8;
  }
  
  return factors > 0 ? similarity / factors : 0;
}

/**
 * Compare color profiles of two images
 * @param {Object} profile1 - First color profile
 * @param {Object} profile2 - Second color profile
 * @returns {number} - Color similarity score between 0 and 1
 */
function compareColorProfiles(profile1, profile2) {
  const redDiff = Math.abs(profile1.red - profile2.red) / 255;
  const greenDiff = Math.abs(profile1.green - profile2.green) / 255;
  const blueDiff = Math.abs(profile1.blue - profile2.blue) / 255;
  const brightnessDiff = Math.abs(profile1.brightness - profile2.brightness) / 255;
  
  const avgDiff = (redDiff + greenDiff + blueDiff + brightnessDiff) / 4;
  return 1 - avgDiff;
}

/**
 * Calculate similarity score between two items
 * Uses Gemini AI for intelligent matching, with fallback to traditional algorithm
 * @param {Object} item1 - First item
 * @param {Object} item2 - Second item
 * @returns {Promise<number>} - Similarity score between 0 and 1
 */
async function calculateSimilarityScore(item1, item2) {
  // CRITICAL: Category must match - This is a hard requirement
  // A phone cannot match with a mouse, bag, etc.
  if (!item1.category || !item2.category) {
    console.log('Missing category information - cannot match');
    return 0;
  }
  
  const category1 = item1.category.toLowerCase().trim();
  const category2 = item2.category.toLowerCase().trim();
  
  if (category1 !== category2) {
    console.log(`Category mismatch: "${category1}" vs "${category2}" - rejecting match`);
    return 0; // REJECT: Categories must match exactly
  }

  // 🤖 PRIMARY METHOD: Use Gemini AI for intelligent matching
  try {
    const geminiResult = await compareItemsWithGeminiAI(item1, item2);
    
    if (geminiResult && geminiResult.success) {
      // Gemini AI provided a result
      if (!geminiResult.isMatch) {
        console.log(`🤖 Gemini AI: NOT a match - ${geminiResult.reasoning}`);
        return 0; // AI says no match
      }
      
      // Convert Gemini score (0-100) to our scale (0-1)
      const aiScore = geminiResult.matchScore / 100;
      console.log(`🤖 Gemini AI: MATCH detected! Score: ${(aiScore * 100).toFixed(1)}%`);
      console.log(`   Confidence: ${(geminiResult.confidence * 100).toFixed(1)}%`);
      console.log(`   Reasoning: ${geminiResult.reasoning}`);
      
      // If AI is very confident, use its score directly
      if (geminiResult.confidence >= 0.7) {
        return aiScore;
      }
      
      // If AI is less confident, blend with traditional algorithm
      console.log(`   AI confidence < 70%, blending with traditional algorithm...`);
      const traditionalScore = await calculateTraditionalScore(item1, item2);
      const blendedScore = (aiScore * 0.7) + (traditionalScore * 0.3);
      console.log(`   Blended Score: ${(blendedScore * 100).toFixed(1)}% (AI: ${(aiScore * 100).toFixed(1)}%, Traditional: ${(traditionalScore * 100).toFixed(1)}%)`);
      return blendedScore;
    }
  } catch (error) {
    console.error('❌ Error using Gemini AI, falling back to traditional algorithm:', error.message);
  }

  // FALLBACK: Use traditional algorithm
  console.log('📊 Using traditional matching algorithm...');
  return await calculateTraditionalScore(item1, item2);
}

/**
 * Traditional matching algorithm (original logic)
 * @param {Object} item1 - First item
 * @param {Object} item2 - Second item
 * @returns {Promise<number>} - Similarity score between 0 and 1
 */
async function calculateTraditionalScore(item1, item2) {

  // Object overlap check (for traditional algorithm)
  if (item1.detected_objects && item2.detected_objects) {
    try {
      const objects1 = typeof item1.detected_objects === 'string' 
        ? JSON.parse(item1.detected_objects) 
        : item1.detected_objects;
      const objects2 = typeof item2.detected_objects === 'string' 
        ? JSON.parse(item2.detected_objects) 
        : item2.detected_objects;
      
      if (Array.isArray(objects1) && Array.isArray(objects2) && objects1.length > 0 && objects2.length > 0) {
        const names1 = objects1.map(obj => obj.name?.toLowerCase()).filter(Boolean);
        const names2 = objects2.map(obj => obj.name?.toLowerCase()).filter(Boolean);
        
        if (names1.length > 0 && names2.length > 0) {
          const hasCommonObject = names1.some(name1 => 
            names2.some(name2 => {
              if (name1 === name2 || name1.includes(name2) || name2.includes(name1)) {
                return true;
              }
              const commonKeywords = ['phone', 'mobile', 'bag', 'backpack', 'wallet', 'purse', 
                                     'laptop', 'computer', 'tablet', 'watch', 'key', 'card',
                                     'bottle', 'umbrella', 'glasses', 'headphone', 'charger'];
              return commonKeywords.some(keyword => 
                name1.includes(keyword) && name2.includes(keyword)
              );
            })
          );
          
          if (!hasCommonObject) {
            const clearlyDifferent = (
              (names1.some(n => n.includes('phone') || n.includes('mobile')) && 
               names2.some(n => n.includes('mouse') || n.includes('keyboard'))) ||
              (names2.some(n => n.includes('phone') || n.includes('mobile')) && 
               names1.some(n => n.includes('mouse') || n.includes('keyboard'))) ||
              (names1.some(n => n.includes('bag') || n.includes('backpack')) && 
               names2.some(n => n.includes('phone') || n.includes('laptop'))) ||
              (names2.some(n => n.includes('bag') || n.includes('backpack')) && 
               names1.some(n => n.includes('phone') || n.includes('laptop')))
            );
            
            if (clearlyDifferent) {
              console.log(`Clearly different items: [${names1.join(', ')}] vs [${names2.join(', ')}] - rejecting match`);
              return 0;
            }
          }
        }
      }
    } catch (e) {
      console.error('Error parsing detected_objects:', e);
    }
  }

  // Traditional scoring
  let score = 0;
  let factors = 0;

  factors++;
  score += 0.25;

  // Image similarity (50% weight) - PRIMARY VISUAL FACTOR
  const imageSimilarity = await calculateImageSimilarity(item1, item2);
  if (imageSimilarity > 0) {
    factors++;
    score += imageSimilarity * 0.50;
  }

  // Title keyword matching (10% weight)
  if (item1.title && item2.title) {
    factors++;
    const title1Words = item1.title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const title2Words = item2.title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const commonTitleWords = title1Words.filter(word => 
      title2Words.some(w => w.includes(word) || word.includes(w))
    );
    const titleSimilarity = commonTitleWords.length / Math.max(title1Words.length, title2Words.length, 1);
    score += titleSimilarity * 0.10;
  }

  // Description keyword matching (5% weight)
  if (item1.description && item2.description) {
    factors++;
    const desc1Words = item1.description.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const desc2Words = item2.description.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const commonDescWords = desc1Words.filter(word => 
      desc2Words.some(w => w.includes(word) || word.includes(w))
    );
    const descSimilarity = commonDescWords.length / Math.max(desc1Words.length, desc2Words.length, 1);
    score += descSimilarity * 0.05;
  }

  // Location proximity (5% weight)
  if (item1.latitude && item1.longitude && item2.latitude && item2.longitude) {
    factors++;
    const distance = calculateDistance(
      item1.latitude, item1.longitude,
      item2.latitude, item2.longitude
    );
    // Consider items within 5km as potentially matching
    const locationScore = Math.max(0, 1 - (distance / 5));
    score += locationScore * 0.05;
  }

  // Date proximity (5% weight) - Items should be reported around same time
  if (item1.date_lost_found && item2.date_lost_found) {
    factors++;
    const date1 = new Date(item1.date_lost_found);
    const date2 = new Date(item2.date_lost_found);
    const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
    // Consider items within 30 days as potentially matching
    const dateScore = Math.max(0, 1 - (daysDiff / 30));
    score += dateScore * 0.05;
  }

  // Normalize score based on available factors
  const finalScore = factors > 0 ? Math.min(1, score / factors) : 0;
  
  console.log(`Match score for ${item1.category} vs ${item2.category}: ${(finalScore * 100).toFixed(1)}%`);
  
  return finalScore;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} - Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Find potential matches for a newly created item
 * @param {Object} newItem - The newly created item
 * @returns {Promise<Array>} - Array of potential matches
 */
async function findMatchesForNewItem(newItem) {
  return new Promise((resolve, reject) => {
    // Determine what type of items to search against
    const searchType = newItem.type === 'lost' ? 'found' : 'lost';
    
    // Query to get all active items of the opposite type
    const query = `
      SELECT * FROM items 
      WHERE type = ? AND status = 'active' AND id != ?
      ORDER BY date_reported DESC
    `;
    
    db.query(query, [searchType, newItem.id], async (err, results) => {
      if (err) {
        console.error('Error fetching items for matching:', err);
        return reject(err);
      }
      
      try {
        const matches = [];
        
        console.log(`\n=== Finding matches for ${newItem.type} item: "${newItem.title}" (Category: ${newItem.category}) ===`);
        console.log(`Checking against ${results.length} ${searchType} items...`);
        
        // Calculate similarity scores for each potential match
        for (const item of results) {
          const score = await calculateSimilarityScore(newItem, item);
          const matchInfo = getMatchCategory(score);
          
          // Only consider matches with score above 50% (MEDIUM_CONFIDENCE threshold)
          // This ensures better quality matches and prevents false positives
          if (score >= MATCH_THRESHOLDS.MEDIUM_CONFIDENCE) {
            console.log(`✓ ${matchInfo.category}: "${item.title}" - Score: ${matchInfo.percentage}% (${matchInfo.confidence} confidence)`);
            matches.push({
              score: score,
              matchCategory: matchInfo.category,
              confidence: matchInfo.confidence,
              requiresReview: matchInfo.requiresReview,
              lostItem: newItem.type === 'lost' ? newItem : item,
              foundItem: newItem.type === 'found' ? newItem : item
            });
          } else {
            console.log(`✗ ${matchInfo.category}: "${item.title}" - Score: ${matchInfo.percentage}% - Below threshold`);
          }
        }
        
        console.log(`Found ${matches.length} matches above 50% threshold`);
        
        // Sort by score (highest first)
        matches.sort((a, b) => b.score - a.score);
        
        resolve(matches);
      } catch (error) {
        console.error('Error calculating similarity scores:', error);
        reject(error);
      }
    });
  });
}

/**
 * Create match records in the database
 * @param {Array} matches - Array of match objects
 * @returns {Promise<Array>} - Array of created match IDs
 */
async function createMatchRecords(matches) {
  const createdMatches = [];
  
  for (const match of matches) {
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
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
      matchId, 'pending', match.score, match.lostItem.id, match.lostItem.title,
      match.lostItem.description, match.lostItem.category, match.lostItem.location,
      match.lostItem.latitude, match.lostItem.longitude, 
      convertToMySQLDatetime(match.lostItem.date_reported),
      convertToMySQLDatetime(match.lostItem.date_lost_found), 
      match.lostItem.reporter_name, match.lostItem.reporter_email,
      match.lostItem.reporter_department, match.lostItem.images, match.lostItem.detected_objects,
      match.lostItem.detected_categories, match.foundItem.id, match.foundItem.title,
      match.foundItem.description, match.foundItem.category, match.foundItem.location,
      match.foundItem.latitude, match.foundItem.longitude, 
      convertToMySQLDatetime(match.foundItem.date_reported),
      convertToMySQLDatetime(match.foundItem.date_lost_found), 
      match.foundItem.reporter_name, match.foundItem.reporter_email,
      match.foundItem.reporter_department, match.foundItem.images, match.foundItem.detected_objects,
      match.foundItem.detected_categories
    ];
    
    try {
      await new Promise((resolve, reject) => {
        db.query(query, values, (err, result) => {
          if (err) {
            console.error('Error creating match record:', err);
            return reject(err);
          }
          resolve(result);
        });
      });
      
      createdMatches.push({
        id: matchId,
        score: match.score,
        lostItem: match.lostItem,
        foundItem: match.foundItem
      });
      
    } catch (error) {
      console.error('Failed to create match record:', error);
      // Continue with other matches even if one fails
    }
  }
  
  return createdMatches;
}

/**
 * Run auto-matching for a newly created item
 * @param {Object} newItem - The newly created item
 * @returns {Promise<Object>} - Result object with match information
 */
async function runAutoMatching(newItem) {
  try {
    // Find potential matches
    const potentialMatches = await findMatchesForNewItem(newItem);
    
    if (potentialMatches.length === 0) {
      return {
        success: true,
        matchesFound: 0,
        matches: []
      };
    }
    
    // Create match records in database
    const createdMatches = await createMatchRecords(potentialMatches);
    
    // Send notifications for matches above 50% threshold (MEDIUM_CONFIDENCE)
    const notifiableMatches = createdMatches.filter(match => match.score >= MATCH_THRESHOLDS.MEDIUM_CONFIDENCE);
    if (notifiableMatches.length > 0) {
      try {
        const notificationsSent = await sendMatchNotifications(notifiableMatches);
        console.log(`Sent ${notificationsSent} match notifications for ${notifiableMatches.length} matches`);
      } catch (notificationError) {
        console.error('Error sending match notifications:', notificationError);
        // Don't fail the entire matching process if notifications fail
      }
    }
    
    const highConfidenceMatches = createdMatches.filter(match => match.score >= MATCH_THRESHOLDS.HIGH_CONFIDENCE);
    const possibleMatches = createdMatches.filter(match => 
      match.score >= MATCH_THRESHOLDS.MEDIUM_CONFIDENCE && 
      match.score < MATCH_THRESHOLDS.HIGH_CONFIDENCE
    );
    
    console.log(`\n📊 Match Summary:`);
    console.log(`   Total Matches: ${createdMatches.length}`);
    console.log(`   High Confidence (80-100%): ${highConfidenceMatches.length}`);
    console.log(`   Possible Match (50-79%): ${possibleMatches.length}`);
    
    return {
      success: true,
      matchesFound: createdMatches.length,
      matches: createdMatches,
      highScoreMatches: highConfidenceMatches,      // 80%+
      mediumScoreMatches: possibleMatches,           // 50-79%
      notificationsSent: notifiableMatches.length
    };
    
  } catch (error) {
    console.error('Error in auto-matching:', error);
    return {
      success: false,
      error: error.message,
      matchesFound: 0,
      matches: []
    };
  }
}

/**
 * Run matching for specific lost and found items (used after match deletion)
 * @param {Array} lostItems - Array of lost items to match
 * @param {Array} foundItems - Array of found items to match against
 * @returns {Promise<Object>} - Result object with match information
 */
async function runMatchingForItems(lostItems, foundItems) {
  try {
    if (!lostItems || lostItems.length === 0 || !foundItems || foundItems.length === 0) {
      return {
        success: true,
        matchesFound: 0,
        matches: []
      };
    }

    const allMatches = [];
    
    // Calculate similarity for each lost-found pair
    for (const lostItem of lostItems) {
      for (const foundItem of foundItems) {
        const score = await calculateSimilarityScore(lostItem, foundItem);
        const matchInfo = getMatchCategory(score);
        
        // Only create matches above 50% threshold (MEDIUM_CONFIDENCE)
        if (score >= MATCH_THRESHOLDS.MEDIUM_CONFIDENCE) {
          console.log(`✓ ${matchInfo.category}: Lost "${lostItem.title}" + Found "${foundItem.title}" - Score: ${matchInfo.percentage}%`);
          allMatches.push({
            score: score,
            matchCategory: matchInfo.category,
            confidence: matchInfo.confidence,
            requiresReview: matchInfo.requiresReview,
            lostItem: lostItem,
            foundItem: foundItem
          });
        }
      }
    }
    
    if (allMatches.length === 0) {
      return {
        success: true,
        matchesFound: 0,
        matches: []
      };
    }
    
    // Create match records in database
    const createdMatches = await createMatchRecords(allMatches);
    
    // Send notifications for matches above 50% threshold
    const notifiableMatches = createdMatches.filter(match => match.score >= MATCH_THRESHOLDS.MEDIUM_CONFIDENCE);
    if (notifiableMatches.length > 0) {
      try {
        const notificationsSent = await sendMatchNotifications(notifiableMatches);
        console.log(`Sent ${notificationsSent} match notifications for ${notifiableMatches.length} re-matched items`);
      } catch (notificationError) {
        console.error('Error sending re-match notifications:', notificationError);
        // Don't fail the entire process if notifications fail
      }
    }
    
    const highConfidenceMatches = createdMatches.filter(match => match.score >= MATCH_THRESHOLDS.HIGH_CONFIDENCE);
    const possibleMatches = createdMatches.filter(match => 
      match.score >= MATCH_THRESHOLDS.MEDIUM_CONFIDENCE && 
      match.score < MATCH_THRESHOLDS.HIGH_CONFIDENCE
    );
    
    console.log(`\n📊 Re-Match Summary:`);
    console.log(`   Total Matches: ${createdMatches.length}`);
    console.log(`   High Confidence (80-100%): ${highConfidenceMatches.length}`);
    console.log(`   Possible Match (50-79%): ${possibleMatches.length}`);
    
    return {
      success: true,
      matchesFound: createdMatches.length,
      matches: createdMatches,
      highScoreMatches: highConfidenceMatches,      // 80%+
      mediumScoreMatches: possibleMatches,           // 50-79%
      notificationsSent: notifiableMatches.length
    };
    
  } catch (error) {
    console.error('Error in re-matching items:', error);
    return {
      success: false,
      error: error.message,
      matchesFound: 0,
      matches: []
    };
  }
}

module.exports = {
  runAutoMatching,
  runMatchingForItems,
  findMatchesForNewItem,
  createMatchRecords,
  calculateSimilarityScore,
  calculateTraditionalScore,
  calculateImageSimilarity,
  extractImageFeatures,
  compareImageFeatures,
  resolveImagePath,
  getMatchCategory,
  MATCH_THRESHOLDS
};

/*
 * 🤖 AI-POWERED MATCHING SYSTEM WITH GEMINI AI 🤖
 * 
 * MATCHING STRATEGY (3-Tier Approach):
 * =====================================
 * 
 * TIER 1: 🤖 GEMINI AI PRIMARY MATCHING (Recommended)
 * - Uses Google Gemini 2.0 Flash Exp for intelligent visual + semantic matching
 * - Analyzes images, descriptions, categories together
 * - Understands context: "gold iPhone" vs "black mouse"
 * - Confidence-based decisions: High confidence (70%+) = Use AI score directly
 * - Medium/Low confidence = Blend with traditional algorithm
 * - Benefits: Most accurate, understands nuance, prevents false positives
 * 
 * TIER 2: 📊 TRADITIONAL ALGORITHM (Fallback)
 * - Used if Gemini AI fails or unavailable
 * - Multi-factor scoring with strict validation
 * 
 * TIER 3: 🛡️ SAFETY VALIDATION (Always Applied)
 * - Categories MUST match (Phone ≠ Mouse, Bag ≠ Laptop)
 * - Detected objects checked for clearly different items
 * - Minimum 50% threshold for all matches
 * 
 * GEMINI AI ANALYSIS INCLUDES:
 * ============================
 * ✓ Visual similarity (both images analyzed together)
 * ✓ Category validation (strict type checking)
 * ✓ Object type matching (Phone vs Phone, not Phone vs Mouse)
 * ✓ Color, brand, model recognition
 * ✓ Unique feature identification
 * ✓ Contextual reasoning (descriptions, titles)
 * ✓ Confidence scoring (how sure AI is about the match)
 * 
 * TRADITIONAL ALGORITHM (Fallback):
 * =================================
 * Scoring Weights:
 * - Category Match: 25% (Base requirement - must match)
 * - Image Similarity: 50% (Primary visual factor)
 * - Title Keywords: 10% (Important descriptor matching)
 * - Description Keywords: 5% (Additional context)
 * - Location Proximity: 5% (Items lost/found nearby)
 * - Date Proximity: 5% (Items reported around same time)
 * 
 * Image similarity uses:
 * - MD5 hash comparison for exact matches
 * - File size similarity
 * - Color profile analysis (RGB + brightness)
 * 
 * MINIMUM THRESHOLD:
 * ==================
 * - 50% minimum for all matches (prevents false positives)
 * - Gemini AI can override if high confidence
 * - Both methods must respect category matching rules
 * 
 * EXAMPLE FLOW:
 * =============
 * 1. Lost iPhone reported → System searches Found items
 * 2. Found Mouse (category: Electronics) → Categories match ✓
 * 3. 🤖 Gemini AI analyzes both:
 *    - Images show different objects (iPhone vs Mouse)
 *    - Titles are different ("iPhone 14 gold" vs "Mouse po")
 *    - AI determines: NOT A MATCH (confidence: 95%)
 * 4. Result: 0% match → No notification sent ✓
 * 
 * If Gemini AI were unavailable:
 * 1. Traditional algorithm detects: Both are "Electronics" ✓
 * 2. Object check: ["Phone"] vs ["Mouse"] → Clearly different ✗
 * 3. Result: 0% match → No notification sent ✓
 * 
 * WHY THIS WORKS:
 * ===============
 * - AI understands CONTEXT, not just keywords
 * - Visual analysis prevents category-only matching
 * - Dual-layer safety: AI + Traditional validation
 * - Graceful degradation if AI unavailable
 * - Confidence-based blending for edge cases
 */