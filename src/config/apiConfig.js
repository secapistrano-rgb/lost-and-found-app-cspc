/**
 * API Configuration for Lost & Found Application
 * 
 * This file contains the base URL and endpoints for the RESTful API
 */

export const API_CONFIG = {
  // Base URL for the API server
  BASE_URL: 'http://192.168.1.17:3000', // Local development server
  
  // API Endpoints
  ENDPOINTS: {
    // User endpoints
    USERS: '/api/users',
    USER_BY_ID: (id) => `/api/users/${id}`,
    USER_LOGIN: (id) => `/api/users/${id}/login`,
    USER_STATUS: (id) => `/api/users/${id}/status`,
    USER_SEARCH: '/api/users/search',
    USER_VIOLATION: (id) => `/api/users/${id}/violation`,
    USER_VIOLATIONS: (id) => `/api/users/${id}/violations`,
    
    // User Settings endpoints
    USER_SETTINGS: (email) => `/api/users/${email}/settings`,
    USER_SETTINGS_UPDATE: (email) => `/api/users/${email}/settings`,

    
    // Item endpoints
    ITEMS: '/api/items',
    ITEM_BY_ID: (id) => `/api/items/${id}`,
    ITEM_STATUS: (id) => `/api/items/${id}/status`,
    ITEM_SEARCH: '/api/items/search',
    ITEMS_BY_REPORTER: (email) => `/api/items/reporter/${email}`,
    ITEMS_NEARBY: '/api/items/nearby',
    ITEMS_CATEGORIES: '/api/items/categories',
    ITEMS_STATS: '/api/items/stats',
    
    // Match endpoints
    MATCHES: '/api/matches',
    MATCH_BY_ID: (id) => `/api/matches/${id}`,
    MATCHES_BY_USER: (email) => `/api/matches/user/${email}`,
    MATCH_STATUS: (id) => `/api/matches/${id}/status`,
    MATCH_STATS: '/api/matches/stats',
    
    // Claim endpoints
    CLAIMS: '/api/claims',
    CLAIM_BY_ID: (id) => `/api/claims/${id}`,
    CLAIMS_BY_CLAIMANT: (claimantId) => `/api/claims/claimant/${claimantId}`,
    CLAIMS_BY_ITEM: (itemId) => `/api/claims/item/${itemId}`,
    CLAIMS_BY_MATCH: (matchId) => `/api/claims/match/${matchId}`,
    CLAIM_STATUS: (id) => `/api/claims/${id}/status`,
    CLAIM_STATS: '/api/claims/stats',
    
    // Feedback endpoints
    FEEDBACK: '/api/feedback',
    FEEDBACK_BY_ID: (id) => `/api/feedback/${id}`,
    FEEDBACK_BY_USER: (email) => `/api/feedback/user/${email}`,
    FEEDBACK_STATUS: (id) => `/api/feedback/${id}/status`,
    
    // Upload endpoints
    UPLOAD_IMAGE: '/api/upload/image',
    UPLOAD_IMAGES: '/api/upload/images',
    UPLOAD_FILE: '/api/upload/file',
    FEEDBACK_STATS: '/api/feedback/stats',
    
    // Feedback response endpoints
    FEEDBACK_RESPONSES: (feedbackId) => `/api/feedback/${feedbackId}/responses`,
    FEEDBACK_RESPONSE_BY_ID: (id) => `/api/feedback-responses/${id}`,
    
    // Support ticket endpoints
    SUPPORT_TICKETS: '/api/support-tickets',
    SUPPORT_TICKET_BY_ID: (id) => `/api/support-tickets/${id}`,
    SUPPORT_TICKET_RESPONSES: (ticketId) => `/api/support-tickets/${ticketId}/responses`,
    SUPPORT_TICKET_RESPONSE_BY_ID: (id) => `/api/support-ticket-responses/${id}`,
  },
  
  // Request timeout in milliseconds
  TIMEOUT: 10000,
  
  // Default headers
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

/**
 * Helper function to get full API URL
 * @param {string} endpoint - The endpoint path
 * @returns {string} - Full API URL
 */
export const getApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

/**
 * Helper function to create user
 * @param {Object} userData - User data object
 * @returns {Promise} - API response
 */
export const createUser = async (userData) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.USERS), {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Helper function to create item
 * @param {Object} itemData - Item data object
 * @returns {Promise} - API response
 */
export const createItem = async (itemData) => {
  try {
    console.log('=== CREATE ITEM API CALL ===');
    console.log('API URL:', getApiUrl(API_CONFIG.ENDPOINTS.ITEMS));
    console.log('Item data being sent:', JSON.stringify(itemData, null, 2));
    
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.ITEMS), {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(itemData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('API Success Response:', result);
    
    // Transform result to convert images array to image_url field
    if (result.images && Array.isArray(result.images) && result.images.length > 0) {
      const imageData = result.images[0];
      // Use image URL directly if it's already a URL or data URI
      if (imageData.startsWith('http') || imageData.startsWith('data:image')) {
        result.image_url = imageData; // Use as-is if already a URL or data URI
      } else {
        result.image_url = imageData; // Use image URL directly
      }
    }
    
    return result;
  } catch (error) {
    console.error('=== CREATE ITEM API ERROR ===');
    console.error('Error creating item:', error);
    console.error('Error type:', typeof error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    throw error;
  }
};

/**
 * Helper function to get all items with optional filters
 * @param {Object} filters - Filter parameters (type, status, reporter_email, location, limit, offset)
 * @returns {Promise} - API response
 */
export const getItems = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.ITEMS)}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.ITEMS);
    
    console.log('getItems: Fetching from URL:', url);
    console.log('getItems: Using headers:', API_CONFIG.HEADERS);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS,
      timeout: API_CONFIG.TIMEOUT
    });
    
    console.log('getItems: Response status:', response.status);
    console.log('getItems: Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('getItems: Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('getItems: Raw API response:', data);
    
    // Extract items array from the response object
    // Handle both 'Items' (from API) and 'items' (fallback) properties
    const items = data.Items || data.items || data || [];
    console.log('getItems: Extracted items:', items.length, items);
    
    // Transform items to convert images array to image_url field
    const transformedItems = items.map(item => {
      const transformedItem = { ...item };
      // Convert images array to image_url field
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        const imageData = item.images[0];
        
        // Use image URL directly if it's already a URL or data URI
        if (imageData.startsWith('http') || imageData.startsWith('data:image')) {
          transformedItem.image_url = imageData; // Use as-is if already a URL or data URI
        } else {
          transformedItem.image_url = imageData; // Use image URL directly
        }
      }
      
      return transformedItem;
    });
    
    console.log('getItems: Transformed items:', transformedItems.length, transformedItems);
    
    return transformedItems;
  } catch (error) {
    console.error('Error fetching items - Full error:', error);
    console.error('Error fetching items - Error message:', error.message);
    console.error('Error fetching items - Error stack:', error.stack);
    // Return empty array instead of throwing error to prevent null reference issues
    return [];
  }
};

