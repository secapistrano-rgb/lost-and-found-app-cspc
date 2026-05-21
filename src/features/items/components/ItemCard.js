import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Get screen dimensions
const { width } = Dimensions.get('window');
const cardWidth = width - 32; // Full width minus padding

const ItemCard = ({ item, onPress, type = 'lost' }) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  // Format date to a readable string
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Calculate time remaining for found items
  useEffect(() => {
    if (type === 'found' && item.turnin_deadline && item.status === 'Pending Turning-in') {
      const updateTimer = () => {
        const now = new Date().getTime();
        const deadline = new Date(item.turnin_deadline).getTime();
        const diff = deadline - now;

        if (diff <= 0) {
          setIsExpired(true);
          setTimeRemaining('Expired');
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeRemaining(`${hours}h ${minutes}m`);
          setIsExpired(false);
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [type, item.turnin_deadline, item.status]);
  
  // Check if the item has been marked as found
  const isFound = item.status === 'found';
  const needsTurnIn = type === 'found' && item.status === 'Pending Turning-in';

  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        type === 'lost' ? styles.lostCard : styles.foundCard,
        isFound && styles.foundStatusCard
      ]} 
      onPress={() => onPress(item)}
      activeOpacity={0.9}
    >
      <View style={styles.cardContent}>
        <View style={styles.imageContainer}>
          {item.image_url && item.image_url.trim() !== '' ? (
        <Image 
          source={{ uri: item.image_url }} 
          style={styles.image}
          resizeMode="contain"
          onError={(error) => {
            console.log('Image load error for item', item.id, ':', error.nativeEvent.error);
          }}
        />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="image-outline" size={32} color="#ccc" />
            </View>
          )}
        </View>
        
        <View style={styles.infoContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title || `${type === 'lost' ? 'Lost' : 'Found'} ${item.categories?.[0] || 'Item'}`}
            </Text>
            <View style={styles.badgeContainer}>
              <View style={[
                styles.badge, 
                type === 'lost' ? styles.lostBadge : styles.foundBadge
              ]}>
                <Text style={styles.badgeText}>{type === 'lost' ? 'Lost' : 'Found'}</Text>
              </View>
              
              {isFound && (
                <View style={styles.statusBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#fff" style={{marginRight: 4}} />
                  <Text style={styles.statusBadgeText}>Found</Text>
                </View>
              )}
            </View>
          </View>
          
          <Text style={styles.description} numberOfLines={2}>
            {item.description || 'No description provided'}
          </Text>
          
          {/* Turn-in Deadline Timer */}
          {needsTurnIn && item.turnin_deadline && (
            <View style={[styles.deadlineContainer, isExpired && styles.expiredContainer]}>
              <Ionicons 
                name={isExpired ? "alert-circle" : "time-outline"} 
                size={14} 
                color={isExpired ? "#dc3545" : "#ff9500"} 
              />
              <Text style={[styles.deadlineText, isExpired && styles.expiredText]}>
                {isExpired ? '⚠️ Expired - Turn in ASAP' : `⏰ Turn in: ${timeRemaining}`}
              </Text>
            </View>
          )}

          {item.status === 'active' && type === 'found' && (
            <View style={styles.turnedInContainer}>
              <Ionicons name="checkmark-circle" size={14} color="#28a745" />
              <Text style={styles.turnedInText}>✓ Turned in to SSC Office</Text>
            </View>
          )}
          
          <View style={styles.footer}>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={14} color="#888" />
              <Text style={styles.date}>
                {formatDate(item.date || item.createdAt || new Date())}
              </Text>
            </View>
            
            {item.location && (
              <View style={styles.locationContainer}>
                <Ionicons name="location-outline" size={14} color="#888" />
                <Text style={styles.location} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  lostCard: {
    borderColor: '#ffecec',
  },
  foundCard: {
    borderColor: '#ecffec',
  },
  foundStatusCard: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: '#f9fff9',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  lostBadge: {
    backgroundColor: '#ff6b6b',
  },
  foundBadge: {
    backgroundColor: '#51cf66',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 6,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ff9500',
  },
  deadlineText: {
    fontSize: 12,
    color: '#ff9500',
    fontWeight: '600',
    marginLeft: 6,
  },
  expiredContainer: {
    backgroundColor: '#ffe0e0',
    borderLeftColor: '#dc3545',
  },
  expiredText: {
    color: '#dc3545',
  },
  turnedInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#28a745',
  },
  turnedInText: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '600',
    marginLeft: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  date: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  location: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
    flex: 1,
  },
});

export default ItemCard;