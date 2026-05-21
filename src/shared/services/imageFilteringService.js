// Image Filtering Service using Gemini API
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

// localViolationTracker removed - violation tracking handled elsewhere
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get API key from app.json extra config
const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey;

// Validate API key is configured
if (!GEMINI_API_KEY) {
  console.error('❌ Gemini API key is not configured in imageFilteringService!');
  console.error('Please add geminiApiKey to app.json extra section');
}

const MODEL_ID = 'gemini-2.5-flash-lite';
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Prepare image data for filtering API
 * @param {string} imageUrl - The image URL to prepare
 * @returns {Promise<Object>} Image data for filtering API
 */
const prepareImageForFiltering = async (imageUrl) => {
  console.log('=== PREPARING IMAGE FOR FILTERING ===');
  console.log('Image URL:', imageUrl);
  
  try {
    if (!imageUrl) {
      throw new Error('Invalid image URL provided');
    }
    
    // For data URIs, extract the data directly
    if (imageUrl.startsWith('data:')) {
      console.log('Processing data URI...');
      const [header, data] = imageUrl.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      console.log('Data URI MIME type:', mimeType);
      console.log('Data length:', data ? data.length : 0);
      
      return {
        "inlineData": {
          "mimeType": mimeType,
          "data": data
        }
      };
    }
    
    // For HTTP URLs, download and convert to base64 using expo-file-system
    if (imageUrl.startsWith('http')) {
      console.log('Processing HTTP URL...');
      const extension = imageUrl.split('?')[0].split('.').pop().toLowerCase();
      const mimeTypeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
      const mimeType = mimeTypeMap[extension] || 'image/jpeg';
      const localUri = FileSystem.cacheDirectory + `filter_${Date.now()}.${extension || 'jpg'}`;

      console.log('Downloading image to:', localUri);
      const downloadResult = await FileSystem.downloadAsync(imageUrl, localUri);
      if (downloadResult.status !== 200) {
        throw new Error(`Failed to download image: ${downloadResult.status}`);
      }

      const base64Data = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      console.log('Base64 data length:', base64Data ? base64Data.length : 0);

      await FileSystem.deleteAsync(localUri, { idempotent: true });

      return {
        "inlineData": {
          "mimeType": mimeType,
          "data": base64Data
        }
      };
    }
    
    // Reject file URIs - only accept HTTP URLs and data URIs
    if (imageUrl.startsWith('file:') || imageUrl.startsWith('content:')) {
      throw new Error('Local file URIs are not supported. Please upload images to the server first.');
    }
    
    throw new Error('Unsupported image URL format');
  } catch (error) {
    console.error('Error preparing image for filtering:', error);
    throw new Error(`Failed to prepare image for filtering: ${error.message}`);
  }
};

/**
 * Analyze image for inappropriate content using Gemini API
 * @param {string} imageUri - The image URI/URL to analyze
 * @returns {Promise<Object>} Analysis result with appropriateness status
 */