/**
 * Helper function to get item by ID
 * @param {string} itemId - Item ID
 * @returns {Promise} - API response
 */
export const getItemById = async (itemId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.ITEM_BY_ID(itemId)), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Transform result to convert images array to image_url field
    if (result.images && Array.isArray(result.images) && result.images.length > 0) {
      const imageData = result.images[0];
      // Use image URL directly if it's already a URL or data URI
      if (imageData.startsWith('http') || imageData.startsWith('data:image')) {
        result.image_url = imageData; // Use as-is if already a URL or data URI
      } else {
        result.image_url = imageData; // Use image URL directly
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching item:', error);
    throw error;
  }
};

/**
 * Helper function to update item
 * @param {string} itemId - Item ID
 * @param {Object} updateData - Data to update
 * @returns {Promise} - API response
 */
export const updateItem = async (itemId, updateData) => {
  try {
    console.log('=== UPDATE ITEM API CALL ===');
    console.log('Item ID:', itemId);
    console.log('Update data being sent:', JSON.stringify(updateData, null, 2));
    
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.ITEM_BY_ID(itemId)), {
      method: 'PUT',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(updateData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Update result:', result);
    return result;
  } catch (error) {
    console.error('Error updating item:', error);
    throw error;
  }
};

/**
 * Helper function to update item status
 * @param {string} itemId - Item ID
 * @param {string} status - New status (active, found, claimed, resolved)
 * @returns {Promise} - API response
 */
export const updateItemStatus = async (itemId, status) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.ITEM_STATUS(itemId)), {
      method: 'PATCH',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify({ status })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating item status:', error);
    throw error;
  }
};

/**
 * Helper function to delete item
 * @param {string} itemId - Item ID
 * @param {string} userEmail - Email of the user requesting deletion
 * @returns {Promise} - API response
 */
export const deleteItem = async (itemId, userEmail) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.ITEM_BY_ID(itemId)), {
      method: 'DELETE',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify({ userEmail })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
};

/**
 * Helper function to search items
 * @param {string} query - Search query
 * @param {Object} filters - Additional filters (type, status, limit)
 * @returns {Promise} - API response
 */
