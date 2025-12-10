import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Pressable,
  Linking,
  StatusBar,
  Animated,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import ImagePickerComponent from '../components/ImagePickerComponent';
import { createItem, getItems, API_CONFIG, getApiUrl } from '../../../config/apiConfig';
import { checkAndUpdateAchievements } from '../../../shared/utils/achievementSystem';
import { runMatchingProcess, runImmediateMatching } from '../../matching/services/matchingService';
import { getCurrentLocation, getAddressFromCoordinates, formatCoordinates } from '../../../shared/utils/locationUtils';
import { useFocusEffect } from '@react-navigation/native';
import MapViewComponent from '../../../shared/utils/MapViewComponent';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';
import { requireInternet } from '../../../shared/utils/internetRequired';
import imageFilteringService from '../../../shared/services/imageFilteringService';


const ReportItemScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState('lost'); // 'lost' or 'found'
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [categories, setCategories] = useState([]);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const { alertConfig, showError, showSuccess, showConfirm, hideAlert } = useProfessionalAlert();
  const [coordinates, setCoordinates] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [recentReportsCount, setRecentReportsCount] = useState(0);
  const [isSpamDetected, setIsSpamDetected] = useState(false);
  const [accountViolations, setAccountViolations] = useState(0);
  const [turnInDeadline, setTurnInDeadline] = useState(null);
  const [similarItems, setSimilarItems] = useState([]);
  const [hasSimilarItems, setHasSimilarItems] = useState(false);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const scrollY = new Animated.Value(0);
  
  // Animation for header
  const headerElevation = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 5],
    extrapolate: 'clamp',
  });
  
  const styles = createStyles(insets);  
  // Fetch user data when component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDataString = await AsyncStorage.getItem('user_data');
        if (userDataString) {
          const parsedUserData = JSON.parse(userDataString);
          setUserData(parsedUserData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    
    fetchUserData();
  }, []);
  
  // SSC Office coordinates (13°24'23.2"N 123°22'31.4"E)
  // Convert from DMS to decimal degrees
  const latitude = 13 + (24/60) + (23.2/3600);  // 13.406444
  const longitude = 123 + (22/60) + (31.4/3600);  // 123.375389
  
  const handleImageSelected = (uri) => {
    setImageUri(uri);
    // Reset AI-generated flag when new image is selected
    setIsAiGenerated(false);
  };

  // Reset form function - clears all inputs and image
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setSelectedDate(new Date());
    setImageUri(null);
    setCategories([]);
    setDetectedObjects([]);
    setCoordinates(null);
    setLocationDetected(false);
    setIsAiGenerated(false);
    setIsSpamDetected(false);
    setTurnInDeadline(null);
    setSimilarItems([]);
    setHasSimilarItems(false);
    setCheckingSimilar(false);
    // Reset type to 'lost' as default
    // setType('lost'); // Uncomment if you want to reset type too
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
  
  // Calculate similarity between two location strings
  const calculateLocationSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    
    const words1 = str1.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const words2 = str2.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    let matchCount = 0;
    for (const word of words1) {
      if (words2.some(w => w.includes(word) || word.includes(w))) {
        matchCount++;
      }
    }
    
    const maxLength = Math.max(words1.length, words2.length);
    return maxLength === 0 ? 0 : matchCount / maxLength;
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
        
        console.log('Location detected:', coords, 'Accuracy:', locationData.accuracy);
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
  
  const handleCategoriesDetected = (detectedCategories) => {
    setCategories(detectedCategories);
  };
  
  const handleObjectsDetected = (objects) => {
    setDetectedObjects(objects);
  };
  
  const handleDescriptionGenerated = (generatedDescription) => {
    // Always update description with new AI-generated content when image changes
    setDescription(generatedDescription);
    setIsAiGenerated(true);
  };

  // Check for similar items already in the system
  const checkForSimilarItems = async () => {
    if (!imageUri || !categories || categories.length === 0) {
      setSimilarItems([]);
      setHasSimilarItems(false);
      return;
    }

    try {
      setCheckingSimilar(true);

      // Get all items of the same type
      const allItems = await getItems({ type: type });
      
      if (!allItems || allItems.length === 0) {
        setSimilarItems([]);
        setHasSimilarItems(false);
        return;
      }

      console.log(`Checking ${allItems.length} items for image similarity...`);

      // Filter items by category first (fast pre-filter)
      const categoryMatchedItems = allItems.filter(item => {
        const itemCategories = item.detected_categories 
          ? JSON.parse(item.detected_categories) 
          : [item.category];
        
        return categories.some(cat => 
          itemCategories.some(ic => ic.toLowerCase() === cat.toLowerCase())
        );
      }).filter(item => {
        // Only include items with images
        if (!item.images) return false;
        try {
          const images = typeof item.images === 'string' ? JSON.parse(item.images) : item.images;
          return Array.isArray(images) ? images.length > 0 : !!images;
        } catch (e) {
          return false;
        }
      });

      console.log(`${categoryMatchedItems.length} items match category and have images`);

      // Limit to top 10 most recent items for faster comparison
      const itemsToCheck = categoryMatchedItems.slice(0, 10);

      // Process comparisons in parallel batches of 3
      const batchSize = 3;
      const potentialDuplicates = [];

      for (let i = 0; i < itemsToCheck.length; i += batchSize) {
        const batch = itemsToCheck.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(async (item) => {
            let similarityScore = 40; // Category already matched
            const matches = ['Same category'];

            // Get the first image from the existing item
            let existingItemImage = null;
            try {
              const images = typeof item.images === 'string' ? JSON.parse(item.images) : item.images;
              existingItemImage = Array.isArray(images) ? images[0] : images;
            } catch (e) {
              return null;
            }

            if (!existingItemImage) return null;

            // Compare images
            const comparisonResult = await imageFilteringService.compareImageSimilarity(
              imageUri,
              existingItemImage
            );

            if (comparisonResult.success) {
              const imagePoints = Math.round((comparisonResult.similarityScore / 100) * 60);
              similarityScore += imagePoints;
              
              matches.push(`${comparisonResult.similarityScore}% image similarity`);
              
              if (comparisonResult.matchingFeatures && comparisonResult.matchingFeatures.length > 0) {
                matches.push(`Matching: ${comparisonResult.matchingFeatures.join(', ')}`);
              }
              
              console.log(`Item ${item.id}: Image = ${comparisonResult.similarityScore}%, Total = ${similarityScore}`);

              // Return if score is 75% or higher
              if (similarityScore >= 75) {
                return {
                  ...item,
                  matchScore: similarityScore,
                  matchReasons: matches,
                  item_name: item.title || item.item_name
                };
              }
            }

            return null;
          })
        );

        // Add valid results to potentialDuplicates
        batchResults.forEach(result => {
          if (result) potentialDuplicates.push(result);
        });

        // Early exit if we found duplicates
        if (potentialDuplicates.length > 0) {
          console.log(`Found ${potentialDuplicates.length} duplicates, stopping search`);
          break;
        }
      }

      // Sort by similarity score (highest first)
      potentialDuplicates.sort((a, b) => b.matchScore - a.matchScore);

      // Take top 5 most similar items
      const topSimilar = potentialDuplicates.slice(0, 5);

      setSimilarItems(topSimilar);
      setHasSimilarItems(topSimilar.length > 0);

      console.log(`Found ${topSimilar.length} similar items with scores:`, 
        topSimilar.map(i => ({ name: i.item_name, score: i.matchScore }))
      );

    } catch (error) {
      console.error('Error checking for similar items:', error);
      setSimilarItems([]);
      setHasSimilarItems(false);
    } finally {
      setCheckingSimilar(false);
    }
  };

  // Check for similar items when image or category changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (imageUri && categories.length > 0) {
        checkForSimilarItems();
      }
    }, 2000); // Debounce for 2 seconds (image comparison takes longer)

    return () => clearTimeout(timer);
  }, [imageUri, categories, type]);



  // Check for spam/fake report patterns
  const detectFakeReport = () => {
    const spamKeywords = [
      'test', 'testing', 'spam', 'fake', 'dummy', 'asdf', 'qwerty',
      'lorem ipsum', '123', 'abc', 'sample', 'example', 'demo'
    ];

    const content = `${title} ${description}`.toLowerCase();

    // Check for spam keywords
    const hasSpamKeywords = spamKeywords.some(keyword => content.includes(keyword));

    // Check for repeated characters (e.g., "aaaaaaa", "111111")
    const hasRepeatedChars = /(.)\1{5,}/.test(content);

    // Check for very short content with no meaningful info
    const isVeryShort = content.trim().length < 10;

    // Check for excessive punctuation
    const punctuationCount = (content.match(/[!?.,;:]{3,}/g) || []).length;
    const hasExcessivePunctuation = punctuationCount > 2;

    // Check for random character sequences
    const hasRandomSequence = /[a-z]{15,}/.test(content) && !/\s/.test(content);

    return hasSpamKeywords || hasRepeatedChars || hasExcessivePunctuation || hasRandomSequence;
  };

  // Check user's recent report frequency
  const checkReportFrequency = async () => {
    if (!userData || !userData.email) return 0;

    try {
      // Get all items reported by this user
      const userItems = await getItems({ reporter_email: userData.email });
      
      if (!userItems || userItems.length === 0) return 0;

      // Count reports in the last 5 minutes (300000ms)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentReports = userItems.filter(item => {
        const reportDate = new Date(item.date_reported || item.created_at);
        return reportDate > fiveMinutesAgo;
      });

      const count = recentReports.length;
      setRecentReportsCount(count);

      console.log(`User has submitted ${count} reports in the last 5 minutes`);
      return count;
    } catch (error) {
      console.error('Error checking report frequency:', error);
      return 0;
    }
  };

  // Track user violation
  const trackViolation = async (violationType, reason) => {
    if (!userData || !userData.email) return;

    try {
      const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.USER_VIOLATION(userData.email)), {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({
          user_email: userData.email,
          violation_type: violationType,
          reason: reason,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        const violationCount = data.totalViolations || 0;
        setAccountViolations(violationCount);

        console.log(`⚠️ Violation tracked: ${violationType} - Total: ${violationCount}`);

        // Check if account should be deactivated
        if (violationCount >= 3) {
          await deactivateAccount(violationCount, reason);
        }
      }
    } catch (error) {
      console.error('Error tracking violation:', error);
    }
  };

  // Deactivate user account
  const deactivateAccount = async (violationCount, lastReason) => {
    if (!userData || !userData.email) return;

    try {
      // Update user status to deactivated
      const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.USER_STATUS(userData.email)), {
        method: 'PUT',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({
          status: 'deactivated',
          deactivation_reason: `Multiple violations (${violationCount}): ${lastReason}`,
          deactivated_at: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log('🚫 Account deactivated due to violations');
        
        // Show detailed deactivation notice
        showError(
          '🚫 Account Deactivated',
          `Your account has been deactivated due to multiple violations.\n\n` +
          `Violation Count: ${violationCount}\n` +
          `Recent Violation: ${lastReason}\n\n` +
          `Reasons for Deactivation:\n` +
          `• Submitting fake or spam reports\n` +
          `• Excessive report submissions (more than 5 in 5 minutes)\n` +
          `• Attempting to abuse the Lost & Found system\n\n` +
          `To reactivate your account, please contact the SSC office with your student ID and email. ` +
          `You must provide a valid explanation for your actions.\n\n` +
          `SSC Office: Supreme Student Council\n` +
          `Contact: lostfoundcspc@gmail.com\n`,
          [
            {
              text: 'Understood',
              onPress: () => {
                // Log out user
                AsyncStorage.removeItem('user_data').then(() => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                });
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error deactivating account:', error);
    }
  };

  // Check for violations on mount
  useEffect(() => {
    const checkViolations = async () => {
      if (userData && userData.email) {
        try {
          const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.USER_VIOLATIONS(userData.email)), {
            method: 'GET',
            headers: API_CONFIG.HEADERS
          });

          if (response.ok) {
            const data = await response.json();
            const violations = data.violations || [];
            setAccountViolations(violations.length);

            // Check if user is already deactivated
            if (violations.length >= 3) {
              showError(
                '🚫 Account Deactivated',
                `Your account is currently deactivated due to ${violations.length} violations. ` +
                `Please contact the SSC office to appeal this decision.`,
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack()
                  }
                ]
              );
            }
          }
        } catch (error) {
          console.error('Error checking violations:', error);
        }
      }
    };

    checkViolations();
  }, [userData]);
  
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

  const validateForm = () => {
    let isValid = true;
    let errorMessage = '';

    if (!description.trim()) {
      errorMessage += '• Please provide a description of the item.\n';
      isValid = false;
    }
    
    if (categories.length === 0) {
      errorMessage += '• Please add an image so we can automatically detect the item category.\n';
      isValid = false;
    }

    if (!location.trim()) {
      errorMessage += '• Please specify where the item was ' + (type === 'lost' ? 'lost' : 'found') + '.\n';
      isValid = false;
    }
    
    if (!isValid) {
      showError('Missing Information', errorMessage.trim());
    }
    
    return isValid;
  };
  
  const checkForMatches = async (newItem, itemType) => {
    try {
      // Run immediate matching for the newly reported item
      const { newMatchesCount } = await runImmediateMatching(newItem, itemType);
      return newMatchesCount;
    } catch (error) {
      console.error('Error checking for matches:', error);
      return 0;
    }
  };
  
  const handleSubmit = async () => {
    // Check internet connection first
    const hasInternet = await requireInternet('report an item');
    if (!hasInternet) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Check for fake/spam report patterns
    const isFake = detectFakeReport();
    if (isFake) {
      setIsSpamDetected(true);
      await trackViolation('spam_report', 'Submitted fake or spam report content');
      
      showError(
        '⚠️ Spam Report Detected',
        `Your report has been flagged as potential spam or fake content.\n\n` +
        `Warning #${accountViolations + 1}/3\n\n` +
        `This violation has been recorded. If you continue to submit fake reports, your account will be deactivated.\n\n` +
        `Reasons for detection:\n` +
        `• Use of spam keywords (test, fake, dummy, etc.)\n` +
        `• Repeated characters or random sequences\n` +
        `• Insufficient meaningful information\n\n` +
        `Please submit only legitimate lost and found items.`
      );
      return;
    }

    // Check report frequency (spam prevention)
    const recentCount = await checkReportFrequency();
    if (recentCount >= 5) {
      await trackViolation('excessive_reports', `Submitted ${recentCount} reports in 5 minutes`);
      
      showError(
        '🚫 Too Many Reports',
        `You have submitted ${recentCount} reports in the last 5 minutes.\n\n` +
        `Warning #${accountViolations + 1}/3\n\n` +
        `This appears to be spam behavior. Please wait before submitting more reports.\n\n` +
        `Excessive reporting may result in account deactivation.`
      );
      return;
    }
    
    // Check if user is logged in
    if (!userData || !userData.email) {
      showError(
        'Login Required',
        'You must be logged in with your @my.cspc.edu.ph account to report items.'
      );
      return;
    }
    
    // Verify email domain
    if (!userData.email.toLowerCase().endsWith('@my.cspc.edu.ph')) {
      showError(
        'Unauthorized',
        'Only users with @my.cspc.edu.ph email accounts can report items.'
      );
      return;
    }

    // If similar items exist, block submission
    if (hasSimilarItems && similarItems.length > 0) {
      const topMatch = similarItems[0];
      const matchInfo = topMatch.matchScore 
        ? `${topMatch.matchScore}% similar` 
        : `${Math.round(topMatch.confidence * 100)}% confidence`;
      
      showError(
        ' Cannot Submit - Similar Item Already Reported',
        `This item appears to be a duplicate. We found ${similarItems.length} very similar ${type} ${similarItems.length === 1 ? 'item' : 'items'} already in the system.\n\n` +
        `Top match: ${topMatch.item_name || 'Similar item'} (${matchInfo})\n\n` +
        `Why you cannot submit:\n` +
        `• Prevents duplicate entries in the system\n` +
        `• The existing report is likely the same item\n` +
        `• You can view similar items above\n\n` +
        `What to do instead:\n` +
        `• If this is YOUR item, go to the Browse Items screen and claim it\n` +
        `• If you found it, contact the person who reported it as lost\n` +
        `• If your item is truly different, add more unique details to distinguish it`
      );
      return;
    }

    // If no similar items, proceed directly
    await proceedWithSubmission();
  };

  const proceedWithSubmission = async () => {
    setLoading(true);
    
    try {
      // Debug: Log user data to identify issues
      console.log('=== REPORT ITEM DEBUG ===');
      console.log('User data:', JSON.stringify(userData, null, 2));
      console.log('User email:', userData?.email);
      console.log('User name:', userData?.name);
      console.log('User department:', userData?.department);
      
      // Handle image URL (now comes from upload service)
      let imageUrl = null;
      if (imageUri) {
        if (imageUri.startsWith('http')) {
          // It's an uploaded image URL from server
          imageUrl = imageUri;
        } else if (imageUri.startsWith('data:image/')) {
          // It's a data URI (base64)
          imageUrl = imageUri;
        } else {
          // Skip local file URIs - they should be uploaded first
          console.warn('Local file URI detected, skipping:', imageUri);
          imageUrl = null;
        }
      }

      // Create item object with reporter information
      // For found items, set status to pending_turnin with 12-hour deadline
      const now = new Date();
      const turnInDeadlineDate = new Date(now.getTime() + (12 * 60 * 60 * 1000)); // 12 hours from now
      const itemStatus = type === 'found' ? 'pending_turnin' : 'active';
      
      const item = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: title.trim() || `${type === 'lost' ? 'Lost' : 'Found'} ${categories[0] || 'Item'}`,
        description: description.trim(),
        category: categories[0] || 'Other',
        type: type,
        status: itemStatus,
        location: location.trim(),
        date_lost_found: selectedDate.toISOString(),
        turnin_deadline: type === 'found' ? turnInDeadlineDate.toISOString() : null,
        turnin_status: type === 'found' ? 'pending' : null,
        latitude: coordinates?.latitude || null,
        longitude: coordinates?.longitude || null,
        images: imageUrl ? [imageUrl] : [], // Send as array that backend expects
        reporter_id: userData.email,
        reporter_name: userData.name,
        reporter_email: userData.email,
        reporter_department: userData.department || null,
        detected_objects: detectedObjects && detectedObjects.length > 0 ? JSON.stringify(detectedObjects) : null,
        detected_categories: categories.length > 0 ? JSON.stringify(categories) : null
      };
      
      console.log('Item to be created:', JSON.stringify(item, null, 2));
      console.log('Saving item with coordinates:', coordinates, 'geotagged:', locationDetected);
      
      // Save item using API
      const result = await createItem(item);
      
      if (!result) {
        throw new Error('Failed to save item');
      }
      
      // Track achievement for reporting an item
      const unlockedAchievement = await checkAndUpdateAchievements(
        userData.email,
        'report_item',
        { itemType: type }
      );
      
      // Check for potential matches immediately
      const matchCount = await checkForMatches(item, type);
      
      setLoading(false);
      
      // Build success message
      let successMessage = `Your ${type} item has been reported successfully.`;
      if (type === 'found') {
        const deadlineTime = new Date(Date.now() + (12 * 60 * 60 * 1000));
        const formattedTime = deadlineTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        successMessage += `\n\n⚠️ IMPORTANT: You must turn in this item to the SSC Office within 12 hours (by ${formattedTime} today) for it to appear on the home screen. Items not turned in will be tagged as fake reports and removed.`;
      }
      if (matchCount > 0) {
        successMessage += ` We found ${matchCount} potential matches!`;
      }
      
      // Reset form after successful submission
      resetForm();
      
      // Show success message
      showSuccess(
        'Success',
        successMessage,
        [
          {
            text: matchCount > 0 ? 'View Matches' : 'OK',
            onPress: () => {
              if (matchCount > 0) {
                navigation.navigate('MatchScreen');
              } else {
                // Call the onGoBack callback if it exists
                if (route.params?.onGoBack) {
                  setTimeout(() => {
                    route.params.onGoBack();
                  }, 100);
                }
                // Don't navigate back, let user submit another report
                // navigation.goBack();
              }
            }
          },
          matchCount > 0 ? {
            text: 'Later',
            onPress: () => {
              // Call the onGoBack callback if it exists
              if (route.params?.onGoBack) {
                setTimeout(() => {
                  route.params.onGoBack();
                }, 100);
              }
              // Don't navigate back, let user submit another report
              // navigation.goBack();
            },
            style: 'cancel'
          } : null
        ].filter(Boolean)
      );
    } catch (error) {
      console.error('=== ERROR SUBMITTING ITEM ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Check if it's a network/API error
      if (error.response) {
        console.error('API Response Status:', error.response.status);
        console.error('API Response Data:', error.response.data);
      }
      
      let errorMessage = 'Failed to submit your report. Please try again.';
      
      // Provide more specific error messages
      if (error.message.includes('Failed to create item')) {
        errorMessage = 'Unable to create item. Please check your internet connection and try again.';
      } else if (error.message.includes('foreign key constraint')) {
        errorMessage = 'User authentication error. Please log out and log back in, then try again.';
      }
      
      showError('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Animated.View style={[styles.header, { elevation: headerElevation }]}>
          <View style={styles.headerBackground} />
          <LinearGradient
            colors={['#3266a8', '#2a5490']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerTitleContent}>
                <Ionicons name="document-text" size={22} color="#fff" style={styles.headerIcon} />
                <Text style={styles.headerTitle}>Report an Item</Text>
              </View>
              <View style={styles.headerIndicators}>
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          bounces={true}
          nestedScrollEnabled={true}
          removeClippedSubviews={false}
        >
          <Text style={[styles.sectionTitle, { textAlign: 'center' }]}>Select Item Type</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity 
              style={[
                styles.typeButton, 
                type === 'lost' && { backgroundColor: '#e74c3c' }
              ]}
              onPress={() => setType('lost')}
            >
              <Ionicons 
                name="search" 
                size={20} 
                color={type === 'lost' ? '#fff' : '#666'} 
                style={styles.typeIcon}
              />
              <Text style={[styles.typeText, type === 'lost' && styles.activeTypeText]}>
                Lost Item
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.typeButton, 
                type === 'found' && { backgroundColor: '#27ae60' }
              ]}
              onPress={() => setType('found')}
            >
              <Ionicons 
                name="checkmark-circle" 
                size={20} 
                color={type === 'found' ? '#fff' : '#666'} 
                style={styles.typeIcon}
              />
              <Text style={[styles.typeText, type === 'found' && styles.activeTypeText]}>
                Found Item
              </Text>
            </TouchableOpacity>
          </View>

          {/* Account Violations Warning */}
          {accountViolations > 0 && (
            <View style={styles.violationsWarning}>
              <View style={styles.violationsHeader}>
                <Ionicons name="warning" size={22} color="#ff6b00" />
                <Text style={styles.violationsTitle}>
                  ⚠️ Account Violations: {accountViolations}/3
                </Text>
              </View>
              <Text style={styles.violationsText}>
                Your account has {accountViolations} {accountViolations === 1 ? 'violation' : 'violations'} on record.
                {accountViolations >= 2 && ' You are close to account deactivation!'}
              </Text>
              <View style={styles.violationsDivider} />
              <Text style={styles.violationsReason}>Previous Violations:</Text>
              <View style={styles.violationsReasonsList}>
                <View style={styles.violationsReasonItem}>
                  <Ionicons name="close-circle" size={16} color="#ff6b00" />
                  <Text style={styles.violationsReasonText}>
                    Submitting fake or spam reports
                  </Text>
                </View>
                <View style={styles.violationsReasonItem}>
                  <Ionicons name="close-circle" size={16} color="#ff6b00" />
                  <Text style={styles.violationsReasonText}>
                    Excessive report submissions
                  </Text>
                </View>
              </View>
              <View style={styles.violationsFooter}>
                <Ionicons name="information-circle" size={16} color="#fff" />
                <Text style={styles.violationsFooterText}>
                  {accountViolations >= 3 
                    ? 'Your account will be deactivated. Contact SSC to appeal.'
                    : `${3 - accountViolations} more ${accountViolations >= 2 ? 'violation' : 'violations'} will result in automatic account deactivation.`
                  }
                </Text>
              </View>
            </View>
          )}
          
          {type === 'found' && (
            <View style={styles.turnInReminderCard}>
              <View style={styles.turnInReminderHeader}>
                <Ionicons name="time" size={24} color="#fff" />
                <Text style={styles.turnInReminderTitle}>⏰ 12-Hour Turn-In Required</Text>
              </View>
              
              <View style={styles.turnInReminderContent}>
                <View style={styles.turnInReminderItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#ff9500" />
                  <Text style={styles.turnInReminderText}>You MUST turn in this found item to the SSC Office within 12 hours</Text>
                </View>
                <View style={styles.turnInReminderItem}>
                  <Ionicons name="business" size={20} color="#ff9500" />
                  <Text style={styles.turnInReminderText}>Item will NOT appear on home screen until turned in</Text>
                </View>
                <View style={styles.turnInReminderItem}>
                  <Ionicons name="close-circle" size={20} color="#ff3b30" />
                  <Text style={styles.turnInReminderText}>Items not turned in within 12 hours will be flagged as fake reports</Text>
                </View>
                <View style={styles.turnInReminderItem}>
                  <Ionicons name="trash" size={20} color="#ff3b30" />
                  <Text style={styles.turnInReminderText}>Your account may be suspended for repeated fake reports</Text>
                </View>
              </View>
              
              <View style={styles.turnInReminderFooter}>
                <Ionicons name="information-circle" size={16} color="#fff" />
                <Text style={styles.turnInReminderFooterText}>
                  This policy ensures all found items are properly tracked and prevents fake reports.
                </Text>
              </View>
            </View>
          )}
          
          {type === 'found' && (
            <View style={styles.reminderCard}>
              <View style={styles.reminderHeader}>
                <Ionicons name="alert-circle" size={22} color="#fff" />
                <Text style={styles.reminderTitle}>Important Reminder</Text>
              </View>
              
              <View style={styles.reminderContent}>
                <View style={styles.reminderItem}>
                  <Ionicons name="information-circle" size={20} color="#3266a8" style={styles.reminderIcon} />
                  <Text style={styles.reminderText}>
                    You must turn in the found item to the Supreme Student Council Office after reporting it here.
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.locationInfo}
                  onPress={openMapsApp}
                  activeOpacity={0.7}
                >
                  <Ionicons name="location-outline" size={18} color="#3266a8" style={{marginRight: 8}} />
                  <View style={styles.locationTextContainer}>
                    <Text style={styles.locationText}>Supreme Student Council Office</Text>
                    <Text style={styles.coordinatesText}>13°24'23.2"N 123°22'31.4"E</Text>
                  </View>
                  <Ionicons name="navigate" size={18} color="#3266a8" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <ImagePickerComponent 
            onImageSelected={handleImageSelected}
            onCategoriesDetected={handleCategoriesDetected}
            onObjectsDetected={handleObjectsDetected}
            onDescriptionGenerated={handleDescriptionGenerated}
          />
          
          {/* Checking Similar Items Indicator */}
          {checkingSimilar && (
            <View style={styles.checkingSimilarContainer}>
              <ActivityIndicator size="small" color="#3266a8" />
              <Text style={styles.checkingSimilarText}>
                Checking for similar items...
              </Text>
            </View>
          )}

          {/* Similar Items Warning */}
          {hasSimilarItems && similarItems.length > 0 && (
            <View style={styles.similarItemsWarning}>
              <View style={styles.similarWarningHeader}>
                <Ionicons name="alert-circle" size={24} color="#ff6b6b" />
                <Text style={styles.similarWarningTitle}>
                  ⚠️ Similar Items Found
                </Text>
              </View>
              
              <Text style={styles.similarWarningText}>
                We found <Text style={styles.similarWarningBold}>{similarItems.length}</Text> very similar {type} {similarItems.length === 1 ? 'item' : 'items'} already reported in the system.
              </Text>
              
              <View style={styles.similarWarningDivider} />
              
              <Text style={styles.similarWarningSubtitle}>
                🚫 You cannot submit this report
              </Text>
              
              <View style={styles.similarWarningList}>
                <View style={styles.similarWarningItem}>
                  <Ionicons name="shield-checkmark" size={16} color="#721c1c" />
                  <Text style={styles.similarWarningItemText}>
                    Prevents duplicate entries in the system
                  </Text>
                </View>
                <View style={styles.similarWarningItem}>
                  <Ionicons name="copy" size={16} color="#721c1c" />
                  <Text style={styles.similarWarningItemText}>
                    The existing report is likely the same item
                  </Text>
                </View>
                <View style={styles.similarWarningItem}>
                  <Ionicons name="eye" size={16} color="#721c1c" />
                  <Text style={styles.similarWarningItemText}>
                    You can view similar items below
                  </Text>
                </View>
              </View>

              <View style={styles.similarWarningDivider} />

              <Text style={styles.similarWarningSubtitle}>
                💡 What to do instead:
              </Text>

              <View style={styles.similarWarningList}>
                <View style={styles.similarWarningItem}>
                  <Ionicons name="hand-right" size={16} color="#721c1c" />
                  <Text style={styles.similarWarningItemText}>
                    If this is YOUR item, go to Browse Items and claim it
                  </Text>
                </View>
                <View style={styles.similarWarningItem}>
                  <Ionicons name="call" size={16} color="#721c1c" />
                  <Text style={styles.similarWarningItemText}>
                    If you found it, contact the person who reported it
                  </Text>
                </View>
                <View style={styles.similarWarningItem}>
                  <Ionicons name="create" size={16} color="#721c1c" />
                  <Text style={styles.similarWarningItemText}>
                    If truly different, add more unique details to distinguish it
                  </Text>
                </View>
              </View>

              <View style={styles.similarItemsListContainer}>
                <Text style={styles.similarWarningSubtitle}>
                  📋 Top Similar Item:
                </Text>
                <View style={styles.similarItemsList}>
                  {similarItems.slice(0, 1).map((item, index) => (
                    <View key={item.id || index} style={styles.similarItemImageCard}>
                      {item.images && item.images.length > 0 ? (
                        <Image 
                          source={{ uri: item.images[0] }} 
                          style={styles.similarItemImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.similarItemNoImage}>
                          <Ionicons name="image-outline" size={40} color="#999" />
                          <Text style={styles.similarItemNoImageText}>No Image</Text>
                        </View>
                      )}
                      <View style={styles.similarItemImageOverlay}>
                        <View style={styles.similarItemBadge}>
                          <Text style={styles.similarItemBadgeText}>
                            #{index + 1}
                          </Text>
                        </View>
                        <View style={styles.similarItemMatchScore}>
                          <Text style={styles.similarItemMatchScoreText}>
                            {item.matchScore}%
                          </Text>
                        </View>
                      </View>
                      <View style={styles.similarItemBottomInfo}>
                        <Text style={styles.similarItemReporterText} numberOfLines={1}>
                          {item.item_name || item.title || 'Unknown'}
                        </Text>
                        <Text style={styles.similarItemDateText}>
                          {item.matchReasons?.[0] || 'Similar item'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.similarWarningFooter}>
                <Ionicons name="information-circle" size={14} color="#666" />
                <Text style={styles.similarWarningFooterText}>
                  This prevents spam and duplicate entries. Check Browse Items to see all {type} items.
                </Text>
              </View>
            </View>
          )}
          
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Title:</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter a title for your item"
              placeholderTextColor="#999"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description:</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                // Reset AI flag when user manually edits
                if (isAiGenerated && text !== description) {
                  setIsAiGenerated(false);
                }
              }}
              placeholder="Describe the item in detail (color, size, brand, etc.)"
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
            />
            {description && isAiGenerated && (
              <View style={styles.aiDisclaimerContainer}>
                <Ionicons name="information-circle-outline" size={16} color="#ffc107" style={{marginRight: 6}} />
                <Text style={styles.aiDisclaimerText}>
                  AI-generated description. Please verify and edit details as needed.
                </Text>
              </View>
            )}
          </View>

          {categories.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Detected Categories</Text>
              <View style={styles.categoriesContainer}>
                {categories.map((category, index) => (
                  <View key={index} style={styles.categoryTag}>
                    <Text style={styles.categoryText}>{category}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          
          {detectedObjects.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Detected Objects</Text>
              <View style={styles.objectsContainer}>
                {detectedObjects.slice(0, 5).map((obj, index) => (
                  <View key={index} style={styles.objectTag}>
                    <Text style={styles.objectText}>{obj.name}</Text>
                    <Text style={styles.confidenceText}>{Math.round(obj.confidence * 100)}%</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          
          <Text style={styles.sectionTitle}>Date and Location</Text>
          
          {/* Reminder Note for Date and Location */}
          <View style={styles.reminderNoteContainer}>
            <Ionicons name="information-circle" size={20} color="#3266a8" style={{marginRight: 8}} />
            <View style={styles.reminderNoteTextContainer}>
              <Text style={styles.reminderNoteTitle}>Important Reminder:</Text>
              <Text style={styles.reminderNoteText}>
                Please stay at the location where you {type === 'lost' ? 'lost' : 'found'} the item when detecting your location. 
                Select the exact date when you {type === 'lost' ? 'lost' : 'found'} it for accurate reporting.
              </Text>
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Detect your Location:</Text>
            <View style={styles.locationInputContainer}>
              <TextInput
                style={[styles.locationInput, styles.disabledInput]}
                value={location}
                placeholder={`Where was the item ${type === 'lost' ? 'lost' : 'found'}?`}
                placeholderTextColor="#999"
                editable={false}
                pointerEvents="none"
              />
              <TouchableOpacity 
                style={[styles.detectLocationButton, detectingLocation && styles.disabledButton]}
                onPress={detectLocation}
                disabled={detectingLocation}
              >
                {detectingLocation ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="location" size={16} color="#fff" />
                    <Text style={styles.detectLocationText}>Detect</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {locationDetected && coordinates && (
              <View style={styles.detectedLocationContainer}>
                <View style={styles.detectedLocationInfo}>
                  <Ionicons name="checkmark-circle" size={16} color="#28a745" style={{marginRight: 6}} />
                  <Text style={styles.detectedLocationText}>
                    Location detected: {formatCoordinates(coordinates.latitude, coordinates.longitude)}
                  </Text>
                </View>
                <View style={styles.mapContainer}>
                  <MapViewComponent
                    latitude={coordinates.latitude}
                    longitude={coordinates.longitude}
                    title="Detected Location"
                    description={location}
                    height={200}
                  />
                </View>
              </View>
            )}
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Date:</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color="#3266a8" style={{marginRight: 8}} />
              <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
            </TouchableOpacity>
            
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>
          
          <TouchableOpacity 
            style={[
              styles.submitButton, 
              (loading || checkingSimilar || (hasSimilarItems && similarItems.length > 0)) && styles.disabledButton
            ]}
            onPress={handleSubmit}
            disabled={loading || checkingSimilar || (hasSimilarItems && similarItems.length > 0)}
          >
            {loading ? (
              <Text style={styles.submitButtonText}>Submitting...</Text>
            ) : checkingSimilar ? (
              <Text style={styles.submitButtonText}>Checking for duplicates...</Text>
            ) : hasSimilarItems && similarItems.length > 0 ? (
              <Text style={styles.submitButtonText}>Cannot Submit - Similar Items Found</Text>
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        </Animated.ScrollView>
        <ProfessionalAlert
           visible={alertConfig.visible}
           type={alertConfig.type}
           title={alertConfig.title}
           message={alertConfig.message}
           buttons={alertConfig.buttons}
           onDismiss={hideAlert}
         />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (insets) => StyleSheet.create({
  turnInReminderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#ff9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#ff9500',
  },
  turnInReminderHeader: {
    backgroundColor: '#ff9500',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  turnInReminderTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
    marginLeft: 10,
  },
  turnInReminderContent: {
    padding: 16,
  },
  turnInReminderItem: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  turnInReminderText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    marginLeft: 10,
    lineHeight: 22,
    fontWeight: '500',
  },
  turnInReminderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff9500',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e68500',
  },
  turnInReminderFooterText: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  reminderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reminderHeader: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
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
    color: '#444',
    flex: 1,
    lineHeight: 22,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    justifyContent: 'center',
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
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
  backButton: {
    position: 'absolute',
    left: 0,
    padding: 4,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 120, // Space for the header
    paddingBottom: 1.5, // Adequate bottom spacing
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  activeTypeButton: {
    backgroundColor: '#3266a8',
  },
  typeIcon: {
    marginRight: 8,
  },
  typeText: {
    fontSize: 16,
    color: '#666',
  },
  activeTypeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#333',
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flex: 1,
    minHeight: 48,
    color: '#333',
  },
  disabledInput: {
    backgroundColor: '#f0f0f0',
    color: '#999',
    borderColor: '#ccc',
  },
  detectLocationButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectLocationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  detectedLocationContainer: {
    marginTop: 8,
  },
  detectedLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  detectedLocationText: {
    fontSize: 14,
    color: '#2e7d32',
    flex: 1,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  textArea: {
    minHeight: 100,
    maxHeight: 600,
  },
  submitButton: {
    backgroundColor: '#3266a8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
    marginHorizontal: 20,
    shadowColor: '#3266a8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryTag: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3266a8',
  },
  categoryText: {
    fontSize: 14,
    color: '#3266a8',
    fontWeight: '500',
  },
  objectsContainer: {
    marginBottom: 16,
  },
  objectTag: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#28a745',
  },
  objectText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  confidenceText: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: 'bold',
    backgroundColor: '#d4edda',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  aiDisclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ffc107',
  },
  aiDisclaimerText: {
    fontSize: 12,
    color: '#856404',
    flex: 1,
    lineHeight: 16,
  },
  checkingSimilarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    gap: 10,
  },
  checkingSimilarText: {
    fontSize: 13,
    color: '#1565c0',
    fontWeight: '500',
  },
  similarItemsWarning: {
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 2,
    borderColor: '#ff6b6b',
    elevation: 3,
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  similarWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  similarWarningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginLeft: 8,
    flex: 1,
  },
  similarWarningText: {
    fontSize: 14,
    color: '#721c1c',
    lineHeight: 20,
    marginBottom: 12,
  },
  similarWarningBold: {
    fontWeight: 'bold',
    color: '#d63031',
  },
  similarWarningDivider: {
    height: 1,
    backgroundColor: '#ffcccb',
    marginVertical: 12,
  },
  similarWarningSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#721c1c',
    marginBottom: 10,
  },
  similarWarningList: {
    gap: 10,
    marginBottom: 12,
  },
  similarWarningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  similarWarningItemText: {
    fontSize: 13,
    color: '#721c1c',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  similarItemsListContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  similarItemsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  similarItemsToggleText: {
    fontSize: 13,
    color: '#ff6b6b',
    fontWeight: '600',
    marginRight: 6,
  },
  similarItemsList: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  similarItemImageCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ff6b6b',
    backgroundColor: '#f5f5f5',
  },
  similarItemImage: {
    width: '100%',
    height: '100%',
  },
  similarItemNoImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  similarItemNoImageText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  similarItemImageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    gap: 6,
  },
  similarItemBadge: {
    backgroundColor: 'rgba(255, 107, 107, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  similarItemBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  similarItemMatchScore: {
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  similarItemMatchScoreText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
  },
  similarItemBottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  similarItemReporterText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  similarItemDateText: {
    fontSize: 9,
    color: '#e0e0e0',
    marginTop: 2,
  },
  similarItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  similarItemDate: {
    fontSize: 11,
    color: '#666',
  },
  similarItemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  similarItemCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  similarItemDescription: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    marginBottom: 6,
  },
  similarItemLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  similarItemLocationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  similarWarningFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffe0e0',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  similarWarningFooterText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  prohibitedItemsWarning: {
    backgroundColor: '#ffe0e0',
    borderRadius: 12,
    padding: 18,
    marginVertical: 16,
    borderWidth: 3,
    borderColor: '#dc3545',
    elevation: 4,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  prohibitedWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#dc3545',
  },
  prohibitedWarningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginLeft: 10,
    flex: 1,
  },
  prohibitedWarningText: {
    fontSize: 14,
    color: '#721c24',
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: '500',
  },
  prohibitedItemsList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  prohibitedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  prohibitedItemText: {
    fontSize: 14,
    color: '#721c24',
    marginLeft: 10,
    fontWeight: '600',
  },
  prohibitedReasonsDivider: {
    height: 2,
    backgroundColor: '#dc3545',
    marginVertical: 14,
  },
  prohibitedReasonsTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 12,
  },
  prohibitedReasonsList: {
    gap: 14,
    marginBottom: 14,
  },
  prohibitedReasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  prohibitedReasonTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  prohibitedReasonTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 4,
  },
  prohibitedReasonText: {
    fontSize: 13,
    color: '#721c24',
    lineHeight: 18,
  },
  prohibitedActionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  prohibitedActionText: {
    fontSize: 13,
    color: '#fff',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  violationsWarning: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 18,
    marginVertical: 16,
    borderWidth: 3,
    borderColor: '#ff6b00',
    elevation: 4,
    shadowColor: '#ff6b00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  violationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#ff6b00',
  },
  violationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff6b00',
    marginLeft: 10,
    flex: 1,
  },
  violationsText: {
    fontSize: 14,
    color: '#e65100',
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: '500',
  },
  violationsDivider: {
    height: 2,
    backgroundColor: '#ff6b00',
    marginVertical: 14,
  },
  violationsReason: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 12,
  },
  violationsReasonsList: {
    gap: 14,
    marginBottom: 14,
  },
  violationsReasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b00',
  },
  violationsReasonText: {
    fontSize: 13,
    color: '#e65100',
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  violationsFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ff6b00',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  violationsFooterText: {
    fontSize: 13,
    color: '#fff',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  reminderNoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3266a8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reminderNoteTextContainer: {
    flex: 1,
  },
  reminderNoteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 4,
  },
  reminderNoteText: {
    fontSize: 13,
    color: '#0d47a1',
    lineHeight: 18,
  },
});

// Wrap ReportItemScreen with internet guard to block access when offline
export default withInternetGuard(ReportItemScreen);