export const analyzeImageForContent = async (imageUri) => {
  const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log('=== CONTENT ANALYSIS DEBUG ===');
  console.log('Analysis ID:', analysisId);
  console.log('Analyzing image URI:', imageUri);
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    // Add cache-busting parameter to ensure fresh analysis
    const cacheBustingUrl = imageUri.includes('?') 
      ? `${imageUri}&_cb=${Date.now()}` 
      : `${imageUri}?_cb=${Date.now()}`;
    console.log('Cache-busting URL:', cacheBustingUrl);
    
    // Prepare image data for filtering API
    console.log('Preparing image data for analysis...');
    const imageData = await prepareImageForFiltering(cacheBustingUrl);
    console.log('Image data prepared successfully');

    const prompt = `Analyze this image for content appropriateness. Determine if the image is appropriate for a lost and found application.

APPROVED CONTENT:
- Physical objects ONLY (electronics, bags, jewelry, clothing items laid out, books, accessories, etc.)
- ID cards, driver's licenses, passports (small photo on document is acceptable)
- Official documents with embedded photos (the photo must be part of the document itself)

STRICTLY REJECT if image contains:
- People's faces (selfies, portraits, group photos)
- Full body shots of people
- People as the main subject
- People posing for photos
- Any person taking up significant portion of the image
- Explicit or sexual content
- Violence or weapons
- Hate symbols or offensive material
- Inappropriate body exposure
- Drug paraphernalia
- Any content that violates community standards
- PICTURES/PHOTOGRAPHS as items (personal photos, family photos, printed pictures, photo frames with photos)
- FOOD ITEMS (meals, snacks, fruits, vegetables, beverages, drinks, coffee, tea, sandwiches, pizza, burgers, cakes, desserts, candy, bottled drinks)
- PERISHABLE ITEMS (any food or drink that can spoil)
- ELECTRICAL SWITCHES (light switches, power switches, circuit breakers)
- DAMAGED CELLPHONES (severely damaged phones)
- CHESS PIECES (pawns, knights, bishops, rooks, queens, kings, chess sets)
- CANDLES (wax candles, tea lights, candle holders with candles)
- GLASS CUPS (drinking glasses, glassware)
- CUPS AND MUGS (coffee cups, tea cups, drinking cups, mugs)
- VEHICLES (motorcycles, motorbikes, bikes, bicycles, cars, automobiles, trucks, vans)
- BALLPENS (pens, writing pens, ballpoint pens)
- INK ERASERS (correction fluid, correction tape, erasers for ink)
- COMBS (hair combs, styling combs)
- HAIRCLIPS (hair clips, bobby pins, hair accessories, barrettes)
- MONEY AND COINS (cash, bills, banknotes, paper money, coins, loose change, currency)

IMPORTANT DISTINCTIONS:
- If a person is visible and is NOT just a small photo on an ID card/document, REJECT immediately
- If the item IS a photograph/picture itself (not just containing a small ID photo), REJECT as "picture_item"
- If the item IS food or beverage of any kind, REJECT as "food_item"
- Food containers are acceptable ONLY if they are EMPTY and being used as containers (like empty water bottles, lunch boxes)

Be VERY STRICT in your analysis. When in doubt, mark as inappropriate.

Respond in this exact JSON format:
{
  "isAppropriate": true/false,
  "reason": "Brief explanation of why it's appropriate or inappropriate",
  "contentType": "object/id_document/person_detected/picture_item/food_item/inappropriate/other",
  "confidence": 0.95
}`;

    const raw = JSON.stringify({
      "contents": [
        {
          "parts": [
            {
              "text": prompt
            },
            imageData
          ]
        }
      ]
    });

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: raw
    };

    console.log('Making API request to Gemini...');
    const response = await fetch(`${API_ENDPOINT}/${MODEL_ID}:generateContent`, requestOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error response:', errorText);
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Gemini API response:', JSON.stringify(result, null, 2));
    
    if (!result.candidates || result.candidates.length === 0) {
      console.error('No candidates in Gemini response');
      throw new Error('No analysis result from Gemini API');
    }

    const analysisText = result.candidates[0].content.parts[0].text;
    console.log('Raw analysis text:', analysisText);
    
    const parsedResult = parseContentAnalysis(analysisText);
    console.log('Parsed analysis result:', parsedResult);
    
    // Violation tracking removed - inappropriate content detection still works
    // but violations are no longer tracked locally
    
    return parsedResult;

  } catch (error) {
    console.error('Error analyzing image content:', error);
    console.error('Error stack:', error.stack);
    
    // Track violation for analysis failure (optional - may not want to penalize users for system errors)
     try {
       const userData = await AsyncStorage.getItem('user_data');
       const userEmail = userData ? JSON.parse(userData).email : null;
       
       if (userEmail) {
         // Note: We might not want to penalize users for system failures
         // This is commented out but can be enabled if needed
         // await addUserViolation(userEmail, 'analysis_failure', {
         //   imageUri: imageUri,
         //   reason: `Image analysis failed: ${error.message}`,
         //   timestamp: new Date().toISOString(),
         //   analysisId: analysisId
         // });
         console.log('Analysis failure occurred for user:', userEmail, 'but no violation recorded');
       }
     } catch (violationError) {
       console.error('Error in analysis failure tracking:', violationError);
     }
    
    // More conservative approach - reject image if analysis fails
    // This prevents inappropriate content from slipping through due to API failures
    return {
      isAppropriate: false,
      reason: `Image analysis failed: ${error.message}. Please try again or contact support if the issue persists.`,
      contentType: 'other',
      confidence: 0.0,
      error: error.message
    };
  }
};

/**
 * Parse the Gemini API response for content analysis
 * @param {string} rawText - Raw text response from Gemini
 * @returns {Object} Parsed analysis result
 */