export const searchItems = async (query, filters = {}) => {
  try {
    const queryParams = new URLSearchParams({ q: query });
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const response = await fetch(`${getApiUrl(API_CONFIG.ENDPOINTS.ITEM_SEARCH)}?${queryParams.toString()}`, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const items = data.items || data || [];
    
    // Transform items to convert images array to image_url field
    const transformedItems = items.map(item => {
      const transformedItem = { ...item };
      
      // Convert images array to image_url field
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        const imageData = item.images[0];
        // Use image URL directly if it's already a URL or data URI
        if (imageData.startsWith('http') || imageData.startsWith('data:image')) {
          transformedItem.image_url = imageData; // Use as-is if already a URL or data URI
        } else {
          transformedItem.image_url = imageData; // Use image URL directly
        }
      }
      
      return transformedItem;
    });
    
    return transformedItems;
  } catch (error) {
    console.error('Error searching items:', error);
    // Return empty array instead of throwing error
    return [];
  }
};

/**
 * Helper function to get items by reporter email
 * @param {string} email - Reporter email
 * @param {Object} filters - Additional filters (type, status, limit, offset)
 * @returns {Promise} - API response
 */
export const getItemsByReporter = async (email, filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.ITEMS_BY_REPORTER(email))}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.ITEMS_BY_REPORTER(email));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const items = data.items || data || [];
    
    // Transform items to convert images array to image_url field
    const transformedItems = items.map(item => {
      const transformedItem = { ...item };
      
      // Convert images array to image_url field
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        const imageData = item.images[0];
        // Use image URL directly if it's already a URL or data URI
        if (imageData.startsWith('http') || imageData.startsWith('data:image')) {
          transformedItem.image_url = imageData; // Use as-is if already a URL or data URI
        } else {
          transformedItem.image_url = imageData; // Use image URL directly
        }
      }
      
      return transformedItem;
    });
    
    return transformedItems;
  } catch (error) {
    console.error('Error fetching items by reporter:', error);
    // Return empty array instead of throwing error
    return [];
  }
};

/**
 * Helper function to get nearby items
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} options - Additional options (radius, type, status, limit)
 * @returns {Promise} - API response
 */
export const getNearbyItems = async (lat, lng, options = {}) => {
  try {
    const queryParams = new URLSearchParams({ lat, lng });
    
    Object.keys(options).forEach(key => {
      if (options[key] !== undefined && options[key] !== null) {
        queryParams.append(key, options[key]);
      }
    });
    
    const response = await fetch(`${getApiUrl(API_CONFIG.ENDPOINTS.ITEMS_NEARBY)}?${queryParams.toString()}`, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const items = data.items || data || [];
    
    // Transform items to convert images array to image_url field
    const transformedItems = items.map(item => {
      const transformedItem = { ...item };
      
      // Convert images array to image_url field
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        const imageData = item.images[0];
        // Use image URL directly if it's already a URL or data URI
        if (imageData.startsWith('http') || imageData.startsWith('data:image')) {
          transformedItem.image_url = imageData; // Use as-is if already a URL or data URI
        } else {
          transformedItem.image_url = imageData; // Use image URL directly
        }
      }
      
      return transformedItem;
    });
    
    return transformedItems;
  } catch (error) {
    console.error('Error fetching nearby items:', error);
    // Return empty array instead of throwing error
    return [];
  }
};

/**
 * Helper function to get item categories
 * @returns {Promise} - API response with unique categories
 */
export const getItemCategories = async () => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.ITEMS_CATEGORIES), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('Error fetching item categories:', error);
    // Return empty array instead of throwing error
    return [];
  }
};

/**
 * Helper function to get item statistics
 * @returns {Promise} - API response with statistics
 */
export const getItemStatistics = async () => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.ITEMS_STATS), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching item statistics:', error);
    throw error;
  }
};

/**
 * Helper function to update user login timestamp
 * @param {string} userId - User ID
 * @returns {Promise} - API response
 */
export const updateUserLogin = async (userId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.USER_LOGIN(userId)), {
      method: 'PATCH',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating user login:', error);
    throw error;
  }
};

/**
 * Helper function to update user status
 * @param {string} userId - User ID
 * @param {string} status - User status ('Online' or 'Offline')
 * @returns {Promise} - API response
 */
