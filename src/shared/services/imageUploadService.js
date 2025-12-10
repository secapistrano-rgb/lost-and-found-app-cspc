import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { API_CONFIG } from '../../config/apiConfig';

/**
 * Image Upload Service
 * Handles uploading images to server and returns image URLs for better performance
 */

const UPLOAD_ENDPOINT = '/api/upload/image';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Upload image file to server and return URL
 * @param {string} imageUri - Local image URI
 * @param {string} folder - Optional folder name for organization (e.g., 'items', 'profiles', 'claims')
 * @returns {Promise<string>} - Image URL from server
 */
export const uploadImage = async (imageUri, folder = 'general') => {
  try {
    console.log('=== UPLOAD IMAGE DEBUG ===');
    console.log('Starting upload for URI:', imageUri);
    
    if (!imageUri) {
      console.log('Upload failed: No image URI provided');
      return {
        success: false,
        error: 'Image URI is required'
      };
    }

    // Validate image format and size
    console.log('Validating image file...');
    const validation = await validateImageFile(imageUri);
    console.log('Validation result:', validation);
    
    if (!validation.isValid) {
      console.log('Upload failed: Validation error -', validation.reason);
      return {
        success: false,
        error: `Validation failed: ${validation.reason}`
      };
    }

    // Prepare form data for upload
    const formData = new FormData();
    
    // Handle different platforms
    if (Platform.OS === 'web') {
      // For web, convert data URI to blob
      if (imageUri.startsWith('data:')) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('image', blob, `image_${Date.now()}.jpg`);
      } else {
        throw new Error('Invalid image format for web platform');
      }
    } else {
      // For mobile platforms
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        throw new Error('Image file does not exist');
      }

      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `image_${Date.now()}.jpg`,
      });
    }

    formData.append('folder', folder);

    // For development: Use local storage fallback when server is not available
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${UPLOAD_ENDPOINT}`, {
        method: 'POST',
        // Don't set Content-Type for FormData - browser will set it with boundary
        headers: {
          // Remove Content-Type to let browser set it automatically with boundary
          ...Object.fromEntries(
            Object.entries(API_CONFIG.HEADERS).filter(([key]) => 
              key.toLowerCase() !== 'content-type'
            )
          ),
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.imageUrl) {
        throw new Error('Server did not return image URL');
      }

      return {
        success: true,
        imageUrl: result.imageUrl
      };
    } catch (networkError) {
      console.error('Server upload failed:', networkError.message);
      
      // Return failure instead of local fallback to ensure proper server URLs
      return {
        success: false,
        error: `Upload failed: ${networkError.message}`,
        imageUrl: null
      };
    }
  } catch (error) {
    console.error('Error uploading image:', error);
    return {
      success: false,
      error: error.message,
      imageUrl: null
    };
  }
};

/**
 * Upload multiple images and return array of URLs
 * @param {Array<string>} imageUris - Array of local image URIs
 * @param {string} folder - Optional folder name for organization
 * @returns {Promise<Array<string>>} - Array of image URLs from server
 */
export const uploadMultipleImages = async (imageUris, folder = 'general') => {
  try {
    if (!Array.isArray(imageUris) || imageUris.length === 0) {
      return {
        success: true,
        imageUrls: []
      };
    }

    // Upload images in parallel
    const uploadPromises = imageUris.map(uri => uploadImage(uri, folder));
    const uploadResults = await Promise.all(uploadPromises);
    
    // Extract successful uploads
    const successfulUploads = uploadResults
      .filter(result => result && result.success)
      .map(result => result.imageUrl);
    
    return {
      success: true,
      imageUrls: successfulUploads
    };
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    return {
      success: false,
      error: error.message,
      imageUrls: []
    };
  }
};

/**
 * Validate image file before upload
 * @param {string} imageUri - Image URI to validate
 * @returns {Promise<Object>} - Validation result
 */
const validateImageFile = async (imageUri) => {
  try {
    console.log('=== IMAGE VALIDATION DEBUG ===');
    console.log('Image URI:', imageUri);
    console.log('Platform:', Platform.OS);
    
    if (!imageUri) {
      console.log('Validation failed: No image URI provided');
      return {
        isValid: false,
        reason: 'Image URI is required'
      };
    }

    // Check if it's a data URI
    if (imageUri.startsWith('data:')) {
      console.log('Processing data URI...');
      const mimeMatch = imageUri.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : '';
      console.log('Detected MIME type:', mimeType);
      console.log('Allowed types:', ALLOWED_TYPES);
      
      if (!ALLOWED_TYPES.includes(mimeType)) {
        console.log('Validation failed: Unsupported MIME type');
        return {
          isValid: false,
          reason: `Unsupported image format: ${mimeType}. Please use JPEG, PNG, or WebP.`
        };
      }

      console.log('Data URI validation passed');
      // For data URIs, we'll skip size validation as they're already processed
    } else if (imageUri.startsWith('http')) {
      console.log('Processing HTTP URL - skipping validation');
      // Skip validation for HTTP URLs as they're already uploaded
      return {
        isValid: true,
        reason: 'HTTP URL - validation skipped'
      };
    } else {
      console.log('Processing file URI...');
      // For file URIs, validate file extension
      const fileExtension = imageUri.toLowerCase().split('.').pop();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
      console.log('File extension:', fileExtension);
      console.log('Allowed extensions:', allowedExtensions);
      
      if (!allowedExtensions.includes(fileExtension)) {
        console.log('Validation failed: Unsupported file extension');
        return {
          isValid: false,
          reason: `Unsupported image format: .${fileExtension}. Please use JPEG, PNG, or WebP.`
        };
      }

      // For file URIs, check file info
      if (Platform.OS !== 'web') {
        console.log('Checking file info...');
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        console.log('File info:', fileInfo);
        
        if (!fileInfo.exists) {
          console.log('Validation failed: File does not exist');
          return {
            isValid: false,
            reason: 'Image file does not exist'
          };
        }

        if (fileInfo.size > MAX_FILE_SIZE) {
          console.log('Validation failed: File too large');
          return {
            isValid: false,
            reason: `Image size too large (${(fileInfo.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
          };
        }
        
        console.log('File validation passed');
      }
    }

    console.log('Image validation successful');
    return {
      isValid: true,
      reason: 'Image is valid'
    };
  } catch (error) {
    console.error('Validation error:', error);
    return {
      isValid: false,
      reason: `Error validating image file: ${error.message}`
    };
  }
};

/**
 * Delete image from server
 * @param {string} imageUrl - Image URL to delete
 * @returns {Promise<boolean>} - Success status
 */
export const deleteImage = async (imageUrl) => {
  try {
    if (!imageUrl) {
      return false;
    }

    const response = await fetch(`${API_CONFIG.BASE_URL}/api/upload/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...API_CONFIG.HEADERS,
      },
      body: JSON.stringify({ imageUrl }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};

/**
 * Get optimized image URL with size parameters
 * @param {string} imageUrl - Original image URL
 * @param {Object} options - Size options (width, height, quality)
 * @returns {string} - Optimized image URL
 */
export const getOptimizedImageUrl = (imageUrl, options = {}) => {
  if (!imageUrl) return '';
  
  const { width, height, quality = 80 } = options;
  const url = new URL(imageUrl);
  
  if (width) url.searchParams.set('w', width.toString());
  if (height) url.searchParams.set('h', height.toString());
  url.searchParams.set('q', quality.toString());
  
  return url.toString();
};

export default {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  getOptimizedImageUrl,
};