import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';


const MatchCard = ({ match, onPress, onLongPress, currentUser, onSendMatch, isSelected, selectionMode }) => {
  const { lostItem, foundItem, score } = match;
  const styles = createStyles();
  
  // Determine user's role in this match
  const isLostItemOwner = lostItem.reporterId === currentUser?.email;
  const isFoundItemOwner = foundItem.reporterId === currentUser?.email;
  const canSendMatch = isLostItemOwner && match.status === 'pending';
  // Respond functionality removed for found item users
  
  // Format score as percentage
  const scorePercent = Math.round(score * 100);
  
  // Get match quality category based on score
  const getMatchQuality = (scorePercentage) => {
    if (scorePercentage >= 80) {
      return {
        label: 'Match',
        confidence: 'High Confidence',
        color: '#27ae60',
        bgColor: '#d4edda',
        icon: 'checkmark-circle'
      };
    } else if (scorePercentage >= 50) {
      return {
        label: 'Possible Match',
        confidence: 'Medium Confidence',
        color: '#f39c12',
        bgColor: '#fff3cd',
        icon: 'alert-circle'
      };
    } else {
      return {
        label: 'Unmatched',
        confidence: 'Low Confidence',
        color: '#e74c3c',
        bgColor: '#f8d7da',
        icon: 'close-circle'
      };
    }
  };
  
  const matchQuality = getMatchQuality(scorePercent);
  
  // Format date to a readable string
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Helper function to get the correct image URI from different possible field names
  const getImageUri = (item) => {
    if (!item) return null;
    return item.imageUri || item.image_url || item.imageUrl || null;
  };
  
  // Determine which image to show (prefer found item image)
  const imageUrl = getImageUri(foundItem) || getImageUri(lostItem);

  return (
    <TouchableOpacity 
      style={[styles.card, isSelected && styles.selectedCard]} 
      onPress={() => onPress(match)}
      onLongPress={() => onLongPress && onLongPress(match)}
      delayLongPress={500}
    >
      {/* Selection indicator */}
      {selectionMode && (
        <View style={styles.selectionIndicator}>
          <Ionicons 
            name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
            size={20} 
            color={isSelected ? '#28a745' : '#ccc'} 
          />
        </View>
      )}
      <LinearGradient
        colors={[matchQuality.color, matchQuality.color]}
        style={styles.scoreContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={matchQuality.icon} size={20} color="#fff" style={styles.scoreIcon} />
        <Text style={styles.scoreText}>{scorePercent}%</Text>
        <Text style={styles.scoreLabel}>Score</Text>
      </LinearGradient>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {lostItem.title || `Lost ${lostItem.categories?.[0] || 'Item'}`}
          </Text>
          <View style={[styles.matchBadge, { backgroundColor: matchQuality.bgColor, borderColor: matchQuality.color }]}>
            <Ionicons name={matchQuality.icon} size={12} color={matchQuality.color} />
            <Text style={[styles.matchBadgeText, { color: matchQuality.color }]}>{matchQuality.label}</Text>
          </View>
        </View>
        
        <View style={styles.itemsContainer}>
          <View style={styles.itemRow}>
            <Ionicons name="search" size={16} color="#dc3545" style={styles.icon} />
            <Text style={styles.itemText} numberOfLines={1}>
              Lost: {lostItem.description || 'No description'} ({formatDate(lostItem.createdAt)})
            </Text>
          </View>
          
          <View style={styles.itemRow}>
            <Ionicons name="checkmark-circle" size={16} color="#28a745" style={styles.icon} />
            <Text style={styles.itemText} numberOfLines={1}>
              Found: {foundItem.description || 'No description'} ({formatDate(foundItem.createdAt)})
            </Text>
          </View>
        </View>
        
        {match.categories && match.categories.length > 0 && (
          <View style={styles.categories}>
            {match.categories.map((category, index) => (
              <View key={index} style={styles.category}>
                <Text style={styles.categoryText}>{category}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Status and action buttons */}
        <View style={styles.actionContainer}>
          {/* Always show status */}
          <View style={[
            styles.statusContainer,
            match.status === 'accepted' ? styles.acceptedStatusBg : 
            match.status === 'rejected' ? styles.rejectedStatusBg : 
            match.status === 'resolved' ? styles.resolvedStatusBg : styles.pendingStatusBg
          ]}>
            <Ionicons 
              name={
                match.status === 'accepted' ? 'checkmark-circle' :
                match.status === 'rejected' ? 'close-circle' :
                match.status === 'resolved' ? 'trophy' : 'time'
              } 
              size={14} 
              color={
                match.status === 'accepted' ? '#28a745' :
                match.status === 'rejected' ? '#dc3545' :
                match.status === 'resolved' ? '#ffc107' : '#666'
              }
              style={styles.statusIcon}
            />
            <Text style={[styles.statusText, 
              match.status === 'accepted' ? styles.acceptedStatus : 
              match.status === 'rejected' ? styles.rejectedStatus : 
              match.status === 'resolved' ? styles.resolvedStatus : styles.pendingStatus
            ]}>
              {match.status ? match.status.charAt(0).toUpperCase() + match.status.slice(1) : 'Pending'}
            </Text>
          </View>
          
          {/* Respond button removed for found item users */}
        </View>
      </View>
      
      {imageUrl && imageUrl.trim() !== '' ? (
        <Image source={{ uri: imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholderImage]}>
          <Ionicons name="images-outline" size={24} color="#ccc" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = () => StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
    padding: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCard: {
    borderColor: '#28a745',
    borderWidth: 2,
    shadowColor: '#28a745',
    shadowOpacity: 0.3,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  scoreContainer: {
    width: 55,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  scoreIcon: {
    marginBottom: 2,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  scoreLabel: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    marginTop: 1,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  matchBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
  },
  itemsContainer: {
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 2,
  },
  icon: {
    marginRight: 8,
  },
  itemText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
    lineHeight: 18,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  category: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  image: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 12,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContainer: {
    flexDirection: 'row',
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    borderRadius: 20,
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  // Respond button styles removed
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    flex: 1,
    marginRight: 12,
    borderWidth: 1,
  },
  statusIcon: {
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  acceptedStatus: {
    color: '#28a745',
  },
  rejectedStatus: {
    color: '#dc3545',
  },
  resolvedStatus: {
    color: '#ffc107',
  },
  pendingStatus: {
    color: '#666',
  },
  acceptedStatusBg: {
    backgroundColor: '#f0f0f0',
    borderColor: '#28a745',
  },
  rejectedStatusBg: {
    backgroundColor: '#f0f0f0',
    borderColor: '#dc3545',
  },
  resolvedStatusBg: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ffc107',
  },
  pendingStatusBg: {
    backgroundColor: '#f0f0f0',
    borderColor: '#666',
  },

});

export default MatchCard;