export const updateUserStatus = async (userId, status) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.USER_STATUS(userId)), {
      method: 'PATCH',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify({ status })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

/**
 * Helper function to get user by email
 * @param {string} email - User email
 * @returns {Promise} - API response
 */
export const getUserByEmail = async (email) => {
  try {
    const response = await fetch(getApiUrl(`${API_CONFIG.ENDPOINTS.USER_SEARCH}?q=${encodeURIComponent(email)}`), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      // If 404 or other error, return null (user not found)
      console.log(`User search returned ${response.status} for email: ${email}`);
      return null;
    }
    
    const users = await response.json();
    // Find exact email match
    const user = users.find(user => user.email === email);
    console.log(`Search results for ${email}:`, users.length, 'users found');
    return user || null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    // Return null instead of throwing to prevent blocking login
    return null;
  }
};

/**
 * Get complete user details including suspension info by email
 * @param {string} email - User email
 * @returns {Promise} - Complete user data with suspension fields
 */
export const getUserDetailsWithSuspension = async (email) => {
  try {
    // First get user from search to get the ID
    const searchUser = await getUserByEmail(email);
    if (!searchUser || !searchUser.id) {
      return null;
    }
    
    // Then get complete user details using the ID
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.USER_BY_ID(searchUser.id)), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      console.log(`User details returned ${response.status} for ID: ${searchUser.id}`);
      return searchUser; // Fallback to search result
    }
    
    const userDetails = await response.json();
    console.log(`Complete user details for ${email}:`, userDetails);
    return userDetails;
  } catch (error) {
    console.error('Error getting user details with suspension:', error);
    // Fallback to regular search
    return await getUserByEmail(email);
  }
};

// =============================================================================
// MATCH API FUNCTIONS
// =============================================================================

/**
 * Get all matches with optional filtering
 * @param {Object} filters - Filter options
 * @returns {Promise} - API response
 */
export const getMatches = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.MATCHES)}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.MATCHES);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching matches:', error);
    throw error;
  }
};

/**
 * Get a specific match by ID
 * @param {string} matchId - Match ID
 * @returns {Promise} - API response
 */
export const getMatchById = async (matchId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MATCH_BY_ID(matchId)), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching match:', error);
    throw error;
  }
};

/**
 * Get matches for a specific user
 * @param {string} userEmail - User email
 * @param {Object} filters - Additional filter options
 * @returns {Promise} - API response
 */
export const getMatchesByUser = async (userEmail, filters = {}) => {
  try {
    console.log('=== GET MATCHES BY USER API CALL ===');
    console.log('User email:', userEmail);
    console.log('Filters:', filters);
    
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.MATCHES_BY_USER(userEmail))}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.MATCHES_BY_USER(userEmail));
    
    console.log('Request URL:', url);
    console.log('Request headers:', API_CONFIG.HEADERS);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    console.log('Response headers:', response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response text:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const responseText = await response.text();
    console.log('Raw response text length:', responseText.length);
    console.log('Raw response text preview (first 500 chars):', responseText.substring(0, 500));
    
    try {
      const jsonData = JSON.parse(responseText);
      console.log('Parsed JSON data successfully, array length:', jsonData.length);
      
      // Transform matches to include image data
      const transformedMatches = jsonData.map(match => {
        const transformedMatch = { ...match };
        
        // Transform lost item images
        if (match.lost_item_images) {
          try {
            let imagesArray = match.lost_item_images;
            // If it's a string, try to parse it as JSON
            if (typeof imagesArray === 'string') {
              imagesArray = JSON.parse(imagesArray);
            }
            if (Array.isArray(imagesArray) && imagesArray.length > 0) {
              const imageData = imagesArray[0];
              if (imageData.startsWith('http') || imageData.startsWith('data:image')) {
                transformedMatch.lost_item_image_url = imageData;
              } else {
                transformedMatch.lost_item_image_url = imageData;
              }
            }
          } catch (e) {
            console.warn('Failed to parse lost_item_images:', e);
          }
        }
        
        // Transform found item images
        if (match.found_item_images) {
          try {
            let imageData = null;
            
            // If it's a string, check if it's JSON array or plain URL
            if (typeof match.found_item_images === 'string') {
              if (match.found_item_images.startsWith('[')) {
                // It's a JSON array string
                const imagesArray = JSON.parse(match.found_item_images);
                if (Array.isArray(imagesArray) && imagesArray.length > 0) {
                  imageData = imagesArray[0];
                }
              } else {
                // It's a plain URL string
                imageData = match.found_item_images;
              }
            } else if (Array.isArray(match.found_item_images) && match.found_item_images.length > 0) {
              // It's already an array
              imageData = match.found_item_images[0];
            }
            
            if (imageData) {
              if (imageData.startsWith('http') || imageData.startsWith('data:image')) {
                transformedMatch.found_item_image_url = imageData;
              } else {
                transformedMatch.found_item_image_url = imageData;
              }
            }
          } catch (e) {
            console.warn('Failed to parse found_item_images:', e);
          }
        }
        
        return transformedMatch;
      });
      
      console.log('Transformed matches with images:', transformedMatches.length);
      return transformedMatches;
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Response text that failed to parse (first 1000 chars):', responseText.substring(0, 1000));
      throw new Error(`JSON Parse Error: ${parseError.message}. Response length: ${responseText.length}`);
    }
  } catch (error) {
    console.error('Error fetching user matches:', error);
    throw error;
  }
};

