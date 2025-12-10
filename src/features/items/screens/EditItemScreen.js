import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  ScrollView,
  Modal,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  ActivityIndicator,
  Linking,
  StatusBar,
  Animated,
  BackHandler
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { updateItem } from '../../../config/apiConfig';
import { getCurrentLocation, getAddressFromCoordinates, formatCoordinates } from '../../../shared/utils/locationUtils';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import ImagePickerComponent from '../components/ImagePickerComponent';


const EditItemScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { item } = route.params;
  console.log('EditItemScreen - item data:', item);
  console.log('EditItemScreen - item.coordinates:', item.coordinates);
  const { alertConfig, showError, showSuccess, hideAlert } = useProfessionalAlert();
  const styles = createStyles(insets);
  const [title, setTitle] = useState(item.title || '');
  const [description, setDescription] = useState(item.description || '');
  const [selectedDate, setSelectedDate] = useState(new Date(item.date || new Date()));
  const [location, setLocation] = useState(item.location || '');
  const [type, setType] = useState(item.type || 'lost');

  const [coordinates, setCoordinates] = useState(
    item.latitude && item.longitude 
      ? { latitude: parseFloat(item.latitude), longitude: parseFloat(item.longitude) }
      : null
  );
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);
  
  console.log('EditItemScreen - coordinates state:', coordinates);
  console.log('EditItemScreen - locationDetected state:', locationDetected);
  console.log('EditItemScreen - should show existing coords:', !locationDetected && coordinates);
  const [images, setImages] = useState(item.images || []);
  const [selectedImage, setSelectedImage] = useState(null);
  const [detectedCategories, setDetectedCategories] = useState(() => {
    if (!item.detected_categories) return [];
    if (typeof item.detected_categories === 'string') {
      try {
        return JSON.parse(item.detected_categories);
      } catch (e) {
        console.log('Error parsing detected_categories:', e);
        return [];
      }
    }
    return item.detected_categories;
  });
  const [detectedObjects, setDetectedObjects] = useState(() => {
    if (!item.detected_objects) return [];
    if (typeof item.detected_objects === 'string') {
      try {
        return JSON.parse(item.detected_objects);
      } catch (e) {
        console.log('Error parsing detected_objects:', e);
        return [];
      }
    }
    return item.detected_objects;
  });
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Form validation
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Animation for header
  const scrollY = new Animated.Value(0);
  const headerElevation = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [4, 8],
    extrapolate: 'clamp',
  });

  // Handle Android back button
  useEffect(() => {
    const backAction = () => {
      handleBackPress();
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, []);

  // Function to handle back navigation consistently
  const handleBackPress = () => {
    console.log('EditItemScreen - Back pressed, navigating back');
    navigation.goBack();
  };

  // Ensure screen state is clean when focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('EditItemScreen - Screen focused');
      return () => {
        console.log('EditItemScreen - Screen unfocused');
      };
    }, [])
  );

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Handle date change
  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || new Date();
    setShowDatePicker(Platform.OS === 'ios');
    setSelectedDate(currentDate);
  };
  
  // Detect current location
  const detectLocation = async () => {
    try {
      setDetectingLocation(true);
      
      const locationData = await getCurrentLocation();
      
      if (locationData) {
        const coords = {
          latitude: locationData.latitude,
          longitude: locationData.longitude
        };
        
        console.log('EditScreen - Location detected:', coords, 'Accuracy:', locationData.accuracy);
        setCoordinates(coords);
        
        // Get readable address
        const address = await getAddressFromCoordinates(
          locationData.latitude,
          locationData.longitude
        );
        
        setLocation(address);
        setLocationDetected(true);
      } else {
        // If location permission denied or error occurred
        showError(
          'Location Unavailable',
          'Unable to detect your current location. Please enter the location manually.'
        );
      }
    } catch (error) {
      console.error('Error detecting location:', error);
      showError('Error', 'Failed to detect location. Please try again or enter manually.');
    } finally {
      setDetectingLocation(false);
    }
  };



  // Handle image selection
  const handleImageSelected = (imageUri) => {
    setSelectedImage(imageUri);
    setImages([imageUri]); // Replace existing image with new one
  };

  // Handle AI-detected categories
  const handleCategoriesDetected = (detectedCategoriesArray) => {
    if (detectedCategoriesArray && detectedCategoriesArray.length > 0) {
      setDetectedCategories(detectedCategoriesArray);
    }
  };

  // Handle AI-detected objects (optional)
  const handleObjectsDetected = (detectedObjectsArray) => {
    if (detectedObjectsArray && detectedObjectsArray.length > 0) {
      setDetectedObjects(detectedObjectsArray);
    }
  };

  // Handle AI-generated description
  const handleDescriptionGenerated = (generatedDescription) => {
    if (generatedDescription) {
      setDescription(generatedDescription);
    }
  };

  // Validate form
  const validateForm = () => {
    let formErrors = {};
    
    if (!title.trim()) formErrors.title = 'Title is required';
    if (!location.trim()) formErrors.location = 'Location is required';
    if (!description.trim()) formErrors.description = 'Description is required';
    
    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  };

  const handleSave = async () => {
    if (validateForm()) {
      try {
        setIsSaving(true);
        
        // Create updated item object
        const updatedItem = {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          date_occurred: selectedDate.toISOString(),
          type,
          latitude: coordinates ? coordinates.latitude : null,
          longitude: coordinates ? coordinates.longitude : null,
          geotagged: locationDetected || (coordinates !== null),
          images: images.length > 0 ? images : item.images, // Use new images if selected, otherwise keep existing
          detected_categories: JSON.stringify(detectedCategories),
          detected_objects: JSON.stringify(detectedObjects)
        };
        
        // Save the updated item using API
        console.log('EditItemScreen - Saving updated item:', updatedItem);
        const result = await updateItem(item.id, updatedItem);
        console.log('EditItemScreen - Save result:', result);
        
        if (result) {
          // Merge the updated fields with the original item
          const completeUpdatedItem = {
            ...item,
            ...updatedItem,
            id: item.id // Ensure ID is preserved
          };
          
          // Show success message
          showSuccess('Success', 'Item updated successfully!', [
            {
              text: 'OK',
              onPress: () => {
                console.log('EditItemScreen - Going back to ItemDetailsScreen');
                handleBackPress();
              }
            }
          ]);
        } else {
          throw new Error('Failed to update item');
        }
      } catch (error) {
        console.error('Error saving item:', error);
        showError('Error', 'An unexpected error occurred. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#3266a8" />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : null}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <Animated.View style={[styles.header, { elevation: headerElevation }]}>
          <View style={styles.headerBackground} />
          <LinearGradient
            colors={['#3266a8', '#2a5490']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          >
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBackPress}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerTitleContent}>
                <Ionicons name="create-outline" size={22} color="#fff" style={styles.headerIcon} />
                <Text style={styles.headerTitle}>Edit Item</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
        
        <Animated.ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.formContainer}>
            <Text style={styles.label}>Change Title:</Text>
            <TextInput
              style={[styles.input, errors.title ? styles.inputError : null]}
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
            
            <Text style={styles.label}>Change Item Type:</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity 
                style={[styles.typeOption, type === 'lost' ? styles.typeLostSelected : null]}
                onPress={() => setType('lost')}
              >
                <Ionicons name="alert-circle-outline" size={18} color={type === 'lost' ? '#fff' : '#e74c3c'} style={{marginRight: 6}} />
                <Text style={[styles.typeText, type === 'lost' ? styles.typeTextSelected : styles.typeLostText]}>Lost</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.typeOption, type === 'found' ? styles.typeFoundSelected : null]}
                onPress={() => setType('found')}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={type === 'found' ? '#fff' : '#27ae60'} style={{marginRight: 6}} />
                <Text style={[styles.typeText, type === 'found' ? styles.typeTextSelected : styles.typeFoundText]}>Found</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.sectionTitle}> Change Image of a Item:</Text>
            <ImagePickerComponent
              onImageSelected={handleImageSelected}
              onCategoriesDetected={handleCategoriesDetected}
              onObjectsDetected={handleObjectsDetected}
              onDescriptionGenerated={handleDescriptionGenerated}
            />
            
            <Text style={styles.sectionTitle}>Date and Location</Text>
            <Text style={styles.label}>Change Date:</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={'#3266a8'} style={{marginRight: 8}} />
              <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
            </TouchableOpacity>
            
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}
            
            <Text style={styles.label}>Change Location:</Text>
            <View style={styles.locationInputContainer}>
              <TextInput
                style={[styles.locationInput, errors.location ? styles.inputError : null]}
                value={location}
                editable={false}
                placeholder="Tap 'Detect' to get location"
              />
              <TouchableOpacity 
                style={styles.detectButton} 
                onPress={detectLocation}
                disabled={detectingLocation}
              >
                {detectingLocation ? (
                  <ActivityIndicator size="small" color={'#fff'} />
                ) : (
                  <Text style={styles.detectButtonText}>Detect</Text>
                )}
              </TouchableOpacity>
            </View>
            {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
            
            {locationDetected && coordinates && (
              <View style={styles.detectedLocationContainer}>
                <Text style={styles.coordinatesText}>
                  {formatCoordinates(coordinates.latitude, coordinates.longitude)}
                </Text>
                <TouchableOpacity 
                  onPress={() => {
                    setLocationDetected(false);
                    setCoordinates(null);
                  }}
                >
                  <Ionicons name="close-circle" size={18} color={'#666'} />
                </TouchableOpacity>
              </View>
            )}
            
            {!locationDetected && coordinates && (
              <>
                <Text style={styles.label}>Existing Coordinates:</Text>
                <View style={styles.detectedLocationContainer}>
                  <Ionicons name="location-outline" size={16} color={'#3266a8'} style={{marginRight: 8}} />
                  <Text style={styles.coordinatesText}>
                    {formatCoordinates(coordinates.latitude, coordinates.longitude)}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setCoordinates(null);
                    }}
                    style={styles.removeDetectedButton}
                  >
                    <Ionicons name="close-circle" size={16} color={'#666'} />
                  </TouchableOpacity>
                </View>
              </>
            )}
            
            {detectedCategories.length > 0 && (
              <>
                <Text style={styles.label}>Detected Categories:</Text>
                <View style={styles.detectedContainer}>
                  {detectedCategories.map((category, index) => (
                    <View key={index} style={styles.detectedCategoryTag}>
                      <Ionicons name="pricetag-outline" size={14} color={'#3266a8'} style={{marginRight: 4}} />
                      <Text style={styles.detectedCategoryText}>{category}</Text>
                      <TouchableOpacity 
                        onPress={() => {
                          const newCategories = detectedCategories.filter((_, i) => i !== index);
                          setDetectedCategories(newCategories);
                        }}
                        style={styles.removeDetectedButton}
                      >
                        <Ionicons name="close-circle" size={16} color={'#666'} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </>
            )}
            
            {detectedObjects.length > 0 && (
              <>
                <Text style={styles.label}>Detected Objects:</Text>
                <View style={styles.detectedContainer}>
                  {detectedObjects.map((obj, index) => (
                    <View key={index} style={styles.detectedObjectTag}>
                      <Ionicons name="eye-outline" size={14} color={'#3266a8'} style={{marginRight: 4}} />
                      <Text style={styles.detectedObjectText}>{obj.displayName || obj.name || obj}</Text>
                      {obj.confidence && (
                        <Text style={styles.confidenceText}>{Math.round(obj.confidence * 100)}%</Text>
                      )}
                      <TouchableOpacity 
                        onPress={() => {
                          const newObjects = detectedObjects.filter((_, i) => i !== index);
                          setDetectedObjects(newObjects);
                        }}
                        style={styles.removeDetectedButton}
                      >
                        <Ionicons name="close-circle" size={16} color={'#666'} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </>
            )}
            
            <Text style={styles.label}>Change Description of a Item:</Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.description ? styles.inputError : null]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              multiline
              textAlignVertical="top"
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={handleBackPress}
          disabled={isSaving}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={'#fff'} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
      
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
  safeArea: {
    flex: 1,
    backgroundColor: '#3266a8',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#f8f9fa',
    paddingTop: insets?.top || 30,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8f9fa',
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  backButton: {
    padding: 4,
    marginRight: 10,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 34, // Compensate for back button width
  },
  headerTitleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 109, // Space for the header
    paddingBottom: 0.7, // Space for button container + breathing room
  },
  formContainer: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#2c3e50',
    letterSpacing: 0.3,
    textAlign:'center'
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 16,
    color: '#1a252f',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    color: '#2c3e50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  textArea: {
    minHeight: 100,
    maxHeight: 600,
  },
  locationInputContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  locationInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    marginRight: 12,
    color: '#6c757d',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  detectButton: {
    backgroundColor: '#3266a8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3266a8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  detectButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  detectedLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3266a8',
  },
  coordinatesText: {
    color: '#3266a8',
    fontSize: 14,
    flex: 1,
  },
  inputError: {
    borderColor: '#ff3b30',
    borderWidth: 1,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    marginBottom: 8,
    marginTop: -8,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  typeLostSelected: {
    backgroundColor: '#e74c3c',
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  typeFoundSelected: {
    backgroundColor: '#27ae60',
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  typeText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  typeLostText: {
    color: '#e74c3c',
    fontWeight: '600',
    fontSize: 14,
  },
  typeFoundText: {
    color: '#27ae60',
    fontWeight: '600',
    fontSize: 14,
  },
  typeTextSelected: {
    color: '#fff',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dateText: {
    fontSize: 16,
    color: '#2c3e50',
  },

  detectedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  detectedCategoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  detectedCategoryText: {
    color: '#3266a8',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  detectedObjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  detectedObjectText: {
    color: '#3266a8',
    fontSize: 13,
    fontWeight: '500',
    marginRight: 6,
  },
  confidenceText: {
    fontSize: 11,
    color: '#666',
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
  },
  removeDetectedButton: {
    padding: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Math.max(20, insets?.bottom || 0),
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  saveButton: {
    backgroundColor: '#3266a8',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
    shadowColor: '#3266a8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    flex: 1,
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default EditItemScreen;