const parseContentAnalysis = (rawText) => {
  console.log('=== PARSING CONTENT ANALYSIS ===');
  console.log('Raw text to parse:', rawText);
  
  try {
    // Try to extract JSON from the response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      console.log('Extracted JSON string:', jsonStr);
      
      try {
        const parsed = JSON.parse(jsonStr);
        console.log('Parsed JSON object:', parsed);
        
        // Validate required fields
        if (typeof parsed.isAppropriate === 'boolean' && 
            typeof parsed.reason === 'string' &&
            typeof parsed.contentType === 'string') {
          console.log('JSON validation passed');
          return {
            isAppropriate: parsed.isAppropriate,
            reason: parsed.reason,
            contentType: parsed.contentType,
            confidence: parsed.confidence || 0.8
          };
        } else {
          console.log('JSON validation failed - missing required fields');
        }
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
      }
    } else {
      console.log('No JSON found in response, using fallback parsing');
    }
    
    // Fallback parsing if JSON extraction fails
    const lowerText = rawText.toLowerCase();
    console.log('Using fallback keyword analysis on:', lowerText);
    
    // Check for pictures/photos as items
    const pictureKeywords = [
      'picture', 'photo', 'photograph', 'portrait', 'selfie', 
      'family photo', 'printed photo', 'photo frame', 'picture frame',
      'personal photo', 'snapshot', 'image print'
    ];
    
    const foundPictureKeywords = pictureKeywords.filter(keyword => 
      lowerText.includes(keyword)
    );
    
    if (foundPictureKeywords.length > 0) {
      console.log('Found picture/photo item keywords:', foundPictureKeywords);
      return {
        isAppropriate: false,
        reason: `Pictures/photographs are not allowed in Lost & Found system. Digital content and personal photos cannot be physically returned.`,
        contentType: 'picture_item',
        confidence: 0.85
      };
    }
    
    // Check for food items
    const foodKeywords = [
      'food', 'meal', 'snack', 'fruit', 'vegetable', 'pizza', 'sandwich',
      'burger', 'cake', 'dessert', 'candy', 'chocolate', 'beverage', 'drink',
      'coffee', 'tea', 'juice', 'soda', 'water bottle', 'lunch', 'dinner',
      'breakfast', 'apple', 'banana', 'orange', 'perishable', 'edible'
    ];
    
    const foundFoodKeywords = foodKeywords.filter(keyword => 
      lowerText.includes(keyword)
    );
    
    if (foundFoodKeywords.length > 0) {
      console.log('Found food item keywords:', foundFoodKeywords);
      return {
        isAppropriate: false,
        reason: `Food/beverage items are not allowed. Perishable items pose health and safety concerns.`,
        contentType: 'food_item',
        confidence: 0.85
      };
    }
    
    // Check for prohibited items (switches, damaged phones, chess pieces, candles, cups, vehicles, ballpens, ink erasers, combs, hairclips, money)
    const prohibitedKeywords = [
      'switch', 'light switch', 'power switch', 'circuit breaker', 'electrical switch',
      'cracked phone', 'broken phone', 'damaged phone', 'shattered screen', 'cracked screen',
      'chess piece', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king', 'chess set',
      'candle', 'wax candle', 'tea light', 'candle holder',
      'glass cup', 'drinking glass', 'glass tumbler', 'glassware',
      'cup', 'mug', 'coffee cup', 'tea cup', 'drinking cup',
      'motorcycle', 'motorbike', 'bike', 'bicycle', 'car', 'automobile', 'truck', 'van', 'vehicle',
      'ballpen', 'pen', 'ballpoint pen', 'writing pen',
      'ink eraser', 'correction fluid', 'correction tape', 'eraser for ink',
      'comb', 'hair comb', 'styling comb',
      'hairclip', 'hair clip', 'bobby pin', 'hair accessory', 'barrette',
      'money', 'cash', 'bill', 'banknote', 'paper money', 'coin', 'coins', 'loose change', 'currency', 'dollar', 'peso'
    ];
    
    const foundProhibitedKeywords = prohibitedKeywords.filter(keyword => 
      lowerText.includes(keyword)
    );
    
    if (foundProhibitedKeywords.length > 0) {
      console.log('Found prohibited item keywords:', foundProhibitedKeywords);
      return {
        isAppropriate: false,
        reason: `This type of item is not allowed in the Lost & Found system: ${foundProhibitedKeywords[0]}`,
        contentType: 'prohibited_item',
        confidence: 0.85
      };
    }
    
    // Check for explicit inappropriate content indicators (expanded list)
    const inappropriateKeywords = [
      'inappropriate', 'explicit', 'sexual', 'violence', 'weapon', 'gun', 'knife',
      'offensive', 'hate', 'drug', 'inappropriate body', 'nudity', 'naked',
      'pornographic', 'adult content', 'nsfw', 'disturbing', 'graphic',
      'violent', 'blood', 'gore', 'suicide', 'self-harm', 'abuse'
    ];
    
    const foundInappropriateKeywords = inappropriateKeywords.filter(keyword => 
      lowerText.includes(keyword)
    );
    
    if (foundInappropriateKeywords.length > 0) {
      console.log('Found inappropriate keywords:', foundInappropriateKeywords);
      return {
        isAppropriate: false,
        reason: `Image contains inappropriate content: ${foundInappropriateKeywords.join(', ')}`,
        contentType: 'inappropriate',
        confidence: 0.8
      };
    }
    
    // Check for appropriate content indicators
    const appropriateKeywords = [
      'object', 'item', 'id card', 'document', 'appropriate', 'safe',
      'electronics', 'bag', 'jewelry', 'clothing', 'book', 'phone',
      'wallet', 'keys', 'glasses', 'watch', 'laptop', 'tablet'
    ];
    
    const foundAppropriateKeywords = appropriateKeywords.filter(keyword => 
      lowerText.includes(keyword)
    );
    
    if (foundAppropriateKeywords.length > 0) {
      console.log('Found appropriate keywords:', foundAppropriateKeywords);
      return {
        isAppropriate: true,
        reason: `Image appears to contain appropriate content: ${foundAppropriateKeywords.join(', ')}`,
        contentType: 'object',
        confidence: 0.7
      };
    }
    
    // More conservative default - reject if uncertain
    console.log('No clear indicators found, defaulting to inappropriate for safety');
    return {
      isAppropriate: false,
      reason: 'Content analysis unclear, rejecting image for safety. Please try a clearer image of the item.',
      contentType: 'other',
      confidence: 0.3
    };
    
  } catch (error) {
    console.error('Error parsing content analysis:', error);
    console.error('Parse error stack:', error.stack);
    
    // Conservative approach - reject on parsing errors
    return {
      isAppropriate: false,
      reason: `Analysis parsing failed: ${error.message}. Please try again.`,
      contentType: 'other',
      confidence: 0.0,
      error: error.message
    };
  }
};