/**
 * Get match statistics
 * @param {string} userEmail - Optional user email for user-specific stats
 * @returns {Promise} - API response
 */
export const getMatchStats = async (userEmail = null) => {
  try {
    const url = userEmail 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.MATCH_STATS)}?user_email=${encodeURIComponent(userEmail)}`
      : getApiUrl(API_CONFIG.ENDPOINTS.MATCH_STATS);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching match stats:', error);
    throw error;
  }
};

/**
 * Create a new match
 * @param {Object} matchData - Match data
 * @returns {Promise} - API response
 */
export const createMatch = async (matchData) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MATCHES), {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(matchData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating match:', error);
    throw error;
  }
};

/**
 * Update a match completely
 * @param {string} matchId - Match ID
 * @param {Object} matchData - Updated match data
 * @returns {Promise} - API response
 */
export const updateMatch = async (matchId, matchData) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MATCH_BY_ID(matchId)), {
      method: 'PUT',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(matchData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating match:', error);
    throw error;
  }
};

/**
 * Update match status only
 * @param {string} matchId - Match ID
 * @param {string} status - New status (pending, accepted, rejected, resolved)
 * @returns {Promise} - API response
 */
export const updateMatchStatus = async (matchId, status) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MATCH_STATUS(matchId)), {
      method: 'PATCH',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify({ status })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating match status:', error);
    throw error;
  }
};

/**
 * Delete a match
 * @param {string} matchId - Match ID
 * @returns {Promise} - API response
 */
export const deleteMatch = async (matchId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MATCH_BY_ID(matchId)), {
      method: 'DELETE',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting match:', error);
    throw error;
  }
};

/**
 * Delete multiple matches
 * @param {Array} matchIds - Array of match IDs
 * @returns {Promise} - API response
 */
export const deleteMatches = async (matchIds) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MATCHES), {
      method: 'DELETE',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify({ ids: matchIds })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting matches:', error);
    throw error;
  }
};

/**
 * Run re-matching for specific items after deletion
 * @param {Array} lostItemIds - Array of lost item IDs
 * @param {Array} foundItemIds - Array of found item IDs
 * @returns {Promise} - API response
 */
export const runRematchForItems = async (lostItemIds, foundItemIds) => {
  try {
    const response = await fetch(getApiUrl('/api/matches/rematch'), {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify({ lostItemIds, foundItemIds })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in re-matching:', error);
    throw error;
  }
};

/**
 * Search matches with advanced filtering
 * @param {Object} searchParams - Search parameters
 * @returns {Promise} - API response
 */
export const searchMatches = async (searchParams) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(searchParams).forEach(key => {
      if (searchParams[key] !== undefined && searchParams[key] !== null && searchParams[key] !== '') {
        queryParams.append(key, searchParams[key]);
      }
    });
    
    const url = `${getApiUrl(API_CONFIG.ENDPOINTS.MATCHES)}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error searching matches:', error);
    throw error;
  }
};

/**
 * Get match analytics (alias for getMatchStats for backward compatibility)
 * @param {string} userEmail - Optional user email
 * @returns {Promise} - API response
 */
export const getMatchAnalytics = async (userEmail = null) => {
  return await getMatchStats(userEmail);
};

// ===== CLAIMS API FUNCTIONS =====

/**
 * Get all claims with optional filtering
 * @param {Object} filters - Filter parameters (item_id, match_id, claimant_id, claim_type, status, etc.)
 * @returns {Promise} - API response
 */
export const getClaims = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.CLAIMS)}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.CLAIMS);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching claims:', error);
    throw error;
  }
};

/**
 * Get claim by ID
 * @param {string} claimId - Claim ID
 * @returns {Promise} - API response
 */
export const getClaimById = async (claimId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.CLAIM_BY_ID(claimId)), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching claim:', error);
    throw error;
  }
};

/**
 * Get claims by claimant ID
 * @param {string} claimantId - Claimant ID
 * @param {Object} filters - Additional filters (status, claim_type, limit, offset)
 * @returns {Promise} - API response
 */
