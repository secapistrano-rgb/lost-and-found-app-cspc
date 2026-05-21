// Gemini AI Matching Service for Node.js Backend
const fetch = require('node-fetch');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'REPLACE_WITH_YOUR_GEMINI_KEY';
const MODEL_ID = 'gemini-2.5-flash-lite';
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Prepare image for Gemini API from URL or data URI
 * @param {string} imageUrl - Image URL or data URI
 * @returns {Promise<Object>} Image data for Gemini
 */
async function prepareImageForGemini(imageUrl) {
  try {
    if (!imageUrl) return null;

    // Handle data URI
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

    // Handle HTTP URL
    if (imageUrl.startsWith('http')) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Failed to fetch image: ${response.status}`);
        return null;
      }

      const buffer = await response.buffer();
      const base64Data = buffer.toString('base64');

      return {
        "inlineData": {
          "mimeType": "image/jpeg",
          "data": base64Data
        }
      };
    }

    return null;
  } catch (error) {
    console.error('Error preparing image for Gemini:', error);
    return null;
  }
}

/**
 * Use Gemini AI to intelligently compare two items
 * @param {Object} item1 - First item (lost or found)
 * @param {Object} item2 - Second item (opposite type)
 * @returns {Promise<Object>} AI match analysis
 */
async function compareItemsWithGeminiAI(item1, item2) {
  try {
    console.log(`\n🤖 Using Gemini AI to compare items...`);
    console.log(`Item 1: ${item1.title} (${item1.category})`);
    console.log(`Item 2: ${item2.title} (${item2.category})`);

    // Prepare images
    let image1Data = null;
    let image2Data = null;

    // Parse and get first image from item1
    if (item1.images) {
      try {
        const images1 = typeof item1.images === 'string' ? JSON.parse(item1.images) : item1.images;
        const firstImage1 = Array.isArray(images1) ? images1[0] : images1;
        if (firstImage1) {
          image1Data = await prepareImageForGemini(firstImage1);
        }
      } catch (e) {
        console.log('Could not prepare image 1');
      }
    }

    // Parse and get first image from item2
    if (item2.images) {
      try {
        const images2 = typeof item2.images === 'string' ? JSON.parse(item2.images) : item2.images;
        const firstImage2 = Array.isArray(images2) ? images2[0] : images2;
        if (firstImage2) {
          image2Data = await prepareImageForGemini(firstImage2);
        }
      } catch (e) {
        console.log('Could not prepare image 2');
      }
    }

    // Build prompt
    const parts = [
      {
        "text": `You are an expert AI system for matching lost and found items. Analyze these two items and determine if they could be the SAME item.

ITEM 1 (${item1.type?.toUpperCase()}):
• Title: ${item1.title || 'N/A'}
• Category: ${item1.category || 'N/A'}
• Description: ${item1.description || 'N/A'}
• Location: ${item1.location || 'N/A'}

ITEM 2 (${item2.type?.toUpperCase()}):
• Title: ${item2.title || 'N/A'}
• Category: ${item2.category || 'N/A'}
• Description: ${item2.description || 'N/A'}
• Location: ${item2.location || 'N/A'}

CRITICAL RULES:
1. Categories MUST match (Phone ≠ Mouse, Phone ≠ Laptop, Bag ≠ Phone)
2. The items must be the SAME TYPE of object (not just same category)
3. Look for matching: colors, brands, models, unique features
4. Consider image similarity if images are provided

SCORING GUIDELINES:
• 80-100% (High Confidence "Match"): Very confident they're the same item
  - Nearly identical descriptions, colors, brands, models
  - Strong visual similarity if images provided
  - Multiple matching unique features
  
• 50-79% (Medium Confidence "Possible Match/Ambiguous"): Could be the same, needs review
  - Some matching features but missing details
  - Similar but not identical descriptions
  - Same category and general appearance
  
• 0-49% (Low Confidence "Unmatched"): Unlikely to be the same item
  - Different features, colors, or characteristics
  - Vague or conflicting descriptions
  - Visual differences if images provided

Respond in JSON format only:
{
  "isMatch": true or false,
  "confidence": 0.0 to 1.0,
  "matchScore": 0 to 100,
  "reasoning": "Clear explanation",
  "itemType": "What type of item (phone, bag, laptop, etc.)",
  "keyMatchingFeatures": ["feature1", "feature2"],
  "warnings": ["any concerns or differences"]
}

Be STRICT: Only mark isMatch=true if score is 50% or higher. Below 50% should be isMatch=false.`
      }
    ];

    // Add images
    if (image1Data) {
      parts.push({ "text": `\n[IMAGE 1 - ${item1.type?.toUpperCase()}]` });
      parts.push(image1Data);
    }

    if (image2Data) {
      parts.push({ "text": `\n[IMAGE 2 - ${item2.type?.toUpperCase()}]` });
      parts.push(image2Data);
    }

    // Make API request
    const requestBody = {
      "contents": [{
        "parts": parts
      }],
      "generationConfig": {
        "temperature": 0.4,
        "topK": 32,
        "topP": 1,
        "maxOutputTokens": 1024
      }
    };

    const response = await fetch(
      `${API_ENDPOINT}/${MODEL_ID}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();

    // Extract response
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log(`\n📄 Gemini Response:\n${generatedText}\n`);

    // Parse JSON from response
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
      console.error('Error parsing Gemini match response:', parseError);
      console.error('Raw response:', generatedText);
      
      const lowerText = generatedText.toLowerCase();
      const seemsMatch = lowerText.includes('match') && 
                        !lowerText.includes('not match') && 
                        !lowerText.includes("don't match") &&
                        !lowerText.includes("doesn't match");
      
      matchData = {
        isMatch: seemsMatch,
        confidence: seemsMatch ? 0.6 : 0.3,
        matchScore: seemsMatch ? 60 : 30,
        reasoning: generatedText,
        itemType: 'unknown',
        keyMatchingFeatures: [],
        warnings: ['Could not parse structured response']
      };
    }

    console.log(`\n✅ AI Analysis Complete:`);
    console.log(`   Is Match: ${matchData.isMatch ? 'YES' : 'NO'}`);
    console.log(`   Confidence: ${(matchData.confidence * 100).toFixed(1)}%`);
    console.log(`   Match Score: ${matchData.matchScore}`);
    console.log(`   Reasoning: ${matchData.reasoning}\n`);

    return {
      success: true,
      isMatch: matchData.isMatch || false,
      confidence: matchData.confidence || 0,
      matchScore: matchData.matchScore || 0,
      reasoning: matchData.reasoning || 'No reasoning provided',
      itemType: matchData.itemType || 'unknown',
      keyMatchingFeatures: matchData.keyMatchingFeatures || [],
      warnings: matchData.warnings || [],
      rawResponse: generatedText
    };

  } catch (error) {
    console.error('❌ Error in Gemini AI matching:', error);
    return null;
  }
}

module.exports = {
  compareItemsWithGeminiAI,
  prepareImageForGemini
};
