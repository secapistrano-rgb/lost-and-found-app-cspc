import { getUserAchievements, unlockAchievement, getUserStatistics, updateUserStatistic, saveUserAchievements } from '../storage/userStorage';

// Achievement definitions
export const ACHIEVEMENTS = {
  FIRST_REPORT: {
    id: 'first_report',
    title: 'First Steps',
    description: 'Report your first lost or found item',
    points: 10,
    icon: 'footsteps-outline'
  },
  FIVE_REPORTS: {
    id: 'five_reports',
    title: 'Regular Reporter',
    description: 'Report 5 lost or found items',
    points: 25,
    icon: 'newspaper-outline'
  },
  FIRST_MATCH: {
    id: 'first_match',
    title: 'Match Maker',
    description: 'Find a match for a lost or found item',
    points: 20,
    icon: 'link-outline'
  },
  THREE_MATCHES: {
    id: 'three_matches',
    title: 'Connection Expert',
    description: 'Successfully match 3 items',
    points: 50,
    icon: 'git-network-outline'
  },
  FIRST_CLAIM: {
    id: 'first_claim',
    title: 'Retriever',
    description: 'Claim your first item',
    points: 15,
    icon: 'hand-left-outline'
  },
  PROFILE_COMPLETE: {
    id: 'profile_complete',
    title: 'Identity Established',
    description: 'Complete your user profile',
    points: 5,
    icon: 'person-circle-outline'
  },
  WEEK_STREAK: {
    id: 'week_streak',
    title: 'Consistent Helper',
    description: 'Use the app for 7 consecutive days',
    points: 30,
    icon: 'calendar-outline'
  },
  GOOD_SAMARITAN: {
    id: 'good_samaritan',
    title: 'Good Samaritan',
    description: 'Report 3 found items that were claimed by their owners',
    points: 100,
    icon: 'heart-outline'
  }
};

/**
 * Check and update user achievements based on their actions
 * @param {string} email - User email
 * @param {string} action - The action performed (report, match, claim, etc.)
 * @param {Object} data - Additional data related to the action
 * @returns {Promise<Object|null>} Newly unlocked achievement or null
 */