export const getClaimsByClaimant = async (claimantId, filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.CLAIMS_BY_CLAIMANT(claimantId))}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.CLAIMS_BY_CLAIMANT(claimantId));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching claims by claimant:', error);
    throw error;
  }
};

/**
 * Get claims by item ID
 * @param {string} itemId - Item ID
 * @param {Object} filters - Additional filters (status, claim_type, limit, offset)
 * @returns {Promise} - API response
 */
export const getClaimsByItem = async (itemId, filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.CLAIMS_BY_ITEM(itemId))}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.CLAIMS_BY_ITEM(itemId));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching claims by item:', error);
    throw error;
  }
};

/**
 * Get claims by match ID
 * @param {string} matchId - Match ID
 * @param {Object} filters - Additional filters (status, claim_type, limit, offset)
 * @returns {Promise} - API response
 */
export const getClaimsByMatch = async (matchId, filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.CLAIMS_BY_MATCH(matchId))}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.CLAIMS_BY_MATCH(matchId));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching claims by match:', error);
    throw error;
  }
};

/**
 * Get claim statistics
 * @returns {Promise} - API response
 */
export const getClaimStats = async () => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.CLAIM_STATS), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching claim stats:', error);
    throw error;
  }
};

/**
 * Create a new claim
 * @param {Object} claimData - Claim data
 * @returns {Promise} - API response
 */
export const createClaim = async (claimData) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.CLAIMS), {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(claimData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating claim:', error);
    throw error;
  }
};

/**
 * Update a claim completely
 * @param {string} claimId - Claim ID
 * @param {Object} claimData - Updated claim data
 * @returns {Promise} - API response
 */
export const updateClaim = async (claimId, claimData) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.CLAIM_BY_ID(claimId)), {
      method: 'PUT',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(claimData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating claim:', error);
    throw error;
  }
};

/**
 * Update claim status only
 * @param {string} claimId - Claim ID
 * @param {string} status - New status (pending, approved, rejected, resolved)
 * @returns {Promise} - API response
 */
export const updateClaimStatus = async (claimId, status) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.CLAIM_STATUS(claimId)), {
      method: 'PATCH',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify({ status })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating claim status:', error);
    throw error;
  }
};

/**
 * Delete a claim
 * @param {string} claimId - Claim ID
 * @returns {Promise} - API response
 */
export const deleteClaim = async (claimId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.CLAIM_BY_ID(claimId)), {
      method: 'DELETE',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting claim:', error);
    throw error;
  }
};

/**
 * Delete multiple claims
 * @param {Array} claimIds - Array of claim IDs
 * @returns {Promise} - API response
 */
export const deleteClaims = async (claimIds) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.CLAIMS), {
      method: 'DELETE',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify({ ids: claimIds })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting claims:', error);
    throw error;
  }
};

/**
 * Search claims with advanced filtering
 * @param {Object} searchParams - Search parameters
 * @returns {Promise} - API response
 */
