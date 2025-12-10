import { getLostItems, getFoundItems, getMatches, addMatch, getUser } from '../../../shared/storage/storage';
import { findMatchesForLostItem } from './matchingAlgorithm';
import { sendMatchNotification, saveNotification, requestNotificationPermissions } from '../../../shared/services/notificationService';
import emailAlertService from '../../../shared/services/emailAlertService';

/**
 * Run the matching process in the background
 * This can be called from any screen to find matches without requiring a refresh
 * @param {boolean} silent - Whether to suppress console logs
 * @param {boolean} immediate - Whether this is an immediate match check (for new items)
 * @returns {Promise<{newMatchesCount: number, highScoreMatches: Array}>} Result of the matching process
 */
export const runMatchingProcess = async (silent = false, immediate = false) => {
  try {
    // Request notification permissions if not already granted
    const hasPermission = await requestNotificationPermissions();
    
    // Get current user from Google Sign-In data
    const user = await getUser();
    
    // Verify we have valid user data
    if (!user || !user.email) {
      return { newMatchesCount: 0, highScoreMatches: [] };
    }
    
    // Load lost and found items
    const lostItemsData = await getLostItems() || [];
    const foundItemsData = await getFoundItems() || [];
    
    // If there are no items to match, return early
    if (lostItemsData.length === 0 || foundItemsData.length === 0) {
      return { newMatchesCount: 0, highScoreMatches: [] };
    }
    
    // Add type property to distinguish between lost and found items
    const lostItems = lostItemsData.map(item => ({ ...item, type: 'lost' }));
    const foundItems = foundItemsData.map(item => ({ ...item, type: 'found' }));
    
    let allMatches = [];
    
    // Find matches for each lost item
    for (const lostItem of lostItems) {
      const matchesForLostItem = findMatchesForLostItem(lostItem, foundItems);
      allMatches = [...allMatches, ...matchesForLostItem];
    }
    
    // Sort matches by score (highest first)
    allMatches.sort((a, b) => b.score - a.score);
    
    // Save new matches to storage if they don't already exist
    const existingMatches = await getMatches() || [];
    const existingMatchIds = new Set(existingMatches.map(match => 
      `${match.lostItemId}-${match.foundItemId}`
    ));
    
    let newMatchesCount = 0;
    let highScoreMatches = [];
    
    for (const match of allMatches) {
      const matchId = `${match.lostItem.id}-${match.foundItem.id}`;
      
      // Associate match with the current Google user
      const lostItemReporterId = match.lostItem.reporterId || user.email;
      const foundItemReporterId = match.foundItem.reporterId || user.email;
      
      // Only process matches relevant to the current user
      if (lostItemReporterId === user.email || foundItemReporterId === user.email) {
        if (!existingMatchIds.has(matchId)) {
          const newMatch = {
            ...match,
            id: matchId,
            status: 'pending',
            // Add user information to the match
            userEmail: user.email,
            userName: user.name,
            matchedAt: new Date().toISOString()
          };
          
          await addMatch(newMatch);
          newMatchesCount++;
          
          // Track high score matches (above 40%) for notifications
          if (match.score > 0.4) {
            highScoreMatches.push(newMatch);
          }
        }
      }
    }
    
    // Send notifications for high score matches
    if (highScoreMatches.length > 0 && hasPermission) {
      await sendMatchNotifications(highScoreMatches, user);
    }
    
    return { newMatchesCount, highScoreMatches };
  } catch (error) {
    console.error('Error in matching process:', error);
    return { newMatchesCount: 0, highScoreMatches: [] };
  }
};

/**
 * Run immediate matching for a specific new item
 * This is called when a new lost or found item is reported
 * @param {Object} newItem - The newly reported item
 * @param {string} itemType - 'lost' or 'found'
 * @returns {Promise<Object>} Object containing matches found
 */
export const runImmediateMatching = async (newItem, itemType) => {
  try {
    // Get current user
    const user = await getUser();
    if (!user || !user.email) {
      return { newMatchesCount: 0, highScoreMatches: [] };
    }
    
    // Request notification permissions
    const hasPermission = await requestNotificationPermissions();
    
    let matches = [];
    let newMatchesCount = 0;
    let highScoreMatches = [];
    
    if (itemType === 'lost') {
      // Find matches for the new lost item against all found items
      const foundItems = await getFoundItems() || [];
      matches = await findMatchesForLostItem(newItem, foundItems);
    } else if (itemType === 'found') {
      // Find matches for the new found item against all lost items
      const lostItems = await getLostItems() || [];
      // We need to check each lost item against this found item
      for (const lostItem of lostItems) {
        const itemMatches = await findMatchesForLostItem(lostItem, [newItem]);
        matches.push(...itemMatches);
      }
    }
    
    // Process and save new matches
    const existingMatches = await getMatches();
    
    for (const match of matches) {
      // Check if this match already exists
      const existingMatch = existingMatches.find(existing => 
        existing.lostItemId === match.lostItem.id && 
        existing.foundItemId === match.foundItem.id
      );
      
      if (!existingMatch) {
        // This is a new match
        const newMatch = {
          id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          lostItemId: match.lostItem.id,
          foundItemId: match.foundItem.id,
          lostItem: match.lostItem,
          foundItem: match.foundItem,
          score: match.score,
          createdAt: new Date().toISOString(),
          status: 'pending'
        };
        
        // Save the match
        await addMatch(newMatch);
        newMatchesCount++;
        
        // Track high score matches (above 40%) for immediate notifications
        if (match.score > 0.4) {
          highScoreMatches.push(newMatch);
        }
      }
    }
    
    // Send immediate notifications for high score matches
    if (highScoreMatches.length > 0 && hasPermission) {
      console.log('=== SENDING MATCH NOTIFICATIONS ===');
      console.log('High score matches found:', highScoreMatches.length);
      console.log('User:', user);
      console.log('Permission granted:', hasPermission);
      
      await sendMatchNotifications(highScoreMatches, user);
    } else {
      console.log('=== NO MATCH NOTIFICATIONS SENT ===');
      console.log('High score matches:', highScoreMatches.length);
      console.log('Permission granted:', hasPermission);
    }
    
    return { newMatchesCount, highScoreMatches };
    
  } catch (error) {
    console.error('Error in immediate matching process:', error);
    return { newMatchesCount: 0, highScoreMatches: [] };
  }
};

/**
 * Send notifications for high score matches
 * @param {Array} highScoreMatches - Array of high score matches
 * @param {Object} user - Current user data
 */
const sendMatchNotifications = async (highScoreMatches, user) => {
  try {
    console.log('=== INSIDE sendMatchNotifications ===');
    console.log('Matches to process:', highScoreMatches.length);
    console.log('User data:', user);
    
    // Send notifications for all high score matches
    for (const match of highScoreMatches) {
      console.log('Processing match:', match.id, 'Score:', match.score);
      
      // Send immediate push notification with user context
      const notificationId = await sendMatchNotification(match, user);
      console.log('Notification sent with ID:', notificationId);
      
      // Send email notification if email alerts are enabled and user is valid
      if (user && user.email) {
        try {
          await emailAlertService.sendMatchNotificationEmail(user.email, match, user.name);
          console.log('Email notification sent to:', user.email);
        } catch (emailError) {
          console.log('Email notification failed:', emailError.message);
          // Email error shouldn't prevent push notification
        }
      }
    }
    console.log('=== MATCH NOTIFICATIONS COMPLETE ===');
  } catch (error) {
    console.error('Error in sendMatchNotifications:', error);
    // Don't let notification errors prevent the matching process
  }
};