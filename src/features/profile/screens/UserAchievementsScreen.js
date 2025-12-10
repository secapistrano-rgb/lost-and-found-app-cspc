import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';
import { getUserAchievements } from '../../../shared/storage/userStorage';
import { ACHIEVEMENTS, initializeAchievements } from '../../../shared/utils/achievementSystem';

const UserAchievementsScreen = ({ navigation }) => {
  const [achievements, setAchievements] = useState([]);
  const [userPoints, setUserPoints] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const { alertConfig, showError, showInfo, hideAlert } = useProfessionalAlert();
  const styles = createStyles();

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    setLoading(true);
    try {
      console.log('Loading achievements...');
      
      // Get user data from AsyncStorage
      const userDataString = await AsyncStorage.getItem('user_data');
      if (!userDataString) {
        console.log('No user data found');
        setLoading(false);
        return;
      }
      
      const userData = JSON.parse(userDataString);
      console.log('User data loaded:', userData);
      const userEmail = userData.email;
      
      if (!userEmail) {
        console.log('No user email found');
        setLoading(false);
        return;
      }
      
      console.log('Initializing achievements for:', userEmail);
      // Initialize achievements if needed
      try {
        await initializeAchievements(userEmail);
        console.log('Achievements initialized successfully');
      } catch (initError) {
        console.error('Error initializing achievements:', initError);
      }
      
      // Load user achievements from storage
      try {
        console.log('Attempting to get user achievements');
        const userAchievements = await getUserAchievements(userEmail);
        console.log('User achievements result:', userAchievements ? 'Success' : 'Not found');
        
        if (userAchievements) {
          // Convert from object to array format for display
          const achievementsArray = Object.values(userAchievements);
          console.log('Achievement array length:', achievementsArray.length);
          
          // Make sure all achievements from ACHIEVEMENTS are included
          const allAchievements = [];
          
          // Add all achievements from the system
          Object.values(ACHIEVEMENTS).forEach(achievement => {
            // Check if this achievement exists in user achievements
            const userAchievement = achievementsArray.find(a => a.id === achievement.id);
            
            if (userAchievement) {
              // Use the user's achievement data (which includes unlocked status)
              allAchievements.push(userAchievement);
            } else {
              // Add the achievement as locked if not found in user achievements
              allAchievements.push({
                ...achievement,
                unlocked: false
              });
            }
          });
          
          console.log('Total achievements to display:', allAchievements.length);
          setAchievements(allAchievements);
          
          // Calculate points and level
          const points = allAchievements.reduce((total, achievement) => {
            return total + (achievement.unlocked ? achievement.points : 0);
          }, 0);
          
          setUserPoints(points);
          setUserLevel(Math.floor(points / 100) + 1); // Level up every 100 points
        } else {
          // Create default achievements if none were found
          console.log('No achievements found, creating default achievements');
          const defaultAchievements = Object.values(ACHIEVEMENTS).map(achievement => ({
            ...achievement,
            unlocked: false
          }));
          
          setAchievements(defaultAchievements);
          setUserPoints(0);
          setUserLevel(1);
        }
      } catch (achievementError) {
        console.error('Error loading user achievements:', achievementError);
        // Still show default achievements even on error
        const defaultAchievements = Object.values(ACHIEVEMENTS).map(achievement => ({
          ...achievement,
          unlocked: false
        }));
        
        setAchievements(defaultAchievements);
        setUserPoints(0);
        setUserLevel(1);
      }
    } catch (error) {
      console.error('Error loading achievements:', error);
      showError('Error', 'Failed to load achievements. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Display achievement details when pressed
  const handleAchievementPress = (achievement) => {
    showInfo(
      achievement.title,
      `${achievement.description}\n\nPoints: ${achievement.points}${achievement.unlocked ? '\n\nUnlocked: ' + new Date(achievement.unlockedAt).toLocaleDateString() : ''}`
    );
  };

  const renderLevelProgress = () => {
    const nextLevelPoints = userLevel * 100;
    const currentLevelPoints = (userLevel - 1) * 100;
    const pointsToNextLevel = nextLevelPoints - userPoints;
    const progress = ((userPoints - currentLevelPoints) / 100) * 100; // Percentage to next level
    
    return (
      <View style={styles.levelContainer}>
        <View style={styles.levelHeader}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{userLevel}</Text>
          </View>
          <View style={styles.levelInfo}>
            <Text style={styles.levelTitle}>Level {userLevel}</Text>
            <Text style={styles.levelSubtitle}>
              {pointsToNextLevel} points to Level {userLevel + 1}
            </Text>
          </View>
          <Text style={styles.pointsText}>{userPoints} pts</Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
      </View>
    );
  };

  const renderAchievements = () => {
    // Group achievements by category
    const categories = {
      'Reporting': achievements.filter(a => 
        a.id.includes('report') || a.id.includes('first_')),
      'Matching': achievements.filter(a => 
        a.id.includes('match')),
      'Community': achievements.filter(a => 
        a.id.includes('profile') || a.id.includes('streak') || a.id.includes('samaritan')),
      'Other': achievements.filter(a => 
        !a.id.includes('report') && !a.id.includes('match') && 
        !a.id.includes('profile') && !a.id.includes('streak') && !a.id.includes('samaritan')),
    };
    
    return (
      <View style={styles.achievementsContainer}>
        {Object.entries(categories).map(([category, categoryAchievements]) => (
          categoryAchievements.length > 0 && (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category}</Text>
              <View style={styles.achievementsList}>
                {categoryAchievements.map(achievement => (
                  <TouchableOpacity
                    key={achievement.id}
                    style={[
                      styles.achievementCard,
                      achievement.unlocked ? styles.unlockedCard : styles.lockedCard
                    ]}
                    onPress={() => handleAchievementPress(achievement)}
                  >
                    <View style={[styles.achievementIcon, achievement.unlocked ? styles.unlockedIcon : styles.lockedIcon]}>
                      <Ionicons
                        name={achievement.icon || 'trophy-outline'}
                        size={24}
                        color={achievement.unlocked ? '#007bff' : '#ccc'}
                      />
                    </View>
                    <View style={styles.achievementContent}>
                      <Text style={[
                        styles.achievementTitle,
                        achievement.unlocked ? styles.unlockedText : styles.lockedText
                      ]}>
                        {achievement.title}
                      </Text>
                      <Text style={[styles.achievementDescription, achievement.unlocked ? {} : styles.lockedDescription]} numberOfLines={2}>
                        {achievement.description}
                      </Text>
                      <Text style={[styles.achievementPoints, achievement.unlocked ? styles.unlockedPoints : styles.lockedPoints]}>
                        {achievement.points} pts
                      </Text>
                    </View>
                    {achievement.unlocked ? (
                      <View style={styles.unlockedBadge}>
                        <Ionicons name="checkmark-circle" size={20} color="#28a745" />
                      </View>
                    ) : (
                      <View style={styles.lockedBadge}>
                        <Ionicons name="lock-closed" size={20} color="#ccc" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={styles.placeholder} />
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading achievements...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {renderLevelProgress()}
          {renderAchievements()}
        </ScrollView>
      )}
      
      <ProfessionalAlert
         visible={alertConfig.visible}
         type={alertConfig.type}
         title={alertConfig.title}
         message={alertConfig.message}
         buttons={alertConfig.buttons}
         onDismiss={hideAlert}
       />
    </SafeAreaView>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop:32,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 0.5,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  levelContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3266a8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  levelText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  levelSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  pointsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3266a8',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3266a8',
  },
  achievementsContainer: {
    paddingHorizontal: 16,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  achievementsList: {
    gap: 12,
  },
  achievementCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  unlockedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  lockedCard: {
    opacity: 0.8,
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  unlockedIcon: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#3266a8',
  },
  lockedIcon: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  unlockedText: {
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  lockedText: {
    color: '#666',
  },
  lockedDescription: {
    color: '#666',
  },
  unlockedPoints: {
    color: '#3266a8',
    fontWeight: 'bold',
  },
  lockedPoints: {
    color: '#666',
  },
  lockedBadge: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  achievementDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  achievementPoints: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#3266a8',
  },
  unlockedBadge: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default withInternetGuard(UserAchievementsScreen);
