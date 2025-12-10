import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  ScrollView, 
  TouchableOpacity,
  SafeAreaView,
  Share,
  Linking,
  Dimensions,
  Modal,
  StatusBar,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { deleteItem, getItemById, getItems } from '../../../config/apiConfig';
import { useFocusEffect } from '@react-navigation/native';
import MapViewComponent from '../../../shared/utils/MapViewComponent';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';


const { width } = Dimensions.get('window');

const ItemDetailsScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  
  // Get the item from route params
  const { item: initialItem, itemId, itemUpdated, fromClaimRequest } = route.params || {};
  
  // Local state to store the item data (so we can update it)
  const [item, setItem] = useState(initialItem || null);
  const [loading, setLoading] = useState(!initialItem && itemId ? true : false);
  
  // State for image viewer and loading states
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [canEditDelete, setCanEditDelete] = useState(false);
  
  const { alertConfig, showError, showSuccess, showConfirm, hideAlert } = useProfessionalAlert();
  
  const styles = createStyles(insets);
  
  // Helper function to parse JSON strings from API response
  const parseItemData = (item) => {
    const parsedItem = { ...item };
    
    // Parse detected_categories if it exists and is a string
    if (item.detected_categories && typeof item.detected_categories === 'string') {
      try {
        parsedItem.categories = JSON.parse(item.detected_categories);
      } catch (e) {
        console.log('Error parsing detected_categories:', e);
        parsedItem.categories = [];
      }
    } else {
      parsedItem.categories = item.categories || [];
    }
    
    // Parse detected_objects if it exists and is a string
    if (item.detected_objects && typeof item.detected_objects === 'string') {
      try {
        parsedItem.detectedObjects = JSON.parse(item.detected_objects);
      } catch (e) {
        console.log('Error parsing detected_objects:', e);
        parsedItem.detectedObjects = [];
      }
    } else {
      parsedItem.detectedObjects = item.detectedObjects || [];
    }
    
    return parsedItem;
  };

  // Fetch item data if only itemId is provided (from deep linking)
  useEffect(() => {
    const fetchItemData = async () => {
      if (itemId && !item) {
        try {
          setLoading(true);
          const foundItem = await getItemById(itemId);
          
          if (foundItem) {
            // Parse the item data to handle JSON strings
            const parsedItem = parseItemData(foundItem);
            setItem(parsedItem);
          } else {
            // Item not found, show error and navigate back
            showError(
              'Item Not Found',
              'The requested item could not be found.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        } catch (error) {
          console.error('Error fetching item data:', error);
          showError(
            'Error',
            'Failed to load item details.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchItemData();
  }, [itemId, item]);

  // Fetch current user data when component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      if (!item) return; // Don't fetch user data if item is not loaded yet
      
      try {
        const userDataString = await AsyncStorage.getItem('user_data');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          setCurrentUser(userData);
          
          // Check if current user is the reporter of this item
          if (userData.email && (item.reporter_id === userData.email || item.reporterId === userData.email)) {
            setCanEditDelete(true);
          } else {
            setCanEditDelete(false);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    
    fetchUserData();
    
    // Debug: Log item coordinates when component loads
    if (item) {
      console.log('ItemDetailsScreen - Item latitude:', item.latitude, 'longitude:', item.longitude);
    }
  }, [item]);
  
  // SSC Office coordinates (13°24'23.2"N 123°22'31.4"E)
  // Convert from DMS to decimal degrees
  const latitude = 13 + (24/60) + (23.2/3600);  // 13.406444
  const longitude = 123 + (22/60) + (31.4/3600);  // 123.375389
  
  // Update local item state when receiving updates from edit screen
  React.useEffect(() => {
    console.log('ItemDetailsScreen - Route params changed:', {
      item: route.params?.item,
      itemUpdated: route.params?.itemUpdated,
      itemId: route.params?.itemId
    });
    if (route.params?.item && route.params?.itemUpdated) {
      console.log('ItemDetailsScreen - Updating item from route params:', route.params.item);
      // Parse the item data to handle JSON strings
      const parsedItem = parseItemData(route.params.item);
      setItem(parsedItem);
    }
  }, [route.params?.item, route.params?.itemUpdated, route.params?.itemId]);

  // Refresh item data when screen comes into focus (e.g., after editing)
  useFocusEffect(
    React.useCallback(() => {
      const refreshItemData = async () => {
        console.log('ItemDetailsScreen - useFocusEffect triggered, current item:', item);
        if (item && item.id) {
          try {
            console.log('ItemDetailsScreen - Fetching fresh data from API...');
            const updatedItem = await getItemById(item.id);
            console.log('ItemDetailsScreen - Found updated item:', updatedItem);
            if (updatedItem) {
              // Parse the item data to handle JSON strings
              const parsedItem = parseItemData(updatedItem);
              console.log('ItemDetailsScreen - Setting parsed updated item:', parsedItem);
              setItem(parsedItem);
            }
          } catch (error) {
            console.error('Error refreshing item data:', error);
          }
        }
      };
      
      refreshItemData();
    }, [item?.id])
  );
  
  // Format date to a readable string
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Share item details
  const handleShare = async () => {
    try {
      const message = `${item.type === 'lost' ? 'Lost' : 'Found'} Item: ${item.title || item.categories?.[0] || 'Item'}\nDescription: ${item.description || ''}\nDate: ${formatDate(item.date)}\nLocation: ${item.location || ''}\n\nIf you found this item or have information about it, please contact the reporter through the Lost & Found CSPC app.`;
      
      if (item.image_url && item.image_url.length > 0) {
        // Share image with text caption
        await Share.share({
          message: message,
          url: item.image_url,
          title: 'Lost & Found Item'
        });
      } else {
        // Share text only if no image
        await Share.share({
          message: message,
          title: 'Lost & Found Item'
        });
      }
    } catch (error) {
      console.error('Error sharing item:', error);
      showError('Error', 'Failed to share item. Please try again.');
    }
  };

  // Open maps app with office location
  const openMapsApp = () => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${latitude},${longitude}`;
    const label = 'Supreme Student Council Office';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    
    Linking.openURL(url);
  };
  
  // Delete handler implementation
  const handleDelete = async () => {
    try {
      // Show loading indicator
      setIsDeleting(true);
      
      // Get current user email for authorization
      if (!currentUser || !currentUser.email) {
        showError('Error', 'User authentication required to delete item.');
        return;
      }
      
      // Delete the item using API with user email for authorization
      const success = await deleteItem(item.id, currentUser.email);
      
      if (success) {
        // Show success message
        showSuccess(
          'Item Deleted',
          'The item has been successfully deleted.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                // Navigate back to the home screen
                navigation.navigate('Main', { 
                  screen: 'Home', 
                  params: { 
                    itemDeleted: true, 
                    deletedItemId: item.id 
                  }
                });
              }
            }
          ]
        );
      } else {
        throw new Error('Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      // Show more specific error message if available
      const errorMessage = error.message.includes('You can only delete items that you reported') 
        ? 'You can only delete items that you reported.'
        : error.message.includes('User email is required')
        ? 'Authentication required to delete item.'
        : 'An unexpected error occurred. Please try again.';
      showError('Error', errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Show loading state when fetching item data from deep link
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              // Check if we came from EditItem or other specific screens
              if (route.params?.fromEdit || route.params?.itemUpdated) {
                // Navigate back to Home screen in Main tab
                navigation.navigate('Main', { screen: 'Home' });
              } else {
                // Normal back navigation
                navigation.goBack();
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Item Details</Text>
          <View style={styles.shareButton} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3266a8" />
          <Text style={styles.loadingText}>Loading item details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state if item not found
  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Item Details</Text>
          <View style={styles.shareButton} />
        </View>
        
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ff3b30" />
          <Text style={styles.errorTitle}>Item Not Found</Text>
          <Text style={styles.errorText}>The item you're looking for could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            // Check if we came from EditItem or other specific screens
            if (route.params?.fromEdit || route.params?.itemUpdated) {
              // Navigate back to Home screen in Main tab
              navigation.navigate('Main', { screen: 'Home' });
            } else {
              // Normal back navigation
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Item Details</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageContainer}>
          {item.image_url && item.image_url.trim() !== '' ? (
            <TouchableOpacity 
              activeOpacity={0.9}
              onPress={() => setImageViewerVisible(true)}
            >
              <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="contain" />
              <View style={styles.imageOverlay}>
                <Ionicons name="expand-outline" size={24} color="#fff" />
                <Text style={styles.imageOverlayText}>Tap to enlarge</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.image, styles.placeholderImage]}>
              <Ionicons name="image-outline" size={64} color="#ccc" />
              <Text style={styles.placeholderText}>No Image Available</Text>
            </View>
          )}
          <View style={[styles.badgeOverlay, item.type === 'lost' ? styles.lostBadgeOverlay : styles.foundBadgeOverlay]}>
            <Ionicons name={item.type === 'lost' ? "alert-circle-outline" : "checkmark-circle-outline"} size={18} color="#fff" style={{marginRight: 6}} />
            <Text style={styles.badgeOverlayText}>{item.type === 'lost' ? 'LOST' : 'FOUND'}</Text>
          </View>
        </View>
        
        <View style={styles.infoContainer}>
                    <View style={styles.card}>
            <Text style={styles.sectionTitle}>Title of the item</Text>
            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="pricetag" size={18} color="#3266a8" />
              </View>
              <Text style={styles.infoText}>
                {item.title || `${item.type === 'lost' ? 'Lost' : 'Found'} ${item.categories?.[0] || 'Item'}`}
              </Text>
            </View>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Date and Location</Text>
            <View style={styles.dateLocationContainer}>
              <View style={styles.infoRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="calendar-outline" size={18} color="#3266a8" />
                </View>
                <Text style={styles.infoText}>
                  {formatDate(item.date || item.createdAt || new Date())}
                </Text>
              </View>
              
              {item.location && (
                <View style={styles.locationSection}>
                  <View style={styles.infoRow}>
                    <View style={styles.iconContainer}>
                      <Ionicons name="location-outline" size={18} color="#3266a8" />
                    </View>
                    <View style={styles.locationTextContainer}>
                      <Text style={styles.infoText}>{item.location}</Text>
                      {item.latitude && item.longitude && (
                        <Text style={styles.coordinatesText}>
                          {`${parseFloat(item.latitude).toFixed(6)}, ${parseFloat(item.longitude).toFixed(6)}`}
                        </Text>
                      )}
                    </View>
                  </View>
                  {item.latitude && item.longitude && (
                    <View style={styles.mapContainer}>
                      <MapViewComponent
                        latitude={parseFloat(item.latitude)}
                        longitude={parseFloat(item.longitude)}
                        title={item.title || 'Item Location'}
                        description={item.location}
                        height={200}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
          
          {item.categories && item.categories.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Categories</Text>
              <View style={styles.categories}>
                {item.categories.map((category, index) => (
                  <View key={index} style={styles.category}>
                    <Ionicons name="pricetag-outline" size={14} color="#3266a8" style={{marginRight: 4}} />
                    <Text style={styles.categoryText}>{category}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          {item.detectedObjects && item.detectedObjects.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Detected Objects</Text>
              <View style={styles.detectedObjects}>
                {item.detectedObjects.slice(0, 5).map((obj, index) => (
                  <View key={index} style={styles.detectedObject}>
                    <Ionicons name="eye-outline" size={14} color="#3266a8" style={{marginRight: 4}} />
                    <Text style={styles.detectedObjectText}>{obj.displayName || obj.name}</Text>
                    <Text style={styles.confidenceText}>{Math.round(obj.confidence * 100)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>
              {item.description || 'No description provided'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Reported By</Text>
            <View style={styles.reporterInfo}>
              <View style={styles.reporterRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="person-circle-outline" size={18} color="#3266a8" />
                </View>
                <Text style={styles.infoText}>
                  {item.reporter_name || 'CSPC Student'}
                </Text>
              </View>
              
              {/* Google Account Email */}
              <View style={styles.reporterRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="mail-outline" size={18} color="#3266a8" />
                </View>
                <Text style={styles.infoText}>
                  {item.reporter_email || 'No email provided'}
                </Text>
              </View>
              
              {item.reporter_department && (
                <View style={styles.reporterRow}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="business-outline" size={18} color="#3266a8" />
                  </View>
                  <Text style={styles.infoText}>{item.reporter_department || 'IT Department'}</Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.contactReporterButton}
                onPress={() => {
                  // In a real app, this would show contact options or initiate contact
                  const email = item.reporter_email || 'support@my.cspc.edu.ph';
                  showConfirm(
                    'Contact Reporter',
                    `Would you like to contact ${item.reporter_name || 'the reporter'} about this item?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Email', 
                        onPress: () => Linking.openURL(`mailto:${email}?subject=Regarding your ${item.type} item on CSPC Lost & Found`) 
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="mail-outline" size={16} color="#fff" style={{marginRight: 6}} />
                <Text style={styles.contactButtonText}>Contact Reporter</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.reminderCard}>
            <View style={styles.reminderHeader}>
              <Ionicons name="alert-circle" size={24} color="#fff" />
              <Text style={styles.reminderTitle}>Important Reminder</Text>
            </View>
            
            <View style={styles.reminderContent}>
              <View style={styles.reminderItem}>
                <Ionicons name="information-circle" size={22} color="#007aff" style={styles.reminderIcon} />
                <Text style={styles.reminderText}>
                  You must turn in the found item to the SSC Admin Office in order to keep the campus lost and found system working effectively.
                </Text>
              </View>
              
              <View style={styles.reminderItem}>
                <Ionicons name="warning-outline" size={22} color="#ff9500" style={styles.reminderIcon} />
                <Text style={styles.reminderText}>
                  Items not turned in cannot be properly tracked or returned to their owners.
                </Text>
              </View>
              
              <View style={styles.locationContainer}>
                <View style={styles.locationHeader}>
                  <Ionicons name="navigate-circle-outline" size={20} color="#007aff" />
                  <Text style={styles.locationTitle}>Drop-off Location:</Text>
                </View>
                <TouchableOpacity 
                  style={styles.locationInfo}
                  onPress={openMapsApp}
                  activeOpacity={0.7}
                >
                  <Ionicons name="location-outline" size={18} color="#007aff" style={{marginRight: 8}} />
                  <View style={styles.locationTextContainer}>
                    <Text style={styles.locationText}>SSC Admin Office</Text>
                    <Text style={styles.coordinatesText}>13°24'23.2"N 123°22'31.4"E</Text>
                  </View>
                  <Ionicons name="navigate" size={18} color="#007aff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      
      {/* Image Viewer with zoom capability */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <StatusBar backgroundColor="#000" barStyle="light-content" />
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setImageViewerVisible(false)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.imageViewerContainer}>
            <Image 
              source={{ uri: item.image_url && item.image_url.trim() !== '' ? item.image_url : null }} 
              style={styles.fullImage} 
              resizeMode="contain" 
            />
          </View>
        </View>
      </Modal>
      {canEditDelete && !fromClaimRequest ? (
        <View style={styles.editDeleteContainer}>
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => navigation.navigate('EditItem', { item })}
          >
            <Ionicons name="create-outline" size={20} color="#fff" style={{marginRight: 8}} />
            <Text style={styles.editDeleteButtonText}>Edit Item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.notYourItemContainer}>
          <Text style={styles.notYourItemText}>
            <Ionicons name="information-circle" size={16} /> {fromClaimRequest ? 'Edit options are not available in claim request view' : 'Only the person who reported this item can edit it'}
          </Text>
        </View>
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

const createStyles = (insets) => StyleSheet.create({
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlayText: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: width,
    height: width * 1.5,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 8,
  },
  editDeleteContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Math.max(16, insets?.bottom || 0),
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  editButton: {
    flexDirection: 'row',
    backgroundColor: '#3266a8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  editDeleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  notYourItemContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: Math.max(16, insets?.bottom || 0),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  notYourItemText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  shareButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactReporterButton: {
    flexDirection: 'row',
    backgroundColor: '#3266a8',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    alignSelf: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  contactButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  reporterInfo: {
    borderRadius: 8,
    padding: 4,
    marginTop: 8,
  },
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop:32,
    backgroundColor: '#3266a8',
    elevation: 3,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 1.5, // Fixed padding for edit/delete buttons + some breathing room
  },
  image: {
    width: '100%',
    height: 300,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 10,
    color: '#ccc',
    fontSize: 16,
  },
  infoContainer: {
    padding: 16,
    paddingTop: 0,
  },
  titleRow: {
    marginBottom: 16,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
  },
  titleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3266a8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    lineHeight: 32,
  },
  badgeOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  lostBadgeOverlay: {
    backgroundColor: '#ff3b30F2',
  },
  foundBadgeOverlay: {
    backgroundColor: '#34c759F2',
  },
  badgeOverlayText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  dateLocationContainer: {
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    marginTop: 4,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3266a81A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
  },
  locationSection: {
    width: '100%',
  },
  mapContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3266a8',
    paddingLeft: 8,
  },
  description: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    textAlign: 'justify',
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  category: {
    backgroundColor: '#3266a81A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 13,
    color: '#3266a8',
    fontWeight: '500',
  },
  detectedObjects: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detectedObject: {
    backgroundColor: '#007aff1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detectedObjectText: {
    fontSize: 13,
    color: '#007aff',
    fontWeight: '500',
    marginRight: 6,
  },
  confidenceText: {
    fontSize: 11,
    color: '#666',
    fontWeight: 'bold',
    backgroundColor: '#007aff33',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginTop: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
  },
  reminderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reminderHeader: {
    backgroundColor: '#007aff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  reminderTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  reminderContent: {
    padding: 16,
  },
  reminderItem: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  reminderIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  reminderText: {
    fontSize: 15,
    color: '#2c3e50',
    flex: 1,
    lineHeight: 22,
  },
  locationContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginLeft: 6,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3266a80D',
    padding: 12,
    borderRadius: 6,
    marginLeft: 4,
    justifyContent: 'space-between',
  },
  locationTextContainer: {
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    color: '#3266a8',
    fontWeight: '500',
  },
  coordinatesText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButton: {
    backgroundColor: '#3266a8',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 2,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff3b30',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ItemDetailsScreen;