export const searchClaims = async (searchParams) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(searchParams).forEach(key => {
      if (searchParams[key] !== undefined && searchParams[key] !== null && searchParams[key] !== '') {
        queryParams.append(key, searchParams[key]);
      }
    });
    
    const url = `${getApiUrl(API_CONFIG.ENDPOINTS.CLAIMS)}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error searching claims:', error);
    throw error;
  }
};

// ===== FEEDBACK API FUNCTIONS =====

/**
 * Get all feedback with optional filters
 * @param {Object} filters - Filter parameters (user_email, type, status, start_date, end_date, page, limit)
 * @returns {Promise} - API response
 */
export const getFeedback = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK)}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching feedback:', error);
    throw error;
  }
};

/**
 * Get feedback by ID
 * @param {string} feedbackId - Feedback ID
 * @returns {Promise} - API response
 */
export const getFeedbackById = async (feedbackId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_BY_ID(feedbackId)), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching feedback by ID:', error);
    throw error;
  }
};

/**
 * Get feedback by user email
 * @param {string} email - User email
 * @param {Object} filters - Additional filter parameters
 * @returns {Promise} - API response
 */
export const getFeedbackByUser = async (email, filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_BY_USER(email))}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_BY_USER(email));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching feedback by user:', error);
    throw error;
  }
};

/**
 * Get feedback statistics
 * @returns {Promise} - API response
 */
export const getFeedbackStats = async () => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_STATS), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    throw error;
  }
};

/**
 * Create new feedback
 * @param {Object} feedbackData - Feedback data object
 * @returns {Promise} - API response
 */
export const createFeedback = async (feedbackData) => {
  try {
    console.log('=== CREATE FEEDBACK API CALL ===');
    console.log('API URL:', getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK));
    console.log('Feedback data being sent:', JSON.stringify(feedbackData, null, 2));
    
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK), {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(feedbackData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('API Success Response:', result);
    
    return result;
  } catch (error) {
    console.error('=== CREATE FEEDBACK API ERROR ===');
    console.error('Error creating feedback:', error);
    throw error;
  }
};

/**
 * Update feedback completely
 * @param {string} feedbackId - Feedback ID
 * @param {Object} feedbackData - Updated feedback data
 * @returns {Promise} - API response
 */
export const updateFeedback = async (feedbackId, feedbackData) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_BY_ID(feedbackId)), {
      method: 'PUT',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(feedbackData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating feedback:', error);
    throw error;
  }
};

/**
 * Update feedback status only
 * @param {string} feedbackId - Feedback ID
 * @param {string} status - New status (pending, reviewed, addressed)
 * @returns {Promise} - API response
 */
export const updateFeedbackStatus = async (feedbackId, status) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_STATUS(feedbackId)), {
      method: 'PATCH',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify({ status })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating feedback status:', error);
    throw error;
  }
};

/**
 * Delete feedback
 * @param {string} feedbackId - Feedback ID
 * @returns {Promise} - API response
 */
export const deleteFeedback = async (feedbackId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_BY_ID(feedbackId)), {
      method: 'DELETE',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting feedback:', error);
    throw error;
  }
};

/**
 * Search feedback with advanced filtering
 * @param {Object} searchParams - Search parameters
 * @returns {Promise} - API response
 */
export const searchFeedback = async (searchParams) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(searchParams).forEach(key => {
      if (searchParams[key] !== undefined && searchParams[key] !== null && searchParams[key] !== '') {
        queryParams.append(key, searchParams[key]);
      }
    });
    
    const url = `${getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK)}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error searching feedback:', error);
    throw error;
  }
};

// ===== FEEDBACK RESPONSE FUNCTIONS =====

/**
 * Get all responses for a specific feedback
 * @param {string} feedbackId - Feedback ID
 * @param {Object} options - Additional options (limit, offset)
 * @returns {Promise} - API response
 */
export const getFeedbackResponses = async (feedbackId, options = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(options).forEach(key => {
      if (options[key] !== undefined && options[key] !== null) {
        queryParams.append(key, options[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_RESPONSES(feedbackId))}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_RESPONSES(feedbackId));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching feedback responses:', error);
    throw error;
  }
};

/**
 * Create a new response to feedback
 * @param {string} feedbackId - Feedback ID
 * @param {Object} responseData - Response data object
 * @returns {Promise} - API response
 */
export const createFeedbackResponse = async (feedbackId, responseData) => {
  try {
    console.log('=== CREATE FEEDBACK RESPONSE API CALL ===');
    console.log('API URL:', getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_RESPONSES(feedbackId)));
    console.log('Response data being sent:', JSON.stringify(responseData, null, 2));
    
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_RESPONSES(feedbackId)), {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(responseData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('API Success Response:', result);
    
    return result;
  } catch (error) {
    console.error('=== CREATE FEEDBACK RESPONSE API ERROR ===');
    console.error('Error creating feedback response:', error);
    throw error;
  }
};

/**
 * Get a specific feedback response by ID
 * @param {string} responseId - Response ID
 * @returns {Promise} - API response
 */
export const getFeedbackResponseById = async (responseId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_RESPONSE_BY_ID(responseId)), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching feedback response by ID:', error);
    throw error;
  }
};

/**
 * Update a feedback response
 * @param {string} responseId - Response ID
 * @param {Object} responseData - Updated response data
 * @returns {Promise} - API response
 */
export const updateFeedbackResponse = async (responseId, responseData) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_RESPONSE_BY_ID(responseId)), {
      method: 'PUT',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(responseData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating feedback response:', error);
    throw error;
  }
};

/**
 * Delete a feedback response
 * @param {string} responseId - Response ID
 * @returns {Promise} - API response
 */
export const deleteFeedbackResponse = async (responseId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.FEEDBACK_RESPONSE_BY_ID(responseId)), {
      method: 'DELETE',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting feedback response:', error);
    throw error;
  }
};

/**
 * Upload a single image
 * @param {File} imageFile - The image file to upload
 * @returns {Promise<Object>} Upload response with image URL
 */