/**
 * Validate image before upload - checks file size and format
 * @param {string} imageUri - The image URI to validate
 * @returns {Object} Validation result
 */
export const validateImageFormat = (imageUri) => {
  try {
    if (!imageUri) {
      return {
        isValid: false,
        reason: 'Invalid image format. Please select a valid image file.'
      };
    }
    
    // Check if it's a data URI
    if (imageUri.startsWith('data:')) {
      // Check MIME type for data URIs
      const mimeMatch = imageUri.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : '';
      
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(mimeType)) {
        return {
          isValid: false,
          reason: 'Unsupported image format. Please use JPEG, PNG, or WebP.'
        };
      }
    } else {
      // For file URIs, validate file extension
      const fileExtension = imageUri.toLowerCase().split('.').pop();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
      
      if (!allowedExtensions.includes(fileExtension)) {
        return {
          isValid: false,
          reason: 'Unsupported image format. Please use JPEG, PNG, or WebP.'
        };
      }
    }
    
    return {
      isValid: true,
      reason: 'Image format is valid'
    };
    
  } catch (error) {
    return {
      isValid: false,
      reason: 'Error validating image format'
    };
  }
};

/**
 * Compare two images for similarity using Gemini AI
 * @param {string} imageUri1 - First image URI/URL
 * @param {string} imageUri2 - Second image URI/URL
 * @returns {Promise<Object>} Similarity score and analysis
 */
