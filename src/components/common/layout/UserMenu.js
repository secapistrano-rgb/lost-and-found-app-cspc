import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  Image,
  Animated,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getUser } from '../../../shared/storage/storage';


const { width, height } = Dimensions.get('window');

const UserMenu = ({ navigation }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [animation] = useState(new Animated.Value(0));

  
  useEffect(() => {
    loadUserData();
  }, []);
  
  const loadUserData = async () => {
    try {
      const userData = await getUser();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };
  
  const toggleMenu = () => {
    if (isVisible) {
      // Animate out
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false);
      });
    } else {
      setIsVisible(true);
      // Animate in
      Animated.timing(animation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };
  
  const navigateTo = (screen) => {
    toggleMenu();
    // Add a small delay to allow the menu to close before navigating
    setTimeout(() => {
      navigation.navigate(screen);
    }, 200);
  };
  
  // Interpolate animation values
  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 0],
  });
  
  const opacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const menuItems = [
    {
      id: 'profile',
      icon: 'person',
      label: 'Profile',
      screen: 'UserProfile',
    },
    {
      id: 'history',
      icon: 'list',
      label: 'Item History',
      screen: 'ItemHistory',
    },
    {
      id: 'stats',
      icon: 'stats-chart',
      label: 'Statistics',
      screen: 'UserStats',
    },
    {
      id: 'achievements',
      icon: 'trophy',
      label: 'Achievements',
      screen: 'UserAchievements',
    },
    {
      id: 'feedback',
      icon: 'help-circle',
      label: 'Feedback',
      screen: 'UserFeedback',
    },
    {
      id: 'settings',
      icon: 'settings-outline',
      label: 'Settings',
      screen: 'Settings',
    },
    {
      id: 'help',
      icon: 'help-circle-outline',
      label: 'Help & Support',
      screen: 'HelpSupport',
    },
  ];

  return (
    <>
      <TouchableOpacity 
        style={styles.profileButton}
        onPress={toggleMenu}
      >
        {user && user.profileImage ? (
          <Image 
            source={{ uri: user.profileImage }} 
            style={styles.profileImage} 
          />
        ) : (
          <View style={styles.profileIcon}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
      
      <Modal
        visible={isVisible}
        transparent={true}
        animationType="none"
        onRequestClose={toggleMenu}
      >
        <TouchableOpacity 
          style={styles.overlay}
          activeOpacity={1}
          onPress={toggleMenu}
        >
          <Animated.View 
            style={[
              styles.menuContainer,
              { 
                transform: [{ translateY }],
                opacity,
                backgroundColor: '#fff'
              }
            ]}
          >
            <TouchableOpacity 
              style={[styles.menuHeader, { backgroundColor: '#f8f8f8', borderBottomColor: '#f0f0f0' }]}
              onPress={() => navigateTo('UserProfile')}
              activeOpacity={0.8}
            >
              <View style={styles.userInfo}>
                {user && user.profileImage ? (
                  <Image 
                    source={{ uri: user.profileImage }} 
                    style={styles.menuProfileImage} 
                  />
                ) : (
                  <View style={styles.menuProfileIcon}>
                    <Ionicons name="person" size={32} color="#fff" />
                  </View>
                )}
                <View style={styles.userTextInfo}>
                  <Text style={[styles.userName, { color: '#333' }]}>{user ? user.name : 'Guest User'}</Text>
                  <Text style={[styles.userEmail, { color: '#666' }]}>{user && user.email ? user.email : 'Tap to complete profile'}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            
            <View style={styles.menuItems}>
              {menuItems.map((item) => (
                <TouchableOpacity 
                  key={item.id}
                  style={styles.menuItem}
                  onPress={() => navigateTo(item.screen)}
                >
                  <Ionicons name={item.icon} size={24} color="#3266a8" style={styles.menuIcon} />
                  <Text style={[styles.menuText, { color: '#333' }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity 
              style={[styles.closeButton, { borderTopColor: '#e0e0e0' }]}
              onPress={toggleMenu}
            >
              <Text style={[styles.closeButtonText, { color: '#666' }]}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileIcon: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    width: width,
  },
  menuHeader: {
    backgroundColor: '#f8f8f8',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  menuProfileIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userTextInfo: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  menuItems: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  menuIcon: {
    marginRight: 16,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
  },
  closeButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});

export default UserMenu;