export const uploadImage = async (imageFile) => {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.UPLOAD_IMAGE), {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Upload multiple images
 * @param {File[]} imageFiles - Array of image files to upload
 * @returns {Promise<Object>} Upload response with image URLs
 */
export const uploadImages = async (imageFiles) => {
  try {
    const formData = new FormData();
    imageFiles.forEach(file => {
      formData.append('images', file);
    });

    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.UPLOAD_IMAGES), {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading images:', error);
    throw error;
  }
};

/**
 * Upload a single file (document, PDF, etc.)
 * @param {Object} fileInfo - File information object with uri, name, and type
 * @returns {Promise<Object>} Upload response with file URL
 */
export const uploadFile = async (fileInfo) => {
  try {
    const formData = new FormData();
    
    // Create file object for React Native
    const file = {
      uri: fileInfo.uri,
      name: fileInfo.name,
      type: fileInfo.type || 'application/octet-stream'
    };
    
    formData.append('file', file);

    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.UPLOAD_FILE), {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Get user settings by email
 * @param {string} email - User email
 * @returns {Promise} - API response with user settings
 */
export const getUserSettings = async (email) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.USER_SETTINGS(email)), {
      method: 'GET',
      headers: API_CONFIG.HEADERS
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        // User settings not found, return null to indicate default settings should be used
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting user settings:', error);
    throw error;
  }
};

/**
 * Update user settings
 * @param {string} email - User email
 * @param {object} settings - Settings object
 * @returns {Promise} - API response
 */
export const updateUserSettings = async (email, settings) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.USER_SETTINGS_UPDATE(email)), {
      method: 'PUT',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(settings)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating user settings:', error);
    throw error;
  }
};

/**
 * Submit a new support ticket
 * @param {Object} ticketData - Support ticket data object
 * @returns {Promise} - API response
 */
export const submitSupportTicket = async (ticketData) => {
  try {
    console.log('Submitting to:', getApiUrl(API_CONFIG.ENDPOINTS.SUPPORT_TICKETS));
    console.log('Data:', JSON.stringify(ticketData, null, 2));
    
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SUPPORT_TICKETS), {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(ticketData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.log('Error response:', errorData);
      } catch {
        errorData = { error: `HTTP ${response.status}` };
      }
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Success response:', result);
    return result;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error(error.message || 'Network request failed');
  }
};

/**
 * Submit a response to a support ticket
 * @param {string} ticketId - Support ticket ID
 * @param {Object} responseData - Response data object
 * @returns {Promise} - API response
 */
export const submitSupportTicketResponse = async (ticketId, responseData) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SUPPORT_TICKET_RESPONSES(ticketId)), {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(responseData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error submitting support ticket response:', error);
    throw error;
  }
};

/**
 * Get all support tickets with optional filters
 * @param {Object} filters - Filter parameters (page, limit, status, category, priority, user_email)
 * @returns {Promise} - API response
 */
export const getSupportTickets = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null) {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = queryParams.toString() 
      ? `${getApiUrl(API_CONFIG.ENDPOINTS.SUPPORT_TICKETS)}?${queryParams.toString()}`
      : getApiUrl(API_CONFIG.ENDPOINTS.SUPPORT_TICKETS);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.HEADERS,
      timeout: API_CONFIG.TIMEOUT
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    throw error;
  }
};

/**
 * Get a specific support ticket by ID with responses
 * @param {string} ticketId - Support ticket ID
 * @returns {Promise} - API response
 */
export const getSupportTicketById = async (ticketId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SUPPORT_TICKET_BY_ID(ticketId)), {
      method: 'GET',
      headers: API_CONFIG.HEADERS,
      timeout: API_CONFIG.TIMEOUT
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching support ticket:', error);
    throw error;
  }
};

/**
 * Delete a support ticket and all its responses
 * @param {string} ticketId - Support ticket ID
 * @returns {Promise} - API response
 */
export const deleteSupportTicket = async (ticketId) => {
  try {
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SUPPORT_TICKET_BY_ID(ticketId)), {
      method: 'DELETE',
      headers: API_CONFIG.HEADERS,
      timeout: API_CONFIG.TIMEOUT
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting support ticket:', error);
    throw error;
  }
};

/**
 * Delete all user data (items, matches, claims, notifications, etc.)
 * This is a destructive operation and cannot be undone
 * @param {string} email - User email
 * @returns {Promise} - API response
 */
export const deleteUserData = async (email) => {
  try {
    const response = await fetch(getApiUrl(`/api/users/${email}/delete-all-data`), {
      method: 'DELETE',
      headers: API_CONFIG.HEADERS,
      timeout: API_CONFIG.TIMEOUT
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting user data:', error);
    throw error;
  }
};