const compareImageSimilarity = async (imageUri1, imageUri2) => {
  console.log('=== COMPARING IMAGE SIMILARITY ===');
  
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured');
    }
    
    if (!imageUri1 || !imageUri2) {
      throw new Error('Both image URIs are required');
    }
    
    // Prepare both images
    const image1Data = await prepareImageForFiltering(imageUri1);
    const image2Data = await prepareImageForFiltering(imageUri2);
    
    const prompt = `Compare these 2 images. Are they the SAME object?

Score 0-100 based on:
- Visual match (colors, shape, size)
- Unique features (scratches, logos, patterns)
- Object type match

Respond ONLY in JSON:
{
  "similarityScore": <0-100>,
  "isSameObject": <true if >=60>,
  "confidence": "<high|medium|low>",
  "reasoning": "<why match/no match>",
  "matchingFeatures": ["<feature1>"],
  "differences": ["<diff1>"]
}`;

    const requestBody = {
      "contents": [{
        "parts": [
          { "text": prompt },
          image1Data,
          image2Data
        ]
      }],
      "generationConfig": {
        "temperature": 0.1,
        "topK": 10,
        "topP": 0.7,
        "maxOutputTokens": 200
      }
    };
    
    const url = `${API_ENDPOINT}/${MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;
    
    console.log('Sending comparison request to Gemini...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      throw new Error(`Gemini API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }
    
    const textContent = data.candidates[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      throw new Error('Invalid response structure from Gemini API');
    }
    
    console.log('Raw Gemini response:', textContent);
    
    // Parse JSON response with multiple fallback strategies
    let result;
    
    try {
      // Strategy 1: Try to parse the entire response as JSON
      result = JSON.parse(textContent);
    } catch (e) {
      // Strategy 2: Extract JSON from code blocks
      const codeBlockMatch = textContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        try {
          result = JSON.parse(codeBlockMatch[1]);
        } catch (e2) {
          // Strategy 3: Find first valid JSON object
          const jsonMatch = textContent.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            try {
              result = JSON.parse(jsonMatch[0]);
            } catch (e3) {
              // Strategy 4: Manual extraction
              result = extractJsonFromText(textContent);
            }
          } else {
            result = extractJsonFromText(textContent);
          }
        }
      } else {
        // Strategy 3: Find first valid JSON object
        const jsonMatch = textContent.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (e3) {
            result = extractJsonFromText(textContent);
          }
        } else {
          result = extractJsonFromText(textContent);
        }
      }
    }
    
    if (!result || typeof result !== 'object') {
      console.error('Failed to parse response, using default values');
      result = {
        similarityScore: 0,
        isSameObject: false,
        confidence: 'low',
        reasoning: 'Could not parse AI response',
        matchingFeatures: [],
        differences: []
      };
    }
    
    console.log('Image Similarity Result:', {
      score: result.similarityScore,
      isSame: result.isSameObject,
      confidence: result.confidence
    });
    
    return {
      success: true,
      similarityScore: result.similarityScore || 0,
      isSameObject: result.isSameObject || false,
      confidence: result.confidence || 'low',
      reasoning: result.reasoning || 'No reasoning provided',
      matchingFeatures: result.matchingFeatures || [],
      differences: result.differences || []
    };
    
  } catch (error) {
    console.error('Error comparing image similarity:', error);
    return {
      success: false,
      similarityScore: 0,
      isSameObject: false,
      confidence: 'low',
      reasoning: 'Failed to compare images',
      error: error.message
    };
  }
};

/**
 * Extract JSON data from text manually (fallback)
 */
const extractJsonFromText = (text) => {
  try {
    const result = {
      similarityScore: 0,
      isSameObject: false,
      confidence: 'low',
      reasoning: '',
      matchingFeatures: [],
      differences: []
    };
    
    // Extract similarity score
    const scoreMatch = text.match(/similarityScore["']?\s*:\s*(\d+)/i);
    if (scoreMatch) result.similarityScore = parseInt(scoreMatch[1]);
    
    // Extract isSameObject
    const sameMatch = text.match(/isSameObject["']?\s*:\s*(true|false)/i);
    if (sameMatch) result.isSameObject = sameMatch[1] === 'true';
    
    // Extract confidence
    const confMatch = text.match(/confidence["']?\s*:\s*["']?(high|medium|low)["']?/i);
    if (confMatch) result.confidence = confMatch[1].toLowerCase();
    
    // Extract reasoning
    const reasonMatch = text.match(/reasoning["']?\s*:\s*["']([^"']+)["']/i);
    if (reasonMatch) result.reasoning = reasonMatch[1];
    
    return result;
  } catch (e) {
    return null;
  }
};

export default {
  analyzeImageForContent,
  validateImageFormat,
  compareImageSimilarity
};