export const checkAndUpdateAchievements = async (email, action, data = {}) => {
  try {
    // Get current user achievements and statistics
    const achievements = await getUserAchievements(email) || {};
    const statistics = await getUserStatistics(email) || {};
    
    // Initialize statistics if they don't exist
    if (!statistics.reportCount) {
      await updateUserStatistic(email, 'reportCount', 0);
    }
    if (!statistics.matchCount) {
      await updateUserStatistic(email, 'matchCount', 0);
    }
    if (!statistics.claimCount) {
      await updateUserStatistic(email, 'claimCount', 0);
    }
    if (!statistics.foundItemsReturnedCount) {
      await updateUserStatistic(email, 'foundItemsReturnedCount', 0);
    }
    
    let unlockedAchievement = null;
    
    // Check for achievements based on the action
    switch (action) {
      case 'report_item':
        // Update report count
        const reportCount = (statistics.reportCount || 0) + 1;
        await updateUserStatistic(email, 'reportCount', reportCount);
        
        // Check for first report achievement
        if (reportCount === 1 && !achievements[ACHIEVEMENTS.FIRST_REPORT.id]?.unlocked) {
          unlockedAchievement = await unlockAchievement(
            email, 
            ACHIEVEMENTS.FIRST_REPORT.id, 
            ACHIEVEMENTS.FIRST_REPORT
          );
        }
        
        // Check for five reports achievement
        if (reportCount === 5 && !achievements[ACHIEVEMENTS.FIVE_REPORTS.id]?.unlocked) {
          unlockedAchievement = await unlockAchievement(
            email, 
            ACHIEVEMENTS.FIVE_REPORTS.id, 
            ACHIEVEMENTS.FIVE_REPORTS
          );
        }
        break;
        
      case 'match_items':
        // Update match count
        const matchCount = (statistics.matchCount || 0) + 1;
        await updateUserStatistic(email, 'matchCount', matchCount);
        
        // Check for first match achievement
        if (matchCount === 1 && !achievements[ACHIEVEMENTS.FIRST_MATCH.id]?.unlocked) {
          unlockedAchievement = await unlockAchievement(
            email, 
            ACHIEVEMENTS.FIRST_MATCH.id, 
            ACHIEVEMENTS.FIRST_MATCH
          );
        }
        
        // Check for three matches achievement
        if (matchCount === 3 && !achievements[ACHIEVEMENTS.THREE_MATCHES.id]?.unlocked) {
          unlockedAchievement = await unlockAchievement(
            email, 
            ACHIEVEMENTS.THREE_MATCHES.id, 
            ACHIEVEMENTS.THREE_MATCHES
          );
        }
        break;
        
      case 'claim_item':
        // Update claim count
        const claimCount = (statistics.claimCount || 0) + 1;
        await updateUserStatistic(email, 'claimCount', claimCount);
        
        // Check for first claim achievement
        if (claimCount === 1 && !achievements[ACHIEVEMENTS.FIRST_CLAIM.id]?.unlocked) {
          unlockedAchievement = await unlockAchievement(
            email, 
            ACHIEVEMENTS.FIRST_CLAIM.id, 
            ACHIEVEMENTS.FIRST_CLAIM
          );
        }
        
        // If this was a found item being claimed, update the count for the reporter
        if (data.itemType === 'found' && data.reporterEmail) {
          const reporterStats = await getUserStatistics(data.reporterEmail) || {};
          const returnedCount = (reporterStats.foundItemsReturnedCount || 0) + 1;
          await updateUserStatistic(data.reporterEmail, 'foundItemsReturnedCount', returnedCount);
          
          // Check for Good Samaritan achievement for the reporter
          if (returnedCount === 3) {
            const reporterAchievements = await getUserAchievements(data.reporterEmail) || {};
            if (!reporterAchievements[ACHIEVEMENTS.GOOD_SAMARITAN.id]?.unlocked) {
              await unlockAchievement(
                data.reporterEmail, 
                ACHIEVEMENTS.GOOD_SAMARITAN.id, 
                ACHIEVEMENTS.GOOD_SAMARITAN
              );
              // Note: We don't return this as the unlocked achievement since it's for a different user
            }
          }
        }
        break;
        
      case 'update_profile':
        // Check if profile is complete
        if (data.isComplete && !achievements[ACHIEVEMENTS.PROFILE_COMPLETE.id]?.unlocked) {
          unlockedAchievement = await unlockAchievement(
            email, 
            ACHIEVEMENTS.PROFILE_COMPLETE.id, 
            ACHIEVEMENTS.PROFILE_COMPLETE
          );
        }
        break;
        
      case 'daily_login':
        // Update login streak
        const currentStreak = statistics.loginStreak || 0;
        const lastLogin = statistics.lastLoginDate ? new Date(statistics.lastLoginDate) : null;
        const today = new Date();
        
        // Check if the last login was yesterday
        let newStreak = 1;
        if (lastLogin) {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          
          if (lastLogin.toDateString() === yesterday.toDateString()) {
            newStreak = currentStreak + 1;
          }
        }
        
        await updateUserStatistic(email, 'loginStreak', newStreak);
        await updateUserStatistic(email, 'lastLoginDate', today.toISOString());
        
        // Check for week streak achievement
        if (newStreak === 7 && !achievements[ACHIEVEMENTS.WEEK_STREAK.id]?.unlocked) {
          unlockedAchievement = await unlockAchievement(
            email, 
            ACHIEVEMENTS.WEEK_STREAK.id, 
            ACHIEVEMENTS.WEEK_STREAK
          );
        }
        break;
    }
    
    return unlockedAchievement;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return null;
  }
};

/**
 * Initialize achievements for a new user
 * @param {string} email - User email
 */
export const initializeAchievements = async (email) => {
  try {
    console.log('Starting achievement initialization for:', email);
    const achievements = await getUserAchievements(email);
    console.log('Current achievements:', achievements ? 'Found existing' : 'None found');
    
    // Only initialize if no achievements exist yet
    if (!achievements) {
      console.log('Creating initial achievements');
      const initialAchievements = {};
      
      // Add all achievements as locked
      Object.values(ACHIEVEMENTS).forEach(achievement => {
        initialAchievements[achievement.id] = {
          ...achievement,
          unlocked: false
        };
      });
      
      console.log('Saving initial achievements with keys:', Object.keys(initialAchievements));
      const result = await saveUserAchievements(email, initialAchievements);
      console.log('Save result:', result ? 'Success' : 'Failed');
      
      // Verify the achievements were saved
      const verifyAchievements = await getUserAchievements(email);
      console.log('Verification check:', verifyAchievements ? 'Successfully saved' : 'Not saved');
      
      return initialAchievements;
    }
    
    return achievements;
  } catch (error) {
    console.error('Error initializing achievements:', error);
    // Return empty achievements object as fallback
    return {};
  }
};