// Google Gemini 2.5 Flash Lite API Configuration
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

// Get API key from app.json extra config
const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey;

// Validate API key is configured
if (!GEMINI_API_KEY) {
  console.error('❌ Gemini API key is not configured!');
  console.error('Please add geminiApiKey to app.json extra section');
}

const MODEL_ID = 'gemini-2.5-flash-lite';
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Helper function to validate image URL
const validateImageUrl = (imageUrl) => {
  return imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:') || imageUrl.startsWith('file:') || imageUrl.startsWith('content:'));
};

/**
 * Prepare image data for Gemini API
 * @param {string} imageUrl - The image URL to prepare
 * @returns {Promise<Object>} Image data for Gemini API
 */
const prepareImageForGemini = async (imageUrl) => {
  try {
    if (!validateImageUrl(imageUrl)) {
      throw new Error('Invalid image URL provided');
    }
    
    // For data URIs, extract the base64 data directly
    if (imageUrl.startsWith('data:')) {
      const [header, data] = imageUrl.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      return {
        "inlineData": {
          "mimeType": mimeType,
          "data": data
        }
      };
    }
    
    // For HTTP URLs, fetch and convert to base64
    if (imageUrl.startsWith('http')) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      const mimeType = blob.type || 'image/jpeg';
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64Data = reader.result.split(',')[1];
          resolve({
            "inlineData": {
              "mimeType": mimeType,
              "data": base64Data
            }
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    
    // For file URIs (mobile platforms), convert to base64
     if (imageUrl.startsWith('file:') || imageUrl.startsWith('content:')) {
       if (Platform.OS === 'ios' || Platform.OS === 'android') {
         const base64Data = await FileSystem.readAsStringAsync(imageUrl, {
           encoding: FileSystem.EncodingType.Base64,
         });
         
         return {
           "inlineData": {
             "mimeType": "image/jpeg",
             "data": base64Data
           }
         };
       }
     }
    
    throw new Error('Unsupported image URL format');
  } catch (error) {
    throw new Error(`Failed to prepare image for Gemini: ${error.message}`);
  }
};

/**
 * Analyze image using Gemini 2.5 Flash Lite API
 * @param {string} imageUri - The image URI/URL to analyze
 * @returns {Promise<Object>} Analysis result with structured description
 */
export const analyzeImageWithGemini = async (imageUri) => {
  try {
    // Prepare image data for Gemini API
    const imageData = await prepareImageForGemini(imageUri);

    const raw = JSON.stringify({
      "contents": [
        {
          "parts": [
            {
              "text": "Analyze this image and provide a detailed response in the following JSON format:\n{\n  \"description\": \"A natural language description of the item\",\n  \"objects\": [\n    {\"name\": \"object_name\", \"confidence\": 0.95}\n  ],\n  \"categories\": [\"category1\", \"category2\"]\n}\n\nDescribe what you see in this image, identify the main objects with confidence scores, and categorize the item."
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

    const response = await fetch(
      `${API_ENDPOINT}/${MODEL_ID}:generateContent`,
      requestOptions
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`API error: ${result.error.message || 'Unknown error'}`);
    }

    // Extract the generated text from Gemini response
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse the structured response from Gemini
    const parsedData = parseGeminiResponse(generatedText);

    // Always assign the most specific category possible
    let categories = parsedData.categories;
    // If only generic or 'Other' category, fallback to most specific detected object
    const genericCategories = ['Other', 'Electronics', 'Accessories', 'Stationery', 'Clothing', 'Personal items'];
    const hasOnlyGeneric = categories.length === 0 || categories.every(cat => genericCategories.includes(cat));
    if (hasOnlyGeneric && parsedData.objects && parsedData.objects.length > 0) {
      // Use the most confident object as category
      const sortedObjects = parsedData.objects.slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      categories = [sortedObjects[0].name];
    }

    // Normalize category names to ensure consistent matching
    categories = categories.map(cat => normalizeCategoryName(cat));

    return {
      success: true,
      description: parsedData.description,
      objects: parsedData.objects,
      categories,
      rawResponse: generatedText
    };

  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    
    // Fallback response
    return {
      success: false,
      description: "Unable to analyze the image. Please try again.",
      objects: [],
      categories: ['Other'],
      error: error.message
    };
  }
};

/**
 * Parse structured response from Gemini API
 * @param {string} rawText - Raw text from Gemini API
 * @returns {Object} Parsed data with description, objects, and categories
 */
const parseGeminiResponse = (rawText) => {
  if (!rawText) {
    return {
      description: "Unable to analyze the image. Please try again.",
      objects: [],
      categories: ['Other']
    };
  }

  try {
    // Try to extract JSON from the response
    let jsonMatch = rawText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    
    if (jsonMatch) {
      // Clean up the JSON string before parsing
      let jsonStr = jsonMatch[0]
        .replace(/\r?\n/g, ' ')  // Remove newlines
        .replace(/\s+/g, ' ')     // Normalize whitespace
        .trim();
      
      const jsonData = JSON.parse(jsonStr);
      
      return {
        description: jsonData.description || rawText.trim(),
        objects: jsonData.objects || [],
        categories: jsonData.categories || ['Other']
      };
    }
  } catch (error) {
    console.log('Failed to parse JSON from Gemini response, using fallback parsing:', error.message);
  }

  // Fallback: extract information from natural language response
  const description = rawText.trim();
  const objects = extractObjectsFromText(description);
  const categories = extractCategoriesFromText(description);

  return {
    description,
    objects,
    categories
  };
};

/**
 * Extract objects from natural language text
 * @param {string} text - Description text
 * @returns {Array} Array of objects with name and confidence
 */
const extractObjectsFromText = (text) => {
  const commonObjects = [
    'phone', 'wallet', 'keys', 'bag', 'backpack', 'book', 'notebook',
    'pen', 'pencil', 'glasses', 'sunglasses', 'watch', 'jewelry',
    'headphones', 'earphones', 'charger', 'cable', 'laptop', 'tablet',
    'bottle', 'umbrella', 'hat', 'cap', 'jacket', 'shirt', 'shoes'
  ];

  const foundObjects = [];
  const lowerText = text.toLowerCase();

  commonObjects.forEach(obj => {
    if (lowerText.includes(obj)) {
      foundObjects.push({
        name: obj.charAt(0).toUpperCase() + obj.slice(1),
        confidence: 0.8
      });
    }
  });

  return foundObjects.slice(0, 5); // Limit to 5 objects
};

/**
 * Extract categories from natural language text
 * @param {string} text - Description text
 * @returns {Array} Array of category strings
 */
const extractCategoriesFromText = (text) => {
  const categoryMap = {
    'electronics': ['phone', 'laptop', 'tablet', 'charger', 'headphones', 'earphones'],
    'accessories': ['wallet', 'bag', 'backpack', 'glasses', 'sunglasses', 'watch', 'jewelry'],
    'stationery': ['book', 'notebook', 'pen', 'pencil'],
    'clothing': ['jacket', 'shirt', 'hat', 'cap', 'shoes'],
    'personal items': ['keys', 'umbrella', 'bottle']
  };

  const lowerText = text.toLowerCase();
  const categories = [];

  Object.entries(categoryMap).forEach(([category, keywords]) => {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      categories.push(category.charAt(0).toUpperCase() + category.slice(1));
    }
  });

  return categories.length > 0 ? categories : ['Other'];
};

/**
 * Use Gemini AI to determine if two items are a potential match
 * @param {Object} item1 - First item with title, description, and images
 * @param {Object} item2 - Second item with title, description, and images
 * @returns {Promise<Object>} Match analysis result
 */
export const compareItemsWithGemini = async (item1, item2) => {
  console.log('🤖 compareItemsWithGemini called');
  console.log('Item1:', JSON.stringify(item1, null, 2));
  console.log('Item2:', JSON.stringify(item2, null, 2));
  
  try {
    // Prepare images for both items
    let image1Data = null;
    let image2Data = null;
    
    // Get first image from each item
    if (item1.images && item1.images.length > 0) {
      const imageUri = Array.isArray(item1.images) ? item1.images[0] : item1.images;
      console.log('📸 Item1 image URI:', imageUri?.substring(0, 100));
      if (validateImageUrl(imageUri)) {
        console.log('✅ Item1 image URL is valid, preparing...');
        image1Data = await prepareImageForGemini(imageUri);
        console.log('✅ Item1 image prepared');
      } else {
        console.log('❌ Item1 image URL is invalid');
      }
    } else {
      console.log('❌ Item1 has no images');
    }
    
    if (item2.images && item2.images.length > 0) {
      const imageUri = Array.isArray(item2.images) ? item2.images[0] : item2.images;
      console.log('📸 Item2 image URI:', imageUri?.substring(0, 100));
      if (validateImageUrl(imageUri)) {
        console.log('✅ Item2 image URL is valid, preparing...');
        image2Data = await prepareImageForGemini(imageUri);
        console.log('✅ Item2 image prepared');
      } else {
        console.log('❌ Item2 image URL is invalid');
      }
    } else {
      console.log('❌ Item2 has no images');
    }

    console.log('🔧 Building API request...');
    
    // Build the prompt parts
    const parts = [
      {
        "text": `You are an expert at matching lost and found items. Compare these two items and determine if they could be the same item.

LOST ITEM:
Title: ${item1.title || 'N/A'}
Description: ${item1.description || 'N/A'}
Category: ${item1.category || 'N/A'}

FOUND ITEM:
Title: ${item2.title || 'N/A'}
Description: ${item2.description || 'N/A'}
Category: ${item2.category || 'N/A'}

Analyze the images (if provided) and text descriptions. Respond in JSON format:
{
  "isMatch": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why they match or don't match",
  "matchScore": 0-100,
  "keyFactors": ["factor1", "factor2"]
}

Consider:
- Visual similarity of items (color, size, shape, features)
- Item type and category
- Brand, model, or identifying marks
- Texture and material
- Unique features mentioned in descriptions

Score 70-100% for likely matches, 50-69% for possible matches, below 50% for unlikely matches.`
      }
    ];

    // Add images if available
    if (image1Data) {
      parts.push({"text": "LOST ITEM IMAGE:"});
      parts.push(image1Data);
    }
    
    if (image2Data) {
      parts.push({"text": "FOUND ITEM IMAGE:"});
      parts.push(image2Data);
    }

    const raw = JSON.stringify({
      "contents": [{
        "parts": parts
      }]
    });

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: raw
    };

    console.log('📡 Sending request to Gemini API...');
    console.log('API Endpoint:', `${API_ENDPOINT}/${MODEL_ID}:generateContent`);
    console.log('Has API Key:', !!GEMINI_API_KEY);
    
    const response = await fetch(
      `${API_ENDPOINT}/${MODEL_ID}:generateContent`,
      requestOptions
    );

    console.log('📥 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('📦 API Result:', JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.error('❌ API returned error:', result.error);
      throw new Error(`API error: ${result.error.message || 'Unknown error'}`);
    }

    // Extract the generated text
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('📝 Generated text:', generatedText);
    
    // Parse the JSON response
    let matchData;
    try {
      // Try to extract JSON - use more specific regex to avoid capturing trailing text
      let jsonMatch = generatedText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      
      if (!jsonMatch) {
        // Try line-by-line extraction
        const lines = generatedText.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('{')) {
            let braceCount = 0;
            let jsonStr = '';
            for (let j = i; j < lines.length; j++) {
              jsonStr += lines[j];
              for (const char of lines[j]) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
              }
              if (braceCount === 0 && jsonStr.includes('}')) {
                jsonMatch = [jsonStr.substring(0, jsonStr.lastIndexOf('}') + 1)];
                break;
              }
            }
            if (jsonMatch) break;
          }
        }
      }
      
      if (jsonMatch) {
        // Clean up the JSON string before parsing
        let jsonStr = jsonMatch[0]
          .replace(/\r?\n/g, ' ')  // Remove newlines
          .replace(/\s+/g, ' ')     // Normalize whitespace
          .trim();
        
        matchData = JSON.parse(jsonStr);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Error parsing Gemini match response:', parseError);
      console.error('Raw response:', generatedText);
      
      // Fallback: analyze text for keywords
      const lowerText = generatedText.toLowerCase();
      matchData = {
        isMatch: lowerText.includes('match') && !lowerText.includes('not match') && !lowerText.includes("don't match"),
        confidence: 0.5,
        reasoning: generatedText,
        matchScore: 50,
        keyFactors: []
      };
      console.log('⚠️ Using fallback match data:', matchData);
    }

    console.log('✅ Comparison complete:', matchData);
    
    return {
      success: true,
      isMatch: matchData.isMatch || false,
      confidence: matchData.confidence || 0,
      matchScore: matchData.matchScore || 0,
      reasoning: matchData.reasoning || '',
      keyFactors: matchData.keyFactors || [],
      rawResponse: generatedText
    };

  } catch (error) {
    console.error('💥 FATAL ERROR in compareItemsWithGemini:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      isMatch: false,
      confidence: 0,
      matchScore: 0,
      reasoning: `Error: ${error.message}`,
      keyFactors: [],
      error: error.message
    };
  }
};

/**
 * Normalize category names for consistent matching
 * Maps similar category names to a standard form
 * @param {string} category - Category name to normalize
 * @returns {string} Normalized category name
 */
const normalizeCategoryName = (category) => {
  if (!category) return 'Other';
  
  const normalized = category.toLowerCase().trim();
  
  // Category normalization map
  const categoryMap = {
    // ID-related categories
    'id': 'ID',
    'identification': 'ID',
    'identification card': 'ID',
    'id card': 'ID',
    'driver\'s license': 'ID',
    'drivers license': 'ID',
    'license': 'ID',
    'government document': 'ID',
    'document': 'Document',
    'passport': 'Passport',
    'student id': 'ID',
    'employee id': 'ID',
    'school id': 'ID',
    
    // Phone categories
    'phone': 'Phone',
    'smartphone': 'Phone',
    'mobile phone': 'Phone',
    'cellphone': 'Phone',
    'cell phone': 'Phone',
    'iphone': 'Phone',
    'android phone': 'Phone',
    'samsung phone': 'Phone',
    'huawei phone': 'Phone',
    'oppo phone': 'Phone',
    'vivo phone': 'Phone',
    'xiaomi phone': 'Phone',
    
    // Computer categories
    'laptop': 'Laptop',
    'computer': 'Laptop',
    'notebook': 'Laptop',
    'notebook computer': 'Laptop',
    'macbook': 'Laptop',
    'chromebook': 'Laptop',
    'tablet': 'Tablet',
    'ipad': 'Tablet',
    'android tablet': 'Tablet',
    
    // Bags & Containers
    'wallet': 'Wallet',
    'purse': 'Wallet',
    'billfold': 'Wallet',
    'bag': 'Bag',
    'backpack': 'Bag',
    'handbag': 'Bag',
    'satchel': 'Bag',
    'tote bag': 'Bag',
    'messenger bag': 'Bag',
    'duffel bag': 'Bag',
    'suitcase': 'Luggage',
    'luggage': 'Luggage',
    'briefcase': 'Briefcase',
    'pouch': 'Pouch',
    'pencil case': 'Pencil Case',
    
    // Eyewear
    'glasses': 'Glasses',
    'eyeglasses': 'Glasses',
    'spectacles': 'Glasses',
    'reading glasses': 'Glasses',
    'sunglasses': 'Sunglasses',
    'shades': 'Sunglasses',
    
    // Watches & Jewelry
    'watch': 'Watch',
    'wristwatch': 'Watch',
    'smartwatch': 'Watch',
    'apple watch': 'Watch',
    'fitness tracker': 'Watch',
    'bracelet': 'Jewelry',
    'necklace': 'Jewelry',
    'ring': 'Jewelry',
    'earring': 'Jewelry',
    'earrings': 'Jewelry',
    'jewelry': 'Jewelry',
    
    // Keys
    'keys': 'Keys',
    'key': 'Keys',
    'keychain': 'Keys',
    'key ring': 'Keys',
    'car keys': 'Keys',
    'house keys': 'Keys',
    
    // Electronics
    'headphones': 'Headphones',
    'earphones': 'Headphones',
    'earbuds': 'Headphones',
    'airpods': 'Headphones',
    'wireless earbuds': 'Headphones',
    'charger': 'Charger',
    'phone charger': 'Charger',
    'laptop charger': 'Charger',
    'power adapter': 'Charger',
    'cable': 'Cable',
    'usb cable': 'Cable',
    'charging cable': 'Cable',
    'power bank': 'Power Bank',
    'portable charger': 'Power Bank',
    'mouse': 'Mouse',
    'computer mouse': 'Mouse',
    'wireless mouse': 'Mouse',
    'keyboard': 'Keyboard',
    'flash drive': 'Flash Drive',
    'usb drive': 'Flash Drive',
    'thumb drive': 'Flash Drive',
    'memory card': 'Memory Card',
    'sd card': 'Memory Card',
    'camera': 'Camera',
    
    // Clothing
    'jacket': 'Jacket',
    'coat': 'Jacket',
    'hoodie': 'Jacket',
    'sweater': 'Sweater',
    'shirt': 'Shirt',
    't-shirt': 'Shirt',
    'blouse': 'Shirt',
    'pants': 'Pants',
    'trousers': 'Pants',
    'jeans': 'Pants',
    'shorts': 'Shorts',
    'skirt': 'Skirt',
    'dress': 'Dress',
    'hat': 'Hat',
    'cap': 'Hat',
    'beanie': 'Hat',
    'scarf': 'Scarf',
    'shoes': 'Shoes',
    'sneakers': 'Shoes',
    'sandals': 'Shoes',
    'slippers': 'Shoes',
    'boots': 'Shoes',
    'socks': 'Socks',
    'gloves': 'Gloves',
    'belt': 'Belt',
    
    // School Supplies
    'pen': 'Pen',
    'pencil': 'Pencil',
    'marker': 'Marker',
    'highlighter': 'Highlighter',
    'eraser': 'Eraser',
    'ruler': 'Ruler',
    'notebook': 'Notebook',
    'binder': 'Binder',
    'folder': 'Folder',
    'book': 'Book',
    'textbook': 'Book',
    'calculator': 'Calculator',
    
    // Personal Items
    'umbrella': 'Umbrella',
    'bottle': 'Bottle',
    'water bottle': 'Bottle',
    'tumbler': 'Bottle',
    'thermos': 'Bottle',
    'lunchbox': 'Lunchbox',
    'food container': 'Container',
    'tissue': 'Tissue',
    'handkerchief': 'Handkerchief',
    'towel': 'Towel',
    'comb': 'Comb',
    'brush': 'Brush',
    'hairbrush': 'Brush',
    'mirror': 'Mirror',
    'compact mirror': 'Mirror',
    
    // Sports & Recreation
    'ball': 'Ball',
    'basketball': 'Ball',
    'football': 'Ball',
    'soccer ball': 'Ball',
    'volleyball': 'Ball',
    'tennis racket': 'Sports Equipment',
    'badminton racket': 'Sports Equipment',
    'sports equipment': 'Sports Equipment',
    'gym bag': 'Bag',
    
    // Musical Instruments
    'guitar': 'Guitar',
    'ukulele': 'Ukulele',
    'violin': 'Violin',
    'flute': 'Flute',
    'instrument': 'Musical Instrument',
    
    // Miscellaneous
    'toy': 'Toy',
    'stuffed animal': 'Toy',
    'plushie': 'Toy',
    'medal': 'Medal',
    'trophy': 'Trophy',
    'badge': 'Badge',
    'pin': 'Pin',
    'sticker': 'Sticker',
    'card': 'Card',
    'gift card': 'Card',
    'credit card': 'Card',
    'debit card': 'Card'
  };
  
  // Return normalized name or capitalize first letter of original
  return categoryMap[normalized] || category.charAt(0).toUpperCase() + category.slice(1);
};

export default analyzeImageWithGemini;