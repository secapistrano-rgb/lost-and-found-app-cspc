import { 
  getLostItems, 
  saveLostItems, 
  getFoundItems, 
  saveFoundItems,
  LOST_ITEMS_KEY,
  FOUND_ITEMS_KEY,
  getUser,
  updateUserField
} from '../storage/storage';
import { updateUserStatistic } from '../storage/userStorage';

/**
 * Update an item in storage
 * @param {Object} updatedItem - The updated item
 * @returns {Promise<Object|null>} The updated item or null if failed
 */
export const updateItem = async (updatedItem) => {
  try {
    console.log('updateItem - Starting update for item:', updatedItem.id, 'new type:', updatedItem.type);
    
    // Get both lost and found items to find the original item
    const lostItems = await getLostItems() || [];
    const foundItems = await getFoundItems() || [];
    
    // Find the original item in either list
    let originalItem = lostItems.find(item => item.id === updatedItem.id);
    let originalType = 'lost';
    
    if (!originalItem) {
      originalItem = foundItems.find(item => item.id === updatedItem.id);
      originalType = 'found';
    }
    
    if (!originalItem) {
      console.error('Original item not found in either list');
      return null;
    }
    
    console.log('updateItem - Original type:', originalType, 'New type:', updatedItem.type);
    
    const finalUpdatedItem = { ...updatedItem, updatedAt: new Date().toISOString() };
    
    // Check if the type has changed
    if (originalType !== updatedItem.type) {
      console.log('updateItem - Type changed, moving item between lists');
      
      // Remove from original list
      if (originalType === 'lost') {
        const updatedLostItems = lostItems.filter(item => item.id !== updatedItem.id);
        await saveLostItems(updatedLostItems);
        console.log('updateItem - Removed from lost items');
      } else {
        const updatedFoundItems = foundItems.filter(item => item.id !== updatedItem.id);
        await saveFoundItems(updatedFoundItems);
        console.log('updateItem - Removed from found items');
      }
      
      // Add to new list
      if (updatedItem.type === 'lost') {
        const newLostItems = [finalUpdatedItem, ...lostItems.filter(item => item.id !== updatedItem.id)];
        await saveLostItems(newLostItems);
        console.log('updateItem - Added to lost items');
      } else {
        const newFoundItems = [finalUpdatedItem, ...foundItems.filter(item => item.id !== updatedItem.id)];
        await saveFoundItems(newFoundItems);
        console.log('updateItem - Added to found items');
      }
    } else {
      console.log('updateItem - Type unchanged, updating in same list');
      
      // Type hasn't changed, just update in the same list
      const getItems = updatedItem.type === 'lost' ? getLostItems : getFoundItems;
      const saveItems = updatedItem.type === 'lost' ? saveLostItems : saveFoundItems;
      
      const items = await getItems() || [];
      const updatedItems = items.map(item => 
        item.id === updatedItem.id ? finalUpdatedItem : item
      );
      
      await saveItems(updatedItems);
    }
    
    console.log('updateItem - Update completed successfully');
    return finalUpdatedItem;
  } catch (error) {
    console.error('Error updating item:', error);
    return null;
  }
};

/**
 * Delete an item from storage
 * @param {Object} itemToDelete - The item to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteItem = async (itemToDelete) => {
  try {
    // Determine which list to update based on item type
    const itemType = itemToDelete.type || 'lost';
    const getItems = itemType === 'lost' ? getLostItems : getFoundItems;
    const saveItems = itemType === 'lost' ? saveLostItems : saveFoundItems;
    
    // Get current items
    const items = await getItems() || [];
    
    // Filter out the item to delete
    const updatedItems = items.filter(item => item.id !== itemToDelete.id);
    
    // Save the updated list
    await saveItems(updatedItems);
    
    return true;
  } catch (error) {
    console.error('Error deleting item:', error);
    return false;
  }
};

/**
 * Get an item by ID
 * @param {string} itemId - The ID of the item to get
 * @param {string} itemType - The type of the item ('lost' or 'found')
 * @returns {Promise<Object|null>} The item or null if not found
 */
export const getItemById = async (itemId, itemType = 'lost') => {
  try {
    // Get items based on type
    const items = itemType === 'lost' 
      ? await getLostItems() 
      : await getFoundItems();
    
    if (!items) return null;
    
    // Find the item with the matching ID
    return items.find(item => item.id === itemId) || null;
  } catch (error) {
    console.error('Error getting item by ID:', error);
    return null;
  }
};

/**
 * Mark an item as found instead of deleting it
 * @param {Object} item - The item to mark as found
 * @param {Object} foundDetails - Additional details about the found item
 * @returns {Promise<Object|null>} The updated item or null if failed
 */
export const markItemAsFound = async (item, foundDetails = {}) => {
  try {
    // Only lost items can be marked as found
    if (item.type !== 'lost') {
      console.error('Only lost items can be marked as found');
      return null;
    }
    
    // Create updated item with found status
    const updatedItem = {
      ...item,
      status: 'found',
      foundDetails: {
        ...foundDetails,
        foundAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };
    
    // Update the item in storage
    const result = await updateItem(updatedItem);
    
    // Update user statistics if the item was successfully updated
    if (result && item.reporterId) {
      try {
        // Update the user's statistics
        await updateUserStatistic(item.reporterId, 'itemsFound', (prev = 0) => prev + 1);
      } catch (statsError) {
        console.error('Error updating user statistics:', statsError);
        // Continue even if stats update fails
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error marking item as found:', error);
    return null;
  